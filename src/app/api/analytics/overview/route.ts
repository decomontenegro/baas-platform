import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/overview
 * Returns analytics overview metrics
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  const searchParams = request.nextUrl.searchParams
  const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const end = searchParams.get('end') || new Date().toISOString()
  
  try {
    // Get conversations count from Clawdbot
    const res = await fetch(`${baseUrl}/api/clawdbot/conversations`)
    const data = await res.json()
    
    const totalConversations = data.success ? data.data?.length || 0 : 0
    
    return Response.json({
      period: { start, end },
      messages: {
        total: 0,
        incoming: 0,
        outgoing: 0,
        growth: 0
      },
      conversations: {
        started: totalConversations,
        ended: 0,
        ongoing: totalConversations
      },
      channels: {
        total: 2,
        active: 1,
        byType: { whatsapp: totalConversations, webchat: 0 }
      },
      performance: {
        avgResponseTimeMs: null,
        p50ResponseTimeMs: null,
        p95ResponseTimeMs: null,
        p99ResponseTimeMs: null,
        resolutionRate: 0,
        errorRate: 0
      },
      costs: {
        total: 0,
        tokensIn: 0,
        tokensOut: 0,
        currency: 'USD',
        perMessage: null
      },
      satisfaction: {
        positive: 0,
        negative: 0,
        score: null
      },
      uniqueUsers: totalConversations
    })
  } catch (error) {
    console.error('Analytics overview error:', error)
    return Response.json({
      period: { start, end },
      messages: { total: 0, incoming: 0, outgoing: 0, growth: 0 },
      conversations: { started: 0, ended: 0, ongoing: 0 },
      channels: { total: 0, active: 0, byType: {} },
      performance: { avgResponseTimeMs: null, p50ResponseTimeMs: null, p95ResponseTimeMs: null, p99ResponseTimeMs: null, resolutionRate: 0, errorRate: 0 },
      costs: { total: 0, tokensIn: 0, tokensOut: 0, currency: 'USD', perMessage: null },
      satisfaction: { positive: 0, negative: 0, score: null },
      uniqueUsers: 0
    })
  }
}
