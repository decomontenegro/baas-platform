import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, addHandoffNoteSchema } from '@/lib/api/validate'

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

// GET /api/handoff/[id]/notes - Get notes for a handoff
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
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

    const notes = await prisma.handoffNote.findMany({
      where: { handoffId: id },
      orderBy: { createdAt: 'desc' },
    })

    return apiResponse({ notes })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/handoff/[id]/notes - Add a note to a handoff
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, addHandoffNoteSchema)

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

    const note = await prisma.handoffNote.create({
      data: {
        handoffId: id,
        content: data.content,
        isInternal: data.isInternal,
        authorId: userId,
        authorName: session.user.name || session.user.email,
      },
    })

    return apiResponse({ note }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
