import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, noContent, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, updateWorkspaceSchema } from '@/lib/api/validate'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to get and validate workspace access
async function getWorkspaceWithAccess(workspaceId: string, tenantId: string) {
  const workspace = await prisma.Workspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: {
        select: {
          Channel: true,
        },
      },
    },
  })

  if (!workspace) {
    throw new NotFoundError('Workspace')
  }

  if (workspace.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this workspace')
  }

  return workspace
}

// GET /api/workspaces/[id] - Get workspace details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    const workspace = await getWorkspaceWithAccess(id, tenantId)

    return apiResponse({ workspace })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/workspaces/[id] - Update workspace
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    const existingWorkspace = await getWorkspaceWithAccess(id, tenantId)
    
    const data = await parseBody(request, updateWorkspaceSchema)

    const workspace = await prisma.Workspace.update({
      where: { id: existingWorkspace.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.settings !== undefined && {
          settings: {
            ...(existingWorkspace.settings as object),
            ...data.settings,
          },
        }),
      },
      include: {
        _count: {
          select: {
            Channel: true,
          },
        },
      },
    })

    return apiResponse({ workspace })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/workspaces/[id] - Delete workspace
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    await getWorkspaceWithAccess(id, tenantId)

    await prisma.Workspace.delete({
      where: { id },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
