import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError, ConflictError } from '@/lib/api/errors'
import { parseBody, parseQuery } from '@/lib/api/validate'
import { 
  createQuickActionSchema, 
  quickActionFilterSchema 
} from '@/lib/api/actions-schemas'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/actions - List quick actions
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, quickActionFilterSchema)
    const { page, limit, type, triggerType, isEnabled, isBuiltin, search } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      tenantId,
      deletedAt: null,
    }

    if (type) {
      where.type = type
    }

    if (triggerType) {
      where.triggerType = triggerType
    }

    if (typeof isEnabled === 'boolean') {
      where.isEnabled = isEnabled
    }

    if (typeof isBuiltin === 'boolean') {
      where.isBuiltin = isBuiltin
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { trigger: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [actions, total] = await Promise.all([
      prisma.quickAction.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { isBuiltin: 'desc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.quickAction.count({ where }),
    ])

    return apiResponse({
      actions,
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

// POST /api/actions - Create new quick action
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createQuickActionSchema)

    // Check if trigger already exists
    const existingAction = await prisma.quickAction.findFirst({
      where: {
        tenantId,
        trigger: data.trigger.toLowerCase(),
        deletedAt: null,
      },
    })

    if (existingAction) {
      throw new ConflictError(`Action with trigger "${data.trigger}" already exists`)
    }

    const action = await prisma.quickAction.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        trigger: data.trigger.toLowerCase(),
        type: data.type,
        config: data.config || {},
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig || {},
        responseTemplate: data.responseTemplate,
        errorTemplate: data.errorTemplate,
        allowedRoles: data.allowedRoles || [],
        cooldownSeconds: data.cooldownSeconds,
        isEnabled: data.isEnabled,
        isBuiltin: false,
        sortOrder: data.sortOrder,
      },
    })

    return apiResponse({ action }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
