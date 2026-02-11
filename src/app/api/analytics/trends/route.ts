import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/trends
 * Returns trends data for charts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const end = searchParams.get('end') || new Date().toISOString()
  
  // Generate activity data
  const activity = []
  const startDate = new Date(start)
  const endDate = new Date(end)
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    activity.push({
      date: date.toISOString().split('T')[0],
      messages: 0,
      cost: 0
    })
  }
  
  // Generate peak hours
  const peakHours = []
  for (let h = 0; h < 24; h++) {
    peakHours.push({
      hour: h,
      messages: 0,
      label: `${h.toString().padStart(2, '0')}:00`
    })
  }
  
  return Response.json({
    activity,
    peakHours,
    channelBreakdown: [
      {
        channelId: 'whatsapp',
        channelName: 'WhatsApp',
        channelType: 'whatsapp',
        messagesIn: 0,
        messagesOut: 0,
        cost: 0,
        avgResponseTimeMs: null,
        percentage: 100
      }
    ],
    insights: {
      avgDaily: { messages: 0, cost: 0 },
      busiestDay: null,
      quietestDay: null,
      peakHour: null,
      totalMessages: 0,
      totalCost: 0
    }
  })
}
