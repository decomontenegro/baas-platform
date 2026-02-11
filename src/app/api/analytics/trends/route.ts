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
    // Simulate some activity (last 7 days have more data)
    const isRecent = i >= days - 7
    activity.push({
      date: date.toISOString().split('T')[0],
      messages: isRecent ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 20),
      cost: isRecent ? Math.random() * 0.5 : Math.random() * 0.2
    })
  }
  
  // Generate peak hours with realistic distribution
  const peakHours = []
  for (let h = 0; h < 24; h++) {
    // Business hours (9-18) have more activity
    const isBusinessHour = h >= 9 && h <= 18
    peakHours.push({
      hour: h,
      messages: isBusinessHour ? Math.floor(Math.random() * 100) + 50 : Math.floor(Math.random() * 30),
      label: `${h.toString().padStart(2, '0')}:00`
    })
  }
  
  // Calculate insights from activity data
  const totalMessages = activity.reduce((sum, day) => sum + day.messages, 0)
  const totalCost = activity.reduce((sum, day) => sum + day.cost, 0)
  const avgMessages = Math.round(totalMessages / activity.length)
  const avgCost = totalCost / activity.length
  
  // Find busiest and quietest days
  const sortedByMessages = [...activity].sort((a, b) => b.messages - a.messages)
  const busiestDay = sortedByMessages[0]
  const quietestDay = sortedByMessages[sortedByMessages.length - 1]
  
  // Find peak hour
  const sortedHours = [...peakHours].sort((a, b) => b.messages - a.messages)
  const peakHourData = sortedHours[0]
  
  return Response.json({
    activity,
    peakHours,
    channelBreakdown: [
      {
        channelId: 'whatsapp',
        channelName: 'WhatsApp',
        channelType: 'whatsapp',
        messagesIn: Math.round(totalMessages * 0.6),
        messagesOut: Math.round(totalMessages * 0.4),
        cost: totalCost,
        avgResponseTimeMs: 1200,
        percentage: 100
      }
    ],
    insights: {
      avgDaily: { messages: avgMessages, cost: avgCost },
      busiestDay: { date: busiestDay.date, messages: busiestDay.messages },
      quietestDay: { date: quietestDay.date, messages: quietestDay.messages },
      peakHour: { hour: peakHourData.hour, label: peakHourData.label, messages: peakHourData.messages },
      totalMessages,
      totalCost
    }
  })
}
