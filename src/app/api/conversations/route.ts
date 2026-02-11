import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, conversationFilterSchema, createConversationSchema } from '@/lib/api/validate'
import { Prisma } from '@prisma/client'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/conversations - List conversations with filters
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const filters = parseQuery(request, conversationFilterSchema)
    const { 
      page, 
      limit, 
      workspaceId, 
      channelId, 
      status, 
      tag, 
      assignedToId,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder 
    } = filters
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.ConversationWhereInput = {
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

    if (tag) {
      where.tags = { has: tag }
    }

    if (assignedToId) {
      where.assignedToId = assignedToId
    }

    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactId: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.lastMessageAt = {}
      if (dateFrom) {
        where.lastMessageAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.lastMessageAt.lte = new Date(dateTo)
      }
    }

    // Build orderBy
    const orderBy: Prisma.ConversationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          workspace: {
            select: { id: true, name: true },
          },
          channel: {
            select: { id: true, name: true, type: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true, image: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              role: true,
              contentType: true,
              createdAt: true,
            },
          },
          _count: {
            select: { messages: true, notes: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ])

    // Transform to include last message preview
    const conversationsWithPreview = conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages[0] || null,
      messages: undefined, // Remove full messages array
    }))

    return apiResponse({
      conversations: conversationsWithPreview,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        workspaceId,
        channelId,
        status,
        tag,
        assignedToId,
        search,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createConversationSchema)

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

    // Verify channel if provided
    if (data.channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: data.channelId },
      })

      if (!channel || channel.workspaceId !== data.workspaceId) {
        throw new NotFoundError('Channel')
      }
    }

    // Check if conversation already exists for this contact
    const existing = await prisma.conversation.findFirst({
      where: {
        workspaceId: data.workspaceId,
        channelId: data.channelId || null,
        contactId: data.contactId,
        deletedAt: null,
      },
    })

    if (existing) {
      // Return existing conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: existing.id },
        include: {
          workspace: { select: { id: true, name: true } },
          channel: { select: { id: true, name: true, type: true } },
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
        },
      })
      return apiResponse({ conversation, existed: true }, 200)
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        contactId: data.contactId,
        contactName: data.contactName,
        contactAvatar: data.contactAvatar,
        contactInfo: data.contactInfo || {},
        subject: data.subject,
        tags: data.tags || [],
      },
      include: {
        workspace: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true, type: true } },
      },
    })

    // Create started event
    await prisma.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: 'STARTED',
        data: {
          contactId: data.contactId,
          contactName: data.contactName,
        },
      },
    })

    return apiResponse({ conversation, existed: false }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
