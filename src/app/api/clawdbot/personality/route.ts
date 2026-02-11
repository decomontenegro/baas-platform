import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const WORKSPACE = process.env.CLAWD_WORKSPACE || '/root/clawd'

/**
 * GET /api/clawdbot/personality
 * Returns bot personality from workspace files
 */
export async function GET(_request: NextRequest) {
  try {
    let personality = {
      name: 'Lobo',
      emoji: '🐺',
      description: '',
      traits: [] as string[],
      tone: 'casual',
      language: 'pt-BR'
    }
    
    // Try to read SOUL.md
    const soulPath = path.join(WORKSPACE, 'SOUL.md')
    if (existsSync(soulPath)) {
      const soul = await readFile(soulPath, 'utf-8')
      // Extract key info from SOUL.md
      const lines = soul.split('\n').slice(0, 20)
      personality.description = lines.join('\n').substring(0, 500)
    }
    
    // Try to read IDENTITY.md
    const identityPath = path.join(WORKSPACE, 'IDENTITY.md')
    if (existsSync(identityPath)) {
      const identity = await readFile(identityPath, 'utf-8')
      // Parse name and emoji
      const nameMatch = identity.match(/Name:\*?\*?\s*(.+)/i)
      const emojiMatch = identity.match(/Emoji:\*?\*?\s*(.+)/i)
      if (nameMatch) personality.name = nameMatch[1].trim()
      if (emojiMatch) personality.emoji = emojiMatch[1].trim()
    }
    
    // Default traits based on SOUL.md guidance
    personality.traits = [
      'Helpful',
      'Direct',
      'Resourceful',
      'Casual'
    ]
    
    return Response.json({
      success: true,
      data: {
        personality,
        templates: [
          { id: '1', name: 'Assistente Padrão', description: 'Configuração padrão do Lobo' },
          { id: '2', name: 'Formal', description: 'Tom mais formal e profissional' },
          { id: '3', name: 'Técnico', description: 'Foco em explicações técnicas' }
        ]
      }
    })
  } catch (error) {
    console.error('Error reading personality:', error)
    return Response.json({
      success: false,
      error: 'Failed to read personality'
    }, { status: 500 })
  }
}
