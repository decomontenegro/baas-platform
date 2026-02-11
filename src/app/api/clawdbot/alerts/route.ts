import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface Alert {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  status: 'active' | 'acknowledged' | 'resolved'
  type: 'budget' | 'provider' | 'rate_limit' | 'system'
  createdAt: string
}

/**
 * GET /api/clawdbot/alerts
 * Returns system alerts
 */
export async function GET(_request: NextRequest) {
  try {
    // For now, return empty alerts (no issues)
    // In a real system, this would check various conditions
    const alerts: Alert[] = []
    
    // Example: Check if any conditions warrant alerts
    // This could be extended to check real metrics
    
    return Response.json({
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length
      }
    })
  } catch (error) {
    console.error('Error getting alerts:', error)
    return Response.json({
      success: false,
      error: 'Failed to get alerts'
    }, { status: 500 })
  }
}
