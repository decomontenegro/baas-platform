import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, createChannelSchema, channelFilterSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/channels - List channels with filters
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, channelFilterSchema)
    const { page, limit, workspaceId, type, status } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      workspace: {
        tenantId,
      },
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.channel.count({ where }),
    ])

    return apiResponse({
      channels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        workspaceId,
        type,
        status,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/channels - Create new channel
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createChannelSchema)

    // Verify workspace belongs to tenant
    const workspace = await prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    })

    if (!workspace) {
      throw new NotFoundError('Workspace')
    }

    if (workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this workspace')
    }

    const channel = await prisma.channel.create({
      data: {
        name: data.name,
        type: data.type,
        workspaceId: data.workspaceId,
        config: data.config || {},
        metadata: data.metadata || {},
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

    return apiResponse({ channel }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
