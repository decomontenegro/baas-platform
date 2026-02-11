import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/daily
 * Returns daily stats for charts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '30', 10)
  
  // Generate placeholder daily stats
  const stats = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    stats.push({
      date: date.toISOString().split('T')[0],
      messages: 0,
      users: 0,
      conversations: 0
    })
  }
  
  return Response.json(stats)
}
