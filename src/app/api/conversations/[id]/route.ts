import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conversations/[id]
 * Returns a single conversation with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const baseUrl = request.nextUrl.origin
  
  try {
    // Fetch all conversations from Clawdbot
    const res = await fetch(`${baseUrl}/api/clawdbot/conversations`)
    const data = await res.json()
    
    if (data.success && data.data) {
      // Find the specific conversation
      const conv = data.data.find((c: { id: string }) => c.id === id)
      
      if (conv) {
        // Return conversation with expected format
        return Response.json({
          id: conv.id,
          contactId: conv.id,
          contactName: conv.name || conv.id,
          subject: null,
          status: conv.status === 'active' ? 'ACTIVE' : 'RESOLVED',
          priority: 'NORMAL',
          channel: {
            id: conv.channel,
            name: conv.channel.charAt(0).toUpperCase() + conv.channel.slice(1),
            type: conv.channel.toUpperCase()
          },
          workspace: {
            id: 'clawdbot-workspace',
            name: 'Clawdbot'
          },
          assignee: null,
          tags: [],
          metadata: {},
          createdAt: conv.lastActivity,
          updatedAt: conv.lastActivity,
          lastMessageAt: conv.lastActivity,
          resolvedAt: null,
          archivedAt: null,
          // Messages array (empty for now, could be populated from Clawdbot)
          messages: [],
          // Events/notes
          events: [],
          notes: [],
          _count: {
            Message: 0
          }
        })
      }
    }
  } catch (error) {
    console.error('Error fetching conversation:', error)
  }
  
  // Not found
  return Response.json(
    { error: 'Conversation not found' },
    { status: 404 }
  )
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation (placeholder)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return Response.json({ success: true, id: params.id })
}

/**
 * DELETE /api/conversations/[id]
 * Delete conversation (placeholder)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return Response.json({ success: true })
}
