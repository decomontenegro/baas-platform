import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clawdbot/chat
 * Send a message to Clawdbot and get response
 * This is a fallback console when other channels are down
 */
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 })
    }

    // Use clawdbot CLI to send message
    // This creates a webchat-style session
    const response = await sendToClawdbot(message)
    
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

async function sendToClawdbot(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use clawdbot chat command with webchat channel
    const proc = spawn('clawdbot', ['chat', '--channel', 'webchat', '--message', message], {
      timeout: 60000, // 60 second timeout
      env: { ...process.env }
    })
    
    let stdout = ''
    let stderr = ''
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim() || 'Comando executado com sucesso.')
      } else {
        // If clawdbot chat doesn't work, try alternative approach
        // For now, return a helpful message
        resolve(`Processando: "${message}"\n\nNota: Console em modo de desenvolvimento. Use o gateway diretamente para comandos completos.`)
      }
    })
    
    proc.on('error', (err) => {
      reject(err)
    })
  })
}
