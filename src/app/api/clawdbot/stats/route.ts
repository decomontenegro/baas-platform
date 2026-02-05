import { NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

// API Route to get real stats from Clawdbot
export async function GET() {
  try {
    // Read Clawdbot config to get channels
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const configPath = path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')
    
    let channels = 0
    let groups = 0
    let channelsList: { type: string; groups: number }[] = []
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      // Count channels
      if (config.channels) {
        if (config.channels.whatsapp) {
          channels++
          const whatsappGroups = Object.keys(config.channels.whatsapp.groups || {}).length
          groups += whatsappGroups
          channelsList.push({ type: 'WhatsApp', groups: whatsappGroups })
        }
        if (config.channels.telegram) {
          channels++
          const telegramGroups = Object.keys(config.channels.telegram.groups || {}).length
          groups += telegramGroups
          channelsList.push({ type: 'Telegram', groups: telegramGroups })
        }
        if (config.channels.discord) {
          channels++
          channelsList.push({ type: 'Discord', groups: 0 })
        }
      }
    } catch (e) {
      // Config not found or unreadable
      console.log('Could not read clawdbot config:', e)
    }
    
    return NextResponse.json({
      channels,
      groups,
      channelsList,
      // Placeholder - would need to track conversations in DB
      conversations: 0,
      resolutionRate: null,
      message: channels === 0 
        ? 'Nenhum canal configurado. Configure o Clawdbot primeiro.'
        : `${channels} canal(is) conectado(s)`
    })
  } catch (error) {
    console.error('Error fetching clawdbot stats:', error)
    return NextResponse.json({ 
      channels: 0, 
      groups: 0, 
      conversations: 0,
      error: 'Erro ao buscar estatísticas' 
    }, { status: 500 })
  }
}
