import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const CLAWDBOT_CONFIG_PATH = process.env.CLAWDBOT_CONFIG_PATH || '/root/.clawdbot/clawdbot.json'

/**
 * GET /api/clawdbot/conversations
 * Returns conversations/groups from Clawdbot WhatsApp
 */
export async function GET(_request: NextRequest) {
  try {
    if (!existsSync(CLAWDBOT_CONFIG_PATH)) {
      return Response.json({
        success: true,
        data: [],
        meta: { total: 0 }
      })
    }
    
    const configRaw = await readFile(CLAWDBOT_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configRaw)
    
    const groups = config.channels?.whatsapp?.groups || {}
    const conversations = Object.entries(groups).map(([id, groupConfig]) => {
      const gc = groupConfig as { name?: string; requireMention?: boolean }
      return {
        id,
        name: gc.name || id,
        type: 'group',
        channel: 'whatsapp',
        status: 'active',
        requireMention: gc.requireMention ?? true,
        lastActivity: new Date().toISOString(),
        messageCount: 0,
        unreadCount: 0
      }
    })
    
    return Response.json({
      success: true,
      data: conversations,
      meta: {
        total: conversations.length,
        active: conversations.length,
        handoff: 0,
        unread: 0
      }
    })
  } catch (error) {
    console.error('Error reading conversations:', error)
    return Response.json({
      success: true,
      data: [],
      meta: { total: 0, active: 0, handoff: 0, unread: 0 }
    })
  }
}
