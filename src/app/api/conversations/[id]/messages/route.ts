import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, messageFilterSchema, createMessageSchema } from '@/lib/api/validate'
import { Prisma } from '@prisma/client'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to verify conversation access
async function verifyConversationAccess(id: string, tenantId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, tenantId: true, deletedAt: true },
  })

  if (!conversation || conversation.deletedAt) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this conversation')
  }

  return conversation
}

// GET /api/conversations/[id]/messages - List messages with pagination
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

    await verifyConversationAccess(id, tenantId)

    const filters = parseQuery(request, messageFilterSchema)
    const { page, limit, role, search, before, after } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.MessageWhereInput = {
      conversationId: id,
      deletedAt: null,
    }

    if (role) {
      where.role = role
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' }
    }

    if (before || after) {
      where.createdAt = {}
      if (before) {
        where.createdAt.lt = new Date(before)
      }
      if (after) {
        where.createdAt.gt = new Date(after)
      }
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ])

    // Reverse for chronological order in response
    const sortedMessages = messages.reverse()

    return apiResponse({
      messages: sortedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/conversations/[id]/messages - Create new message
export async function POST(
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

    await verifyConversationAccess(id, tenantId)

    const data = await parseBody(request, createMessageSchema)

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        content: data.content,
        contentType: data.contentType,
        role: data.role,
        senderId: data.role === 'OPERATOR' ? userId : null,
        senderName: data.senderName || (data.role === 'OPERATOR' ? session.user.name : null),
        externalId: data.externalId,
        attachments: data.attachments || [],
        aiMetadata: data.aiMetadata,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    // Update conversation stats
    await prisma.conversation.update({
      where: { id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
        // If user message, increment unread count
        ...(data.role === 'USER' ? { unreadCount: { increment: 1 } } : {}),
        // If status was resolved and we get a new user message, reopen
        ...(data.role === 'USER' ? {
          status: 'ACTIVE',
          resolvedAt: null,
        } : {}),
      },
    })

    return apiResponse({ message }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
