import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || 'http://localhost:18789'
const GATEWAY_TOKEN = process.env.CLAWDBOT_GATEWAY_TOKEN || ''

/**
 * POST /api/clawdbot/chat
 * Send a message to Clawdbot via gateway webchat API
 * This is a fallback console when other channels are down
 */
export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 })
    }

    // Send to Clawdbot gateway webchat endpoint
    const response = await sendToGateway(message, sessionId || 'baas-console')
    
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

async function sendToGateway(message: string, sessionId: string): Promise<string> {
  try {
    // Try the gateway webchat API
    const response = await fetch(`${GATEWAY_URL}/api/webchat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {})
      },
      body: JSON.stringify({
        message,
        sessionId,
        source: 'baas-console'
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data.response || data.message || 'Mensagem processada.'
    }

    // Fallback: try /api/chat endpoint
    const fallbackResponse = await fetch(`${GATEWAY_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {})
      },
      body: JSON.stringify({
        message,
        channel: 'webchat',
        userId: sessionId
      })
    })

    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json()
      return data.response || data.message || 'Mensagem processada.'
    }

    // If gateway doesn't have these endpoints, return informative message
    return `📨 Mensagem recebida: "${message}"\n\n⚠️ Gateway webchat API não disponível. Configure o endpoint /api/webchat/message no Clawdbot para habilitar respostas em tempo real.`
  } catch (error) {
    console.error('Gateway connection error:', error)
    return `📨 Mensagem: "${message}"\n\n🔌 Não foi possível conectar ao gateway (${GATEWAY_URL}). Verifique se o Clawdbot está rodando.`
  }
}
