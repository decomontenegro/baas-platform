import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { promises as fs } from 'fs'
import path from 'path'

const CLAWDBOT_CONFIG_PATH = '/root/.clawdbot/clawdbot.json'

interface GroupConfig {
  requireMention?: boolean
  prefix?: string
  model?: string
  enabled?: boolean
}

interface ClawdbotConfig {
  channels?: {
    whatsapp?: {
      groups?: Record<string, GroupConfig>
    }
  }
  [key: string]: unknown
}

/**
 * GET /api/clawdbot/groups
 * Returns all WhatsApp groups from Clawdbot config
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    // Auth error - return 401
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    throw error
  }
  
  try {
    // Try to read Clawdbot config - may not exist on remote servers
    let config: ClawdbotConfig = { channels: { whatsapp: { groups: {} } } }
    
    try {
      const configRaw = await fs.readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
      config = JSON.parse(configRaw)
    } catch (fileError) {
      // Config file doesn't exist on this server - return empty list
      console.warn('Clawdbot config not found:', CLAWDBOT_CONFIG_PATH)
    }
    
    const groups = config.channels?.whatsapp?.groups || {}
    
    // Transform to array with metadata
    const groupsList = Object.entries(groups).map(([id, settings]) => ({
      id,
      name: getGroupName(id),
      requireMention: settings.requireMention ?? true,
      prefix: settings.prefix || null,
      model: settings.model || 'default',
      enabled: settings.enabled !== false,
    }))
    
    // Sort by name
    groupsList.sort((a, b) => a.name.localeCompare(b.name))
    
    return successResponse({
      groups: groupsList,
      total: groupsList.length,
      activeCount: groupsList.filter(g => g.enabled).length,
      mentionRequired: groupsList.filter(g => g.requireMention).length,
    })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return errorResponse('Erro ao buscar grupos', 500)
  }
}

/**
 * PATCH /api/clawdbot/groups
 * Update a group's settings
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    throw error
  }
  
  try {
    const body = await request.json()
    const { groupId, settings } = body
    
    if (!groupId) {
      return errorResponse('groupId é obrigatório', 400)
    }
    
    // Check if config file exists
    try {
      await fs.access(CLAWDBOT_CONFIG_PATH)
    } catch {
      return errorResponse('Clawdbot config not available on this server', 503)
    }
    
    // Read current config
    const configRaw = await fs.readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config: ClawdbotConfig = JSON.parse(configRaw)
    
    // Ensure structure exists
    if (!config.channels) config.channels = {}
    if (!config.channels.whatsapp) config.channels.whatsapp = {}
    if (!config.channels.whatsapp.groups) config.channels.whatsapp.groups = {}
    
    // Update group settings
    const currentSettings = config.channels.whatsapp.groups[groupId] || {}
    config.channels.whatsapp.groups[groupId] = {
      ...currentSettings,
      ...settings,
    }
    
    // Write config back
    await fs.writeFile(
      CLAWDBOT_CONFIG_PATH,
      JSON.stringify(config, null, 2),
      'utf-8'
    )
    
    // TODO: Trigger Clawdbot reload via gateway API
    // await triggerClawdbotReload()
    
    return successResponse({
      groupId,
      settings: config.channels.whatsapp.groups[groupId],
      message: 'Configuração atualizada',
    })
  } catch (error) {
    console.error('Error updating group:', error)
    return errorResponse('Erro ao atualizar grupo', 500)
  }
}

/**
 * POST /api/clawdbot/groups/reload
 * Trigger Clawdbot to reload config
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    throw error
  }
  
  try {
    const gatewayUrl = process.env.CLAWDBOT_GATEWAY_URL || 'http://127.0.0.1:18789'
    const gatewayToken = process.env.CLAWDBOT_GATEWAY_TOKEN
    
    // Call gateway to reload
    const response = await fetch(`${gatewayUrl.replace('ws:', 'http:')}/api/reload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to reload Clawdbot')
    }
    
    return successResponse({ message: 'Clawdbot recarregado' })
  } catch (error) {
    console.error('Error reloading Clawdbot:', error)
    return errorResponse('Erro ao recarregar Clawdbot', 500)
  }
}

// Helper to get friendly group name from ID
function getGroupName(groupId: string): string {
  // TODO: Move to database or config - populate via /api/clawdbot/groups/sync
  const knownGroups: Record<string, string> = {}
  // Groups are fetched dynamically from Clawdbot config
  // This mapping serves as a cache/override for friendly names
  
  return knownGroups[groupId] || groupId.replace('@g.us', '').substring(0, 12) + '...'
}
