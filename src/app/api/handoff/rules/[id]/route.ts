import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, updateHandoffRuleSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/handoff/rules/[id] - Get a specific rule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const rule = await prisma.handoffRule.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
      },
    })

    if (!rule) {
      throw new NotFoundError('Handoff rule')
    }

    if (rule.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this rule')
    }

    return apiResponse({ rule })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/handoff/rules/[id] - Update a rule
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, updateHandoffRuleSchema)

    // Verify rule exists and belongs to tenant
    const existing = await prisma.handoffRule.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff rule')
    }

    if (existing.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this rule')
    }

    const rule = await prisma.handoffRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        triggerConfig: data.triggerConfig,
        actionConfig: data.actionConfig,
        priority: data.priority,
        autoReplyMessage: data.autoReplyMessage,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return apiResponse({ rule })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/handoff/rules/[id] - Soft delete a rule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify rule exists and belongs to tenant
    const existing = await prisma.handoffRule.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff rule')
    }

    if (existing.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this rule')
    }

    await prisma.handoffRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false,
      },
    })

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
