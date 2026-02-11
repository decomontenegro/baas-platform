import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, createCampaignSchema, campaignFilterSchema } from '@/lib/api/validate'
import { Prisma } from '@prisma/client'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/campaigns - List campaigns with filters
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, campaignFilterSchema)
    const { 
      page, 
      limit, 
      workspaceId, 
      channelId, 
      type, 
      status,
      search,
      dateFrom,
      dateTo,
    } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.CampaignWhereInput = {
      tenantId,
      deletedAt: null,
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (channelId) {
      where.channelId = channelId
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo)
      }
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          _count: {
            select: { recipients: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ])

    return apiResponse({
      campaigns,
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

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createCampaignSchema)

    // Verify workspace belongs to tenant if provided
    if (data.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: data.workspaceId },
      })

      if (!workspace) {
        throw new NotFoundError('Workspace')
      }

      if (workspace.tenantId !== tenantId) {
        throw new ForbiddenError('Access denied to this workspace')
      }
    }

    // Verify channel belongs to workspace if provided
    if (data.channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: data.channelId },
      })

      if (!channel) {
        throw new NotFoundError('Channel')
      }

      if (data.workspaceId && channel.workspaceId !== data.workspaceId) {
        throw new ForbiddenError('Channel does not belong to this workspace')
      }
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        name: data.name,
        description: data.description,
        type: data.type,
        content: data.content,
        contentType: data.contentType,
        attachments: data.attachments || [],
        template: data.template,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        audienceType: data.audienceType,
        audienceFilter: data.audienceFilter || {},
        audienceIds: data.audienceIds || [],
        messagesPerMinute: data.messagesPerMinute,
        delayBetweenMs: data.delayBetweenMs,
        config: data.config || {},
        createdById: session.user.id,
        status: data.scheduledFor ? 'SCHEDULED' : 'DRAFT',
      },
    })

    return apiResponse({ campaign }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
