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

async function sendViaSession(message: string, sessionId: string): Promise<string> {
  try {
    // Escape message for shell - handle special chars
    const escapedMessage = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
    
    // Use clawdbot agent - talks directly to the agent via Gateway
    // --session-id keeps conversation context
    // --json for parseable output
    const cmd = `clawdbot agent --session-id "${sessionId}" --message "${escapedMessage}" --json 2>&1`
    
    const result = execSync(cmd, {
      timeout: 120000, // 120 second timeout for LLM response (can be slow)
      encoding: 'utf-8',
      env: { ...process.env, HOME: '/root' }
    })
    
    // Parse JSON response
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        // Agent returns response in different fields
        return data.reply || data.response || data.message || data.text || data.content || result.trim()
      }
    } catch {
      // Not JSON, return as-is (might be the actual response)
    }
    
    // Clean up the response - remove any clawdbot CLI noise
    const cleanResult = result
      .split('\n')
      .filter(line => !line.startsWith('🦞') && !line.startsWith('Usage:'))
      .join('\n')
      .trim()
    
    return cleanResult || 'Mensagem processada.'
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorOutput = (error as { stdout?: string; stderr?: string })?.stdout || (error as { stdout?: string; stderr?: string })?.stderr || ''
    
    // Check if it's a timeout (LLM took too long)
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout') || errorMessage.includes('SIGTERM')) {
      return `⏱️ Timeout aguardando resposta do agente. Tente novamente ou use mensagem mais curta.`
    }
    
    // Check for gateway not running
    if (errorOutput.includes('ECONNREFUSED') || errorOutput.includes('connect')) {
      return `🔌 Gateway não está rodando. Execute: clawdbot gateway start`
    }
    
    // Return the actual error output if available
    if (errorOutput) {
      return `⚠️ ${errorOutput.trim()}`
    }
    
    return `🐺 Erro: ${errorMessage}`
  }
}
