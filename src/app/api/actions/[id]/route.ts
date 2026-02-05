import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { 
  handleApiError, 
  apiResponse, 
  noContent,
  NotFoundError, 
  ForbiddenError, 
  UnauthorizedError,
  ConflictError,
} from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { updateQuickActionSchema } from '@/lib/api/actions-schemas'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/actions/[id] - Get action by ID
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

    const action = await prisma.quickAction.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
    })

    if (!action || action.deletedAt) {
      throw new NotFoundError('Action')
    }

    if (action.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this action')
    }

    // Get recent executions
    const recentExecutions = await prisma.actionExecution.findMany({
      where: { actionId: id },
      orderBy: { executedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        channelId: true,
        status: true,
        durationMs: true,
        executedAt: true,
        error: true,
      },
    })

    return apiResponse({
      action: {
        ...action,
        recentExecutions,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/actions/[id] - Update action
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

    const action = await prisma.quickAction.findUnique({
      where: { id },
    })

    if (!action || action.deletedAt) {
      throw new NotFoundError('Action')
    }

    if (action.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this action')
    }

    const data = await parseBody(request, updateQuickActionSchema)

    // Check if trigger already exists (if changing trigger)
    if (data.trigger && data.trigger.toLowerCase() !== action.trigger) {
      const existingAction = await prisma.quickAction.findFirst({
        where: {
          tenantId,
          trigger: data.trigger.toLowerCase(),
          deletedAt: null,
          NOT: { id },
        },
      })

      if (existingAction) {
        throw new ConflictError(`Action with trigger "${data.trigger}" already exists`)
      }
    }

    // Build update data
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.trigger !== undefined) updateData.trigger = data.trigger.toLowerCase()
    if (data.type !== undefined) updateData.type = data.type
    if (data.config !== undefined) updateData.config = data.config
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType
    if (data.triggerConfig !== undefined) updateData.triggerConfig = data.triggerConfig
    if (data.responseTemplate !== undefined) updateData.responseTemplate = data.responseTemplate
    if (data.errorTemplate !== undefined) updateData.errorTemplate = data.errorTemplate
    if (data.allowedRoles !== undefined) updateData.allowedRoles = data.allowedRoles
    if (data.cooldownSeconds !== undefined) updateData.cooldownSeconds = data.cooldownSeconds
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const updatedAction = await prisma.quickAction.update({
      where: { id },
      data: updateData,
    })

    return apiResponse({ action: updatedAction })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/actions/[id] - Delete action (soft delete)
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

    const action = await prisma.quickAction.findUnique({
      where: { id },
    })

    if (!action || action.deletedAt) {
      throw new NotFoundError('Action')
    }

    if (action.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this action')
    }

    // Don't allow deleting built-in actions
    if (action.isBuiltin) {
      throw new ForbiddenError('Cannot delete built-in actions. You can disable them instead.')
    }

    // Soft delete
    await prisma.quickAction.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
