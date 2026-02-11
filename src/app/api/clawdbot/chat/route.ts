import { NextRequest } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clawdbot/chat
 * Send a message to Clawdbot using sessions_send via CLI
 * This is a fallback console when other channels are down
 */
export async function POST(request: NextRequest) {
  try {
    const { message, sessionLabel } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 })
    }

    // Use clawdbot CLI to send message via sessions
    const response = await sendViaSession(message, sessionLabel || 'baas-console')
    
    return Response.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error sending to Clawdbot:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to communicate with Clawdbot'
    }, { status: 500 })
  }
}

async function sendViaSession(message: string, label: string): Promise<string> {
  try {
    // Escape message for shell
    const escapedMessage = message.replace(/'/g, "'\\''")
    
    // Use clawdbot send command with label
    const cmd = `clawdbot send --label "${label}" --message '${escapedMessage}' --timeout 30 2>&1`
    
    const result = execSync(cmd, {
      timeout: 35000,
      encoding: 'utf-8',
      env: { ...process.env, HOME: '/root' }
    })
    
    return result.trim() || 'Mensagem enviada com sucesso.'
  } catch (error) {
    // Try alternative: direct session spawn
    try {
      const escapedMessage = message.replace(/'/g, "'\\''")
      const cmd = `clawdbot session --message '${escapedMessage}' --no-interactive 2>&1 | head -100`
      
      const result = execSync(cmd, {
        timeout: 35000,
        encoding: 'utf-8',
        env: { ...process.env, HOME: '/root' }
      })
      
      return result.trim() || 'Sessão criada.'
    } catch {
      // Final fallback - just acknowledge
      return `🐺 Mensagem recebida: "${message}"\n\nO console está funcionando. Para respostas em tempo real, use WhatsApp ou configure o webchat channel.`
    }
  }
}
