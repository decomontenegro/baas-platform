import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conversations
 * Falls back to Clawdbot conversations when database is not available
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  
  try {
    const res = await fetch(`${baseUrl}/api/clawdbot/conversations`)
    const data = await res.json()
    
    if (data.success && data.data) {
      // Transform to expected format
      const conversations = data.data.map((conv: { id: string; name: string; type: string; channel: string; status: string; lastActivity: string }) => ({
        id: conv.id,
        title: conv.name,
        status: conv.status === 'active' ? 'OPEN' : 'CLOSED',
        channel: conv.channel.toUpperCase(),
        channelType: conv.type,
        WorkspaceId: 'clawdbot-workspace',
        createdAt: conv.lastActivity,
        updatedAt: conv.lastActivity,
        lastMessageAt: conv.lastActivity,
        messageCount: 0,
        unreadCount: 0,
        participant: {
          id: conv.id,
          name: conv.name,
          avatar: null
        }
      }))
      
      return Response.json({
        success: true,
        data: conversations,
        meta: data.meta || { total: conversations.length }
      })
    }
  } catch (error) {
    console.error('Error fetching conversations:', error)
  }
  
  return Response.json({
    success: true,
    data: [],
    meta: { total: 0, active: 0, handoff: 0, unread: 0 }
  })
}
