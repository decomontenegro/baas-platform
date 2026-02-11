import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, addConversationNoteSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to verify conversation access
async function verifyConversationAccess(id: string, tenantId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, tenantId: true, deletedAt: true },
  })

  if (!conversation || conversation.deletedAt) {
    throw new NotFoundError('Conversation')
  }

  if (conversation.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this conversation')
  }

  return conversation
}

// POST /api/conversations/[id]/note - Add internal note
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

    await verifyConversationAccess(id, tenantId)

    const data = await parseBody(request, addConversationNoteSchema)

    // Create note
    const note = await prisma.conversationNote.create({
      data: {
        conversationId: id,
        authorId: userId,
        content: data.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    // Create event
    await prisma.conversationEvent.create({
      data: {
        conversationId: id,
        type: 'NOTE_ADDED',
        actorId: userId,
        data: {
          noteId: note.id,
          preview: data.content.substring(0, 100),
        },
      },
    })

    return apiResponse({ note }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/conversations/[id]/note - Get all notes
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

    await verifyConversationAccess(id, tenantId)

    const notes = await prisma.conversationNote.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return apiResponse({ notes })
  } catch (error) {
    return handleApiError(error)
  }
}
