import { NextRequest } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || 
  path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')

/**
 * GET /api/clawdbot/config
 * Returns current Clawdbot configuration (sanitized)
 */
export async function GET(_request: NextRequest) {
  try {
    if (!existsSync(CLAWDBOT_CONFIG_PATH)) {
      return Response.json({
        success: false,
        error: 'Config file not found',
        path: CLAWDBOT_CONFIG_PATH
      }, { status: 404 })
    }
    
    const raw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(raw)
    
    // Sanitize - remove sensitive data
    const sanitized = {
      models: {
        providers: Object.keys(config.models?.providers || {}).map(name => ({
          name,
          hasApiKey: !!config.models?.providers[name]?.apiKey,
          models: config.models?.providers[name]?.models?.map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name
          })) || []
        }))
      },
      channels: {
        whatsapp: {
          enabled: !!config.channels?.whatsapp,
          groupsCount: Object.keys(config.channels?.whatsapp?.groups || {}).length
        },
        telegram: {
          enabled: !!config.channels?.telegram
        }
      },
      gateway: {
        port: config.gateway?.port,
        host: config.gateway?.host
      },
      agents: Object.keys(config.agents || {})
    }
    
    return Response.json({
      success: true,
      data: sanitized
    })
  } catch (error) {
    console.error('Config read error:', error)
    return Response.json({
      success: false,
      error: 'Failed to read config'
    }, { status: 500 })
  }
}

/**
 * POST /api/clawdbot/config
 * Updates Clawdbot configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { section, data } = body
    
    if (!section || !data) {
      return Response.json({
        success: false,
        error: 'Missing section or data'
      }, { status: 400 })
    }
    
    // Read current config
    const raw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(raw)
    
    // Update section
    switch (section) {
      case 'llm':
        // Update LLM provider
        if (data.provider && data.apiKey) {
          if (!config.models) config.models = { providers: {} }
          if (!config.models.providers) config.models.providers = {}
          
          config.models.providers[data.provider] = {
            ...config.models.providers[data.provider],
            apiKey: data.apiKey,
            ...(data.baseUrl && { baseUrl: data.baseUrl })
          }
        }
        break
        
      case 'gateway':
        // Update gateway settings
        if (!config.gateway) config.gateway = {}
        config.gateway = { ...config.gateway, ...data }
        break
        
      case 'channels':
        // Update channel config
        if (!config.channels) config.channels = {}
        config.channels = { ...config.channels, ...data }
        break
        
      default:
        return Response.json({
          success: false,
          error: `Unknown section: ${section}`
        }, { status: 400 })
    }
    
    // Write updated config
    await writeFile(CLAWDBOT_CONFIG_PATH, JSON.stringify(config, null, 2))
    
    return Response.json({
      success: true,
      message: `Config section '${section}' updated`,
      requiresRestart: true
    })
  } catch (error) {
    console.error('Config update error:', error)
    return Response.json({
      success: false,
      error: 'Failed to update config'
    }, { status: 500 })
  }
}
