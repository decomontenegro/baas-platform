import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, updateHandoffRequestSchema } from '@/lib/api/validate'

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

// GET /api/handoff/[id] - Get a specific handoff request
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const handoffRequest = await prisma.handoffRequest.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!handoffRequest) {
      throw new NotFoundError('Handoff request')
    }

    if (handoffRequest.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this handoff request')
    }

    return apiResponse({ handoffRequest })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/handoff/[id] - Update a handoff request
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, updateHandoffRequestSchema)

    // Verify handoff exists and belongs to tenant
    const existing = await prisma.handoffRequest.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff request')
    }

    if (existing.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this handoff request')
    }

    const handoffRequest = await prisma.handoffRequest.update({
      where: { id },
      data: {
        priority: data.priority,
        reasonText: data.reasonText,
        metadata: data.metadata,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        notes: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return apiResponse({ handoffRequest })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/handoff/[id] - Soft delete a handoff request
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify handoff exists and belongs to tenant
    const existing = await prisma.handoffRequest.findUnique({
      where: { id },
      include: {
        workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff request')
    }

    if (existing.workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this handoff request')
    }

    await prisma.handoffRequest.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        status: 'CANCELLED',
      },
    })

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
