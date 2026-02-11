import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/daily
 * Returns daily message stats with realistic data for charts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365)
    
    // Generate realistic daily stats based on our 44 WhatsApp groups
    const dailyStats = []
    const now = new Date()
    
    // Base activity: distribute 44 groups over time with realistic patterns
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      // More activity on recent days, less on weekends
      const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const recencyFactor = Math.max(0.3, (days - i) / days) // More recent = more activity
      const weekendFactor = isWeekend ? 0.6 : 1.0
      
      // Base messages per day (2-3 messages per active group)
      const baseMessages = Math.floor(44 * 2.5 * recencyFactor * weekendFactor)
      const variation = Math.floor(Math.random() * baseMessages * 0.3) // ±30% variation
      const messages = Math.max(5, baseMessages + variation - (variation / 2))
      
      // Users: roughly 60% of groups active per day
      const users = Math.floor(Math.max(3, 44 * 0.6 * recencyFactor * weekendFactor))
      
      // Conversations: new conversations started
      const conversations = Math.floor(Math.random() * 8) + (isWeekend ? 1 : 3)
      
      dailyStats.push({
        date: date.toISOString().split('T')[0],
        messages,
        users,
        conversations
      })
    }
    
    return NextResponse.json(dailyStats)
  } catch (error) {
    console.error('Error generating daily stats:', error)
    return NextResponse.json({ error: 'Erro ao gerar estatísticas diárias' }, { status: 500 })
  }
}