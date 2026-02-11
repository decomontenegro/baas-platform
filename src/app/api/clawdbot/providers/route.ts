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
    const authConfig = config.auth?.profiles || {}
    const authOrder = config.auth?.order || {}
    
    const providers: ProviderInfo[] = []
    
    // Map known providers with nice names
    const providerNames: Record<string, string> = {
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI',
      groq: 'Groq',
      google: 'Google AI',
      azure: 'Azure OpenAI',
      mistral: 'Mistral AI',
      cohere: 'Cohere',
      replicate: 'Replicate'
    }
    
    // 1. Get providers from models.providers (custom providers)
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
    
    // 2. Get providers from auth.profiles (OAuth/API key providers)
    const authProviders = new Set<string>()
    for (const [profileKey, profile] of Object.entries(authConfig)) {
      const providerName = (profile as { provider: string }).provider
      authProviders.add(providerName)
    }
    
    for (const providerName of authProviders) {
      // Skip if already added from models.providers
      if (providers.some(p => p.id === providerName)) continue
      
      const profileCount = Object.values(authConfig).filter(
        (p: unknown) => (p as { provider: string }).provider === providerName
      ).length
      
      providers.push({
        id: providerName,
        name: providerNames[providerName] || providerName.charAt(0).toUpperCase() + providerName.slice(1),
        status: 'active',
        models: profileCount, // Number of auth profiles
        modelList: [`${profileCount} auth profile(s) configured`]
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
