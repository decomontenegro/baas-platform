import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, addConversationTagSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to verify conversation access and get current tags
async function getConversationWithTags(id: string, tenantId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, tenantId: true, deletedAt: true, tags: true },
  })

  if (!conversation || conversation.deletedAt) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this conversation')
  }

  return conversation
}

// POST /api/conversations/[id]/tag - Add or remove tag
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const userId = session.user.id
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const conversation = await getConversationWithTags(id, tenantId)
    const data = await parseBody(request, addConversationTagSchema)
    
    const currentTags = conversation.tags || []
    const normalizedTag = data.tag.toLowerCase().trim()
    
    let newTags: string[]
    let eventType: 'TAG_ADDED' | 'TAG_REMOVED'
    let wasModified = false

    if (data.action === 'add') {
      if (!currentTags.includes(normalizedTag)) {
        newTags = [...currentTags, normalizedTag]
        eventType = 'TAG_ADDED'
        wasModified = true
      } else {
        newTags = currentTags
        eventType = 'TAG_ADDED'
      }
    } else {
      if (currentTags.includes(normalizedTag)) {
        newTags = currentTags.filter((t) => t !== normalizedTag)
        eventType = 'TAG_REMOVED'
        wasModified = true
      } else {
        newTags = currentTags
        eventType = 'TAG_REMOVED'
      }
    }

    // Update if modified
    if (wasModified) {
      await prisma.conversation.update({
        where: { id },
        data: { tags: newTags },
      })

      // Create event
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: eventType,
          actorId: userId,
          data: { tag: normalizedTag },
        },
      })
    }

    return apiResponse({
      tags: newTags,
      action: data.action,
      tag: normalizedTag,
      modified: wasModified,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/conversations/[id]/tag - Get all tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const conversation = await getConversationWithTags(id, tenantId)

    return apiResponse({ tags: conversation.tags || [] })
  } catch (error) {
    return handleApiError(error)
  }
}
