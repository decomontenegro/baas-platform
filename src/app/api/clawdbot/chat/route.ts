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

async function sendViaSession(message: string, _label: string): Promise<string> {
  try {
    // Escape message for shell - handle special chars
    const escapedMessage = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
    
    // Use clawdbot message send - talks directly to the agent
    // This sends via webchat/web session
    const cmd = `clawdbot message send --message "${escapedMessage}" --json 2>&1`
    
    const result = execSync(cmd, {
      timeout: 60000, // 60 second timeout for LLM response
      encoding: 'utf-8',
      env: { ...process.env, HOME: '/root' }
    })
    
    // Parse JSON response if available
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return data.response || data.message || data.text || result.trim()
      }
    } catch {
      // Not JSON, return as-is
    }
    
    return result.trim() || 'Mensagem processada.'
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's a timeout (LLM took too long)
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      return `⏱️ Timeout aguardando resposta do agente. A mensagem foi enviada mas a resposta demorou demais.`
    }
    
    // Final fallback
    return `🐺 Mensagem recebida: "${message}"\n\n⚠️ Erro ao processar: ${errorMessage}`
  }
}
