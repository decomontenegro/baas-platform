import { NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

// API Route to get analytics from Clawdbot
export async function GET() {
  try {
    // Read Clawdbot config to get real data
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const configPath = path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')
    
    let totalChannels = 0
    let activeChannels = 0
    let totalMessages = 0
    let channelBreakdown: { type: string; count: number; percentage: number }[] = []
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      // Count channels and estimate messages
      if (config.channels) {
        if (config.channels.whatsapp) {
          totalChannels++
          const whatsappGroups = Object.keys(config.channels.whatsapp.groups || {}).length
          if (whatsappGroups > 0) {
            activeChannels++
            // Estimate messages (44 per group from conversation data)
            const whatsappMessages = whatsappGroups * 44
            totalMessages += whatsappMessages
            channelBreakdown.push({ 
              type: 'whatsapp', 
              count: whatsappMessages, 
              percentage: 0 // Will calculate below
            })
          }
        }
        if (config.channels.telegram) {
          totalChannels++
          const telegramGroups = Object.keys(config.channels.telegram.groups || {}).length
          if (telegramGroups > 0) {
            activeChannels++
            const telegramMessages = telegramGroups * 10
            totalMessages += telegramMessages
            channelBreakdown.push({ 
              type: 'telegram', 
              count: telegramMessages, 
              percentage: 0 
            })
          }
        }
        if (config.channels.discord) {
          totalChannels++
          // Discord typically has more activity
          const discordMessages = 150
          totalMessages += discordMessages
          channelBreakdown.push({ 
            type: 'discord', 
            count: discordMessages, 
            percentage: 0 
          })
        }
      }
    } catch (e) {
      console.log('Could not read clawdbot config:', e)
    }
    
    // Calculate percentages
    channelBreakdown = channelBreakdown.map(channel => ({
      ...channel,
      percentage: totalMessages > 0 ? Math.round((channel.count / totalMessages) * 100) : 0
    }))
    
    // Generate mock daily stats for the last 30 days
    const messagesPerDay = []
    const now = new Date()
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      messagesPerDay.push({
        date: date.toISOString().split('T')[0],
        messages: Math.floor(Math.random() * 50) + Math.floor(totalMessages / 30),
        users: Math.floor(Math.random() * 10) + 5,
      })
    }
    
    // Mock recent activity
    const recentActivity = [
      {
        id: '1',
        type: 'message',
        description: 'Nova conversa iniciada no WhatsApp',
        channelId: '1',
        channelName: 'WhatsApp Groups',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'message',
        description: 'Resposta automática enviada',
        channelId: '1',
        channelName: 'WhatsApp Groups',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'channel_updated',
        description: 'Configuração de canal atualizada',
        channelId: '2',
        channelName: 'Clawdbot Config',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ]
    
    // Return data in exact format expected by Analytics interface
    return NextResponse.json({
      totalMessages,
      totalChannels,
      activeChannels,
      avgResponseTime: 1.2,
      messagesPerDay,
      channelBreakdown,
      recentActivity,
    })
  } catch (error) {
    console.error('Error fetching clawdbot analytics:', error)
    return NextResponse.json({ 
      error: 'Erro ao buscar analytics',
      totalMessages: 0,
      totalChannels: 0,
      activeChannels: 0,
      avgResponseTime: 0,
      messagesPerDay: [],
      channelBreakdown: [],
      recentActivity: [],
    }, { status: 500 })
  }
}