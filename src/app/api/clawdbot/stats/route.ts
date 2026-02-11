import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || '/root/.clawdbot/clawdbot.json'

/**
 * GET /api/clawdbot/stats
 * Returns dashboard stats from Clawdbot config
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
    
    // Count channels
    const channels = []
    if (config.channels?.whatsapp) channels.push('whatsapp')
    if (config.channels?.telegram) channels.push('telegram')
    if (config.channels?.discord) channels.push('discord')
    if (config.channels?.slack) channels.push('slack')
    if (config.channels?.signal) channels.push('signal')
    if (config.webchat) channels.push('webchat')
    
    // Count providers
    const providers = Object.keys(config.models?.providers || {}).length
    const authProviders = new Set(
      Object.values(config.auth?.profiles || {})
        .map((p: unknown) => (p as { provider: string }).provider)
    ).size
    
    // Get groups count from WhatsApp
    const whatsappGroups = config.channels?.whatsapp?.groups ? 
      Object.keys(config.channels.whatsapp.groups).length : 0
    
    return Response.json({
      success: true,
      data: {
        channels: {
          total: channels.length,
          connected: channels.length,
          list: channels
        },
        providers: {
          total: providers + authProviders,
          active: providers + authProviders
        },
        conversations: {
          total: whatsappGroups,
          active: whatsappGroups,
          today: 0
        },
        messages: {
          total: 0,
          today: 0,
          pending: 0
        },
        health: {
          status: 'healthy',
          uptime: process.uptime(),
          lastCheck: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error reading stats:', error)
    return Response.json({
      success: false,
      error: 'Failed to read stats'
    }, { status: 500 })
  }
}
