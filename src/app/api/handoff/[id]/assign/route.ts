import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, BadRequestError } from '@/lib/api/errors'
import { parseBody, assignHandoffSchema } from '@/lib/api/validate'

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

// POST /api/handoff/[id]/assign - Assign a handoff to an agent
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, assignHandoffSchema)

    // Verify handoff exists and belongs to tenant
    const existing = await prisma.handoffRequest.findUnique({
      where: { id },
      include: {
        Workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff request')
    }

    if (existing.Workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this handoff request')
    }

    // Check if already assigned to someone else
    if (existing.status !== 'PENDING' && existing.User && existing.User !== data.assignTo) {
      throw new BadRequestError('Handoff is already assigned to another agent')
    }

    // Verify the assigned user exists and belongs to tenant
    const assignedUser = await prisma.user.findFirst({
      where: {
        id: data.assignTo,
        tenantId,
        isActive: true,
      },
    })

    if (!assignedUser) {
      throw new NotFoundError('Assigned user')
    }

    const handoffRequest = await prisma.handoffRequest.update({
      where: { id },
      data: {
        assignedTo: data.assignTo,
        assignedBy: userId,
        assignedAt: new Date(),
        status: 'ASSIGNED',
      },
      include: {
        Workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create a note about the assignment
    await prisma.handoffNote.create({
      data: {
        handoffId: id,
        content: `Atribuído a ${assignedUser.name || assignedUser.email}`,
        isInternal: true,
        authorId: userId,
        authorName: session.user.name || session.user.email,
      },
    })

    return apiResponse({ handoffRequest })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/handoff/[id]/assign - Unassign a handoff
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify handoff exists and belongs to tenant
    const existing = await prisma.handoffRequest.findUnique({
      where: { id },
      include: {
        Workspace: {
          select: { tenantId: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Handoff request')
    }

    if (existing.Workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this handoff request')
    }

    const handoffRequest = await prisma.handoffRequest.update({
      where: { id },
      data: {
        assignedTo: null,
        assignedBy: null,
        assignedAt: null,
        status: 'PENDING',
      },
      include: {
        Workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create a note about the unassignment
    await prisma.handoffNote.create({
      data: {
        handoffId: id,
        content: 'Atribuição removida, voltou para a fila',
        isInternal: true,
        authorId: userId,
        authorName: session.user.name || session.user.email,
      },
    })

    return apiResponse({ handoffRequest })
  } catch (error) {
    return handleApiError(error)
  }
}
