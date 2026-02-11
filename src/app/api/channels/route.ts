import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/channels
 * Falls back to Clawdbot channels when database is not available
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  
  try {
    const res = await fetch(`${baseUrl}/api/clawdbot/channels`)
    const data = await res.json()
    
    if (data.success && data.data) {
      // Transform to expected format
      const channels = data.data.map((ch: { id: string; name: string; type: string; status: string; groups?: number }) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type.toUpperCase(),
        status: ch.status === 'connected' ? 'ACTIVE' : 'INACTIVE',
        isActive: ch.status === 'connected',
        WorkspaceId: 'clawdbot-workspace',
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: {
          Conversation: ch.groups || 0
        }
      }))
      
      // Return in format expected by hooks
      return Response.json({
        data: channels,
        meta: {
          total: channels.length,
          connected: channels.filter((c: { status: string }) => c.status === 'ACTIVE').length
        }
      })
    }
  } catch (error) {
    console.error('Error fetching channels:', error)
  }
  
  return Response.json({
    data: [],
    meta: { total: 0 }
  })
}
