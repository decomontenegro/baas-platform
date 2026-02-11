import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || '/root/.clawdbot/clawdbot.json'

/**
 * GET /api/analytics/overview
 * Returns analytics overview from Clawdbot
 */
export async function GET(_request: NextRequest) {
  try {
    let channelCount = 1
    let groupCount = 0
    
    if (existsSync(CLAWDBOT_CONFIG_PATH)) {
      const configRaw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
      const config = JSON.parse(configRaw)
      groupCount = config.channels?.whatsapp?.groups ? 
        Object.keys(config.channels.whatsapp.groups).length : 0
    }
    
    return Response.json({
      success: true,
      data: {
        totalConversations: groupCount,
        activeConversations: groupCount,
        totalMessages: 0,
        avgResponseTime: 0,
        resolutionRate: 0,
        channelsActive: channelCount,
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error reading analytics:', error)
    return Response.json({
      success: true,
      data: {
        totalConversations: 0,
        activeConversations: 0,
        totalMessages: 0,
        avgResponseTime: 0,
        resolutionRate: 0,
        channelsActive: 0
      }
    })
  }
}
