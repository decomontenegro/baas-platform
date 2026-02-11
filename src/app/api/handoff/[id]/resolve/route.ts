import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, BadRequestError } from '@/lib/api/errors'
import { parseBody, resolveHandoffSchema } from '@/lib/api/validate'

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

// POST /api/handoff/[id]/resolve - Resolve a handoff request
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, resolveHandoffSchema)

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

    // Cannot resolve if already resolved
    if (existing.status === 'RESOLVED') {
      throw new BadRequestError('Handoff is already resolved')
    }

    const handoffRequest = await prisma.handoffRequest.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNote: data.resolutionNote,
        metadata: {
          ...(existing.metadata as object || {}),
          returnToBot: data.returnToBot,
        },
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

    // Create a resolution note
    await prisma.handoffNote.create({
      data: {
        handoffId: id,
        content: data.resolutionNote || 'Atendimento finalizado',
        isInternal: true,
        authorId: userId,
        authorName: session.user.name || session.user.email,
      },
    })

    return apiResponse({ 
      handoffRequest,
      returnToBot: data.returnToBot,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
