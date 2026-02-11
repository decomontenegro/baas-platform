import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/activity
 * Returns recent activity from Clawdbot conversations
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  
  try {
    // Get conversations from Clawdbot
    const res = await fetch(`${baseUrl}/api/clawdbot/conversations`)
    const data = await res.json()
    
    if (data.success && data.data) {
      // Transform to activity format
      const activities = data.data.slice(0, 20).map((conv: { id: string; name: string; channel: string; lastActivity: string }, index: number) => ({
        id: `activity-${index}`,
        type: 'conversation_started',
        description: `Nova conversa: ${conv.name || conv.id}`,
        conversationId: conv.id,
        channel: conv.channel,
        timestamp: conv.lastActivity,
        metadata: {}
      }))
      
      // Hook expects array directly, not wrapped object
      return Response.json(activities)
    }
  } catch (error) {
    console.error('Activity error:', error)
  }
  
  return Response.json([])
}
