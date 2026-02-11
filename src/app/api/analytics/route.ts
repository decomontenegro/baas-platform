import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics
 * Main analytics endpoint - returns overview metrics from Clawdbot
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  
  try {
    // Get conversations count from Clawdbot
    const res = await fetch(`${baseUrl}/api/clawdbot/conversations`)
    const data = await res.json()
    
    const totalConversations = data.success ? data.data?.length || 0 : 0
    const activeConversations = totalConversations
    
    // Get channels count
    const channelsRes = await fetch(`${baseUrl}/api/clawdbot/stats`)
    const channelsData = await channelsRes.json()
    const channelsActive = channelsData.success ? channelsData.data?.channels?.length || 1 : 1
    
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return Response.json({
      totalConversations,
      activeConversations,
      totalMessages: 0,
      avgResponseTime: 0,
      resolutionRate: 0,
      channelsActive,
      satisfactionScore: 0,
      handoffRate: 0,
      period: {
        start: weekAgo.toISOString(),
        end: now.toISOString()
      }
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return Response.json({
      totalConversations: 0,
      activeConversations: 0,
      totalMessages: 0,
      avgResponseTime: 0,
      resolutionRate: 0,
      channelsActive: 0,
      satisfactionScore: 0,
      handoffRate: 0,
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      }
    })
  }
}
