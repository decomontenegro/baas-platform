import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, createScheduledMessageSchema, scheduledMessageFilterSchema } from '@/lib/api/validate'
import { Prisma } from '@prisma/client'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/scheduled - List scheduled messages with filters
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, scheduledMessageFilterSchema)
    const { 
      page, 
      limit, 
      workspaceId, 
      channelId, 
      status, 
      scheduleType,
      tag,
      search,
      dateFrom,
      dateTo,
    } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.ScheduledMessageWhereInput = {
      tenantId,
      deletedAt: null,
    }

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (channelId) {
      where.channelId = channelId
    }

    if (status) {
      where.status = status
    }

    if (scheduleType) {
      where.scheduleType = scheduleType
    }

    if (tag) {
      where.tags = { has: tag }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { contactId: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.scheduledFor = {}
      if (dateFrom) {
        where.scheduledFor.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.scheduledFor.lte = new Date(dateTo)
      }
    }

    const [messages, total] = await Promise.all([
      prisma.scheduledMessage.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        skip,
        take: limit,
      }),
      prisma.scheduledMessage.count({ where }),
    ])

    return apiResponse({
      messages,
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

// POST /api/scheduled - Create new scheduled message
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createScheduledMessageSchema)

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

    // Verify channel belongs to workspace
    const channel = await prisma.channel.findUnique({
      where: { id: data.channelId },
    })

    if (!channel || channel.workspaceId !== data.workspaceId) {
      throw new NotFoundError('Channel')
    }

    // Validate schedule type specific fields
    if (data.scheduleType === 'RECURRING' && !data.recurrence) {
      throw new ForbiddenError('Recurrence configuration is required for recurring messages')
    }

    if (data.scheduleType === 'TRIGGER_BASED' && !data.triggerConfig) {
      throw new ForbiddenError('Trigger configuration is required for trigger-based messages')
    }

    // Create scheduled message
    const message = await prisma.scheduledMessage.create({
      data: {
        tenantId,
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        contactId: data.contactId,
        conversationId: data.conversationId,
        content: data.content,
        contentType: data.contentType,
        attachments: data.attachments || [],
        scheduledFor: new Date(data.scheduledFor),
        scheduleType: data.scheduleType,
        recurrence: data.recurrence,
        triggerConfig: data.triggerConfig,
        name: data.name,
        tags: data.tags || [],
        metadata: data.metadata || {},
        createdById: session.user.id,
        status: 'PENDING',
      },
    })

    return apiResponse({ message }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
