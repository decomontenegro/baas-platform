import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || 
  path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')

/**
 * GET /api/clawdbot/config
 * Returns real Clawdbot configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') // channels, agents, models, etc.
    
    if (!existsSync(CLAWDBOT_CONFIG_PATH)) {
      return Response.json({
        success: false,
        error: 'Clawdbot config not found',
        path: CLAWDBOT_CONFIG_PATH
      }, { status: 404 })
    }
    
    const configRaw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configRaw)
    
    // If section specified, return only that section
    if (section) {
      if (!config[section]) {
        return Response.json({
          success: false,
          error: `Section '${section}' not found in config`
        }, { status: 404 })
      }
      return Response.json({
        success: true,
        data: config[section]
      })
    }
    
    // Return summary (not full config for security)
    return Response.json({
      success: true,
      data: {
        channels: Object.keys(config.channels || {}),
        hasWhatsApp: !!config.channels?.whatsapp,
        hasTelegram: !!config.channels?.telegram,
        hasDiscord: !!config.channels?.discord,
        hasSlack: !!config.channels?.slack,
        agentCount: Object.keys(config.agents || {}).length,
        modelCount: Object.keys(config.models || {}).length,
        skillCount: (config.skills?.custom || []).length,
        gateway: {
          configured: !!config.gateway,
          port: config.gateway?.port
        }
      }
    })
  } catch (error) {
    console.error('Error reading Clawdbot config:', error)
    return Response.json({
      success: false,
      error: 'Failed to read config'
    }, { status: 500 })
  }
}
