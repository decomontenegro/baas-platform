import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, createWorkspaceSchema, paginationSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/workspaces - List workspaces for current tenant
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { page, limit } = parseQuery(request, paginationSchema)
    const skip = (page - 1) * limit

    const [workspaces, total] = await Promise.all([
      prisma.Workspace.findMany({
        where: { tenantId },
        include: {
          _count: {
            select: {
              Channel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.Workspace.count({ where: { tenantId } }),
    ])

    return apiResponse({
      workspaces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createWorkspaceSchema)

    const workspace = await prisma.Workspace.create({
      data: {
        name: data.name,
        description: data.description,
        settings: data.settings || {},
        tenantId,
      },
      include: {
        _count: {
          select: {
            Channel: true,
          },
        },
      },
    })

    return apiResponse({ workspace }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
