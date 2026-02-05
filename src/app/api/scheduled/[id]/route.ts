import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, noContent } from '@/lib/api/errors'
import { parseBody, updateScheduledMessageSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/scheduled/[id] - Get single scheduled message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const message = await prisma.scheduledMessage.findUnique({
      where: { id },
    })

    if (!message || message.deletedAt) {
      throw new NotFoundError('Scheduled message')
    }

    if (message.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    return apiResponse({ message })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/scheduled/[id] - Update scheduled message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const message = await prisma.scheduledMessage.findUnique({
      where: { id },
    })

    if (!message || message.deletedAt) {
      throw new NotFoundError('Scheduled message')
    }

    if (message.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    // Can only update pending or paused messages
    if (!['PENDING', 'PAUSED'].includes(message.status)) {
      throw new ForbiddenError(`Cannot update message with status ${message.status}`)
    }

    const data = await parseBody(request, updateScheduledMessageSchema)

    const updated = await prisma.scheduledMessage.update({
      where: { id },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.contentType && { contentType: data.contentType }),
        ...(data.attachments && { attachments: data.attachments }),
        ...(data.scheduledFor && { scheduledFor: new Date(data.scheduledFor) }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
        ...(data.triggerConfig !== undefined && { triggerConfig: data.triggerConfig }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.tags && { tags: data.tags }),
        ...(data.metadata && { metadata: data.metadata }),
        ...(data.status && { status: data.status }),
      },
    })

    return apiResponse({ message: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/scheduled/[id] - Cancel/delete scheduled message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const message = await prisma.scheduledMessage.findUnique({
      where: { id },
    })

    if (!message || message.deletedAt) {
      throw new NotFoundError('Scheduled message')
    }

    if (message.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    // Can only delete pending, paused, or failed messages
    if (!['PENDING', 'PAUSED', 'FAILED'].includes(message.status)) {
      throw new ForbiddenError(`Cannot delete message with status ${message.status}`)
    }

    // Soft delete
    await prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
