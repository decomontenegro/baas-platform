import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || 
  path.join(process.env.HOME || '/root', '.clawdbot', 'clawdbot.json')

interface ProviderInfo {
  id: string
  name: string
  status: 'active' | 'degraded' | 'disabled'
  models: number
  modelList?: string[]
}

/**
 * GET /api/clawdbot/providers
 * Returns real LLM providers from Clawdbot config
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
    const modelsConfig = config.models?.providers || {}
    
    const providers: ProviderInfo[] = []
    
    // Map known providers with nice names
    const providerNames: Record<string, string> = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      groq: 'Groq',
      google: 'Google AI',
      azure: 'Azure OpenAI',
      mistral: 'Mistral AI',
      cohere: 'Cohere',
      replicate: 'Replicate'
    }
    
    for (const [key, value] of Object.entries(modelsConfig)) {
      const providerData = value as { apiKey?: string; models?: Array<{ id: string }> }
      const hasApiKey = !!providerData.apiKey
      const modelCount = providerData.models?.length || 0
      
      providers.push({
        id: key,
        name: providerNames[key] || key.charAt(0).toUpperCase() + key.slice(1),
        status: hasApiKey ? 'active' : 'disabled',
        models: modelCount,
        modelList: providerData.models?.map(m => m.id) || []
      })
    }
    
    return Response.json({
      success: true,
      data: providers,
      meta: {
        total: providers.length,
        active: providers.filter(p => p.status === 'active').length
      }
    })
  } catch (error) {
    console.error('Error reading providers:', error)
    return Response.json({
      success: false,
      error: 'Failed to read providers'
    }, { status: 500 })
  }
}
