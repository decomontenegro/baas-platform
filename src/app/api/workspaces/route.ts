import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workspaces
 * Falls back to Clawdbot data when database is not available
 */
export async function GET(request: NextRequest) {
  // Redirect to clawdbot config for workspace info
  const baseUrl = request.nextUrl.origin
  
  try {
    const statsRes = await fetch(`${baseUrl}/api/clawdbot/stats`)
    const statsData = await statsRes.json()
    
    if (statsData.success) {
      // Create a virtual workspace from Clawdbot data
      // Return in format expected by hooks
      return Response.json({
        data: [{
          id: 'clawdbot-workspace',
          name: 'Clawdbot Workspace',
          slug: 'clawdbot',
          description: 'Workspace principal do Clawdbot',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: {
            Channel: statsData.data?.channels?.total || 0,
            Conversation: statsData.data?.conversations?.total || 0
          }
        }],
        meta: {
          total: 1,
          page: 1,
          limit: 100
        }
      })
    }
  } catch (error) {
    console.error('Error fetching Clawdbot stats:', error)
  }
  
  // Fallback empty response
  return Response.json({
    data: [],
    meta: { total: 0, page: 1, limit: 100 }
  })
}

export async function POST(request: NextRequest) {
  return Response.json({
    success: false,
    error: 'Workspace creation not available in Clawdbot mode'
  }, { status: 400 })
}
