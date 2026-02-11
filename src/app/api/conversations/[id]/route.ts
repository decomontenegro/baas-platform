import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, noContent } from '@/lib/api/errors'
import { parseBody, updateConversationSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to get conversation with tenant check
async function getConversation(id: string, tenantId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      workspace: { select: { id: true, name: true } },
      channel: { select: { id: true, name: true, type: true } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      },
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  })

  if (!conversation || conversation.deletedAt) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this conversation')
  }

  return conversation
}

// GET /api/conversations/[id] - Get conversation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const conversation = await getConversation(id, tenantId)

    // Calculate conversation stats
    const stats = await prisma.message.aggregate({
      where: { conversationId: id, deletedAt: null },
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    })

    const messagesByRole = await prisma.message.groupBy({
      by: ['role'],
      where: { conversationId: id, deletedAt: null },
      _count: { id: true },
    })

    const duration = stats._min?.createdAt && stats._max?.createdAt
      ? Math.round((stats._max.createdAt.getTime() - stats._min.createdAt.getTime()) / 1000)
      : 0

    return apiResponse({
      conversation,
      stats: {
        messageCount: stats._count?.id || 0,
        durationSeconds: duration,
        messagesByRole: messagesByRole.reduce((acc, item) => {
          acc[item.role] = item._count.id
          return acc
        }, {} as Record<string, number>),
        firstMessageAt: stats._min?.createdAt,
        lastMessageAt: stats._max?.createdAt,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify access
    const existing = await getConversation(id, tenantId)
    const data = await parseBody(request, updateConversationSchema)

    // Track status change for event
    const statusChanged = data.status && data.status !== existing.status
    const assigneeChanged = data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId

    // Build update data
    const updateData: any = {}
    
    if (data.status !== undefined) {
      updateData.status = data.status
      if (data.status === 'RESOLVED') {
        updateData.resolvedAt = new Date()
      } else if (existing.status === 'RESOLVED' && data.status !== 'RESOLVED') {
        updateData.resolvedAt = null
      }
      if (data.status === 'HANDOFF') {
        updateData.handoffAt = new Date()
      }
    }
    
    if (data.subject !== undefined) {
      updateData.subject = data.subject
    }
    
    if (data.tags !== undefined) {
      updateData.tags = data.tags
    }
    
    if (data.assignedToId !== undefined) {
      updateData.assignedToId = data.assignedToId
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        workspace: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    // Create events for changes
    if (statusChanged) {
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: 'STATUS_CHANGED',
          actorId: userId,
          data: {
            from: existing.status,
            to: data.status,
          },
        },
      })
    }

    if (assigneeChanged) {
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: data.assignedToId ? 'ASSIGNED' : 'UNASSIGNED',
          actorId: userId,
          data: {
            from: existing.assignedToId,
            to: data.assignedToId,
          },
        },
      })
    }

    return apiResponse({ conversation })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/conversations/[id] - Archive/Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify access
    await getConversation(id, tenantId)

    // Check query param for hard delete vs soft delete
    const url = new URL(request.url)
    const hardDelete = url.searchParams.get('hard') === 'true'

    if (hardDelete) {
      // Hard delete (admin only - would add role check in production)
      await prisma.conversation.delete({
        where: { id },
      })
    } else {
      // Soft delete
      await prisma.conversation.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
          status: 'ARCHIVED',
        },
      })

      // Create archived event
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: 'ARCHIVED',
          actorId: userId,
        },
      })
    }

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
