import { NextRequest } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const WORKSPACE_PATH = process.env.CLAWDBOT_WORKSPACE || '/root/clawd'
const SOUL_PATH = path.join(WORKSPACE_PATH, 'SOUL.md')
const IDENTITY_PATH = path.join(WORKSPACE_PATH, 'IDENTITY.md')

/**
 * GET /api/clawdbot/agent/soul
 * Returns current agent persona (SOUL.md + IDENTITY.md)
 */
export async function GET(_request: NextRequest) {
  try {
    let soul = ''
    let identity = ''
    
    if (existsSync(SOUL_PATH)) {
      soul = await readFile(SOUL_PATH, 'utf-8')
    }
    
    if (existsSync(IDENTITY_PATH)) {
      identity = await readFile(IDENTITY_PATH, 'utf-8')
    }
    
    // Parse identity for structured data
    const nameMatch = identity.match(/\*\*Name:\*\*\s*(.+)/i)
    const vibeMatch = identity.match(/\*\*Vibe:\*\*\s*(.+)/i)
    const emojiMatch = identity.match(/\*\*Emoji:\*\*\s*(.+)/i)
    
    return Response.json({
      success: true,
      data: {
        soul: soul,
        identity: identity,
        parsed: {
          name: nameMatch?.[1]?.trim() || 'Agent',
          vibe: vibeMatch?.[1]?.trim() || 'Casual, direct, resourceful',
          emoji: emojiMatch?.[1]?.trim() || '🤖'
        }
      }
    })
  } catch (error) {
    console.error('Soul read error:', error)
    return Response.json({
      success: false,
      error: 'Failed to read agent config'
    }, { status: 500 })
  }
}

/**
 * POST /api/clawdbot/agent/soul
 * Updates agent persona
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { soul, identity, name, vibe, emoji } = body
    
    // Update SOUL.md if provided
    if (soul) {
      await writeFile(SOUL_PATH, soul)
    }
    
    // Update IDENTITY.md if provided or build from fields
    if (identity) {
      await writeFile(IDENTITY_PATH, identity)
    } else if (name || vibe || emoji) {
      // Build identity from fields
      const identityContent = `# IDENTITY.md - Who Am I?

- **Name:** ${name || 'Agent'}
- **Creature:** AI assistant
- **Vibe:** ${vibe || 'Casual, direct, resourceful. No fluff.'}
- **Emoji:** ${emoji || '🤖'}

---

*This identity was configured via BaaS.*
`
      await writeFile(IDENTITY_PATH, identityContent)
    }
    
    return Response.json({
      success: true,
      message: 'Agent persona updated',
      files: {
        soul: soul ? 'updated' : 'unchanged',
        identity: (identity || name || vibe || emoji) ? 'updated' : 'unchanged'
      }
    })
  } catch (error) {
    console.error('Soul update error:', error)
    return Response.json({
      success: false,
      error: 'Failed to update agent config'
    }, { status: 500 })
  }
}
