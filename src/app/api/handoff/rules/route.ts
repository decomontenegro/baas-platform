import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, createHandoffRuleSchema, paginationSchema } from '@/lib/api/validate'
import { z } from 'zod'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

const rulesFilterSchema = paginationSchema.extend({
  workspaceId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
})

// GET /api/handoff/rules - List handoff rules
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, rulesFilterSchema)
    const { page, limit, workspaceId, isActive } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      workspace: {
        tenantId,
      },
      deletedAt: null,
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    const [rules, total] = await Promise.all([
      prisma.handoffRule.findMany({
        where,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.handoffRule.count({ where }),
    ])

    return apiResponse({
      rules,
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

// POST /api/handoff/rules - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createHandoffRuleSchema)

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

    const rule = await prisma.handoffRule.create({
      data: {
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig,
        action: data.action,
        actionConfig: data.actionConfig || {},
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

    return apiResponse({ rule }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
