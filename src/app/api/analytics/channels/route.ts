import { NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/channels
 * Returns channel breakdown for analytics
 */
export async function GET() {
  try {
    // Mock channel data based on real 44 WhatsApp groups
    const channelData = [
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        type: 'whatsapp',
        totalMessages: 468,
        percentage: 100,
        avgResponseTime: 1.2,
        status: 'active',
        groups: 44,
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      {
        id: 'webchat',
        name: 'Web Chat',
        type: 'webchat', 
        totalMessages: 0,
        percentage: 0,
        avgResponseTime: null,
        status: 'inactive',
        groups: 0,
        lastActivity: null
      }
    ]

    // Channel metrics
    const metrics = {
      totalChannels: 2,
      activeChannels: 1,
      totalMessages: 468,
      avgResponseTime: 1.2
    }

    return NextResponse.json({
      success: true,
      data: {
        channels: channelData,
        metrics
      }
    })
  } catch (error) {
    console.error('Error fetching channel analytics:', error)
    return NextResponse.json({ error: 'Erro ao buscar analytics de canais' }, { status: 500 })
  }
}