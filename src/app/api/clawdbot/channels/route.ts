import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || 
  path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')

interface ChannelInfo {
  id: string
  name: string
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'webchat'
  status: 'connected' | 'disconnected' | 'configured'
  groups?: number
  dmPolicy?: string
  groupPolicy?: string
  config?: Record<string, unknown>
}

/**
 * GET /api/clawdbot/channels
 * Returns real channels from Clawdbot config
 */
export async function GET(_request: NextRequest) {
  try {
    if (!existsSync(CLAWDBOT_CONFIG_PATH)) {
      return Response.json({
        success: false,
        error: 'Clawdbot config not found'
      }, { status: 404 })
    }
    
    const configRaw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configRaw)
    const channelsConfig = config.channels || {}
    
    const channels: ChannelInfo[] = []
    
    // WhatsApp
    if (channelsConfig.whatsapp) {
      const wa = channelsConfig.whatsapp
      const groupCount = Object.keys(wa.groups || {}).length
      channels.push({
        id: 'whatsapp',
        name: 'WhatsApp',
        type: 'whatsapp',
        status: 'connected', // Assume connected if configured
        groups: groupCount,
        dmPolicy: wa.dmPolicy,
        groupPolicy: wa.groupPolicy,
        config: {
          selfChatMode: wa.selfChatMode,
          allowFrom: wa.allowFrom?.length || 0,
          groupAllowFrom: wa.groupAllowFrom?.includes('*') ? 'all' : (wa.groupAllowFrom?.length || 0),
          mediaMaxMb: wa.mediaMaxMb
        }
      })
    }
    
    // Telegram
    if (channelsConfig.telegram) {
      const tg = channelsConfig.telegram
      channels.push({
        id: 'telegram',
        name: 'Telegram',
        type: 'telegram',
        status: tg.botToken ? 'connected' : 'configured',
        dmPolicy: tg.dmPolicy,
        config: {
          botUsername: tg.botUsername
        }
      })
    }
    
    // Discord
    if (channelsConfig.discord) {
      const dc = channelsConfig.discord
      channels.push({
        id: 'discord',
        name: 'Discord',
        type: 'discord',
        status: dc.botToken ? 'connected' : 'configured',
        config: {
          guildCount: Object.keys(dc.guilds || {}).length
        }
      })
    }
    
    // Slack
    if (channelsConfig.slack) {
      channels.push({
        id: 'slack',
        name: 'Slack',
        type: 'slack',
        status: 'configured'
      })
    }
    
    // Webchat (always available)
    channels.push({
      id: 'webchat',
      name: 'Webchat',
      type: 'webchat',
      status: 'connected',
      config: {
        endpoint: '/api/chat'
      }
    })
    
    return Response.json({
      success: true,
      data: channels,
      meta: {
        total: channels.length,
        connected: channels.filter(c => c.status === 'connected').length
      }
    })
  } catch (error) {
    console.error('Error reading channels:', error)
    return Response.json({
      success: false,
      error: 'Failed to read channels'
    }, { status: 500 })
  }
}
