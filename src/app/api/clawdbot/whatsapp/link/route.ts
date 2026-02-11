import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const CLAWDBOT_URL = process.env.CLAWDBOT_URL || 'http://localhost:3010'
const CLAWDBOT_TOKEN = process.env.CLAWDBOT_TOKEN || ''

/**
 * POST /api/clawdbot/whatsapp/link
 * Generates a real QR code for WhatsApp linking via Clawdbot
 */
export async function POST(_request: NextRequest) {
  try {
    // Call Clawdbot to start WhatsApp linking process
    const res = await fetch(`${CLAWDBOT_URL}/api/whatsapp/qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLAWDBOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (res.ok) {
      const data = await res.json()
      return Response.json({
        success: true,
        data: {
          qrCode: data.qr || data.qrCode,
          expiresAt: data.expiresAt || new Date(Date.now() + 60000).toISOString(),
          status: 'pending'
        }
      })
    }
    
    // Clawdbot API not available - return instructions
    return Response.json({
      success: false,
      error: 'Clawdbot WhatsApp API not available',
      message: 'Use "clawdbot whatsapp link" command to generate QR code',
      instructions: [
        '1. SSH into the server',
        '2. Run: clawdbot whatsapp link',
        '3. Scan the QR code with WhatsApp'
      ]
    }, { status: 503 })
  } catch (error) {
    console.error('WhatsApp link error:', error)
    return Response.json({
      success: false,
      error: 'Failed to connect to Clawdbot',
      message: 'Ensure Clawdbot gateway is running'
    }, { status: 500 })
  }
}

/**
 * GET /api/clawdbot/whatsapp/link
 * Check WhatsApp connection status
 */
export async function GET(_request: NextRequest) {
  try {
    const res = await fetch(`${CLAWDBOT_URL}/api/whatsapp/status`, {
      headers: {
        'Authorization': `Bearer ${CLAWDBOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (res.ok) {
      const data = await res.json()
      return Response.json({
        success: true,
        data: {
          connected: data.connected || false,
          phone: data.phone || null,
          name: data.name || null,
          lastSeen: data.lastSeen || null
        }
      })
    }
    
    // Try to get status from conversations as fallback
    const convRes = await fetch(`${CLAWDBOT_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${CLAWDBOT_TOKEN}`,
      }
    })
    
    if (convRes.ok) {
      const convData = await convRes.json()
      const hasConversations = convData.conversations?.length > 0 || convData.length > 0
      return Response.json({
        success: true,
        data: {
          connected: hasConversations,
          phone: null,
          name: null,
          lastSeen: hasConversations ? new Date().toISOString() : null
        }
      })
    }
    
    return Response.json({
      success: true,
      data: {
        connected: false,
        phone: null,
        name: null,
        lastSeen: null
      }
    })
  } catch (error) {
    console.error('WhatsApp status error:', error)
    return Response.json({
      success: true,
      data: {
        connected: false,
        phone: null,
        name: null,
        lastSeen: null
      }
    })
  }
}
