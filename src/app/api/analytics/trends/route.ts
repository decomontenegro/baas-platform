import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/trends
 * Returns analytics trends (placeholder)
 */
export async function GET(_request: NextRequest) {
  // Generate last 7 days of placeholder data
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push({
      date: date.toISOString().split('T')[0],
      conversations: 0,
      messages: 0,
      responseTime: 0
    })
  }
  
  return Response.json({
    success: true,
    data: {
      daily: days,
      summary: {
        totalConversations: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        trend: 'stable'
      }
    }
  })
}
