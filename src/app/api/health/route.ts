import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { checkSystemHealth, quickHealthCheck } from '@/lib/admin-agent/system-health'

/**
 * GET /api/health
 * 
 * Public health check endpoint
 * Returns system status for monitoring tools
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get('detailed') === 'true'
  
  try {
    if (detailed) {
      // Full health check with all dependencies
      const health = await checkSystemHealth()
      
      return NextResponse.json(health, {
        status: health.status === 'healthy' ? 200 : 
                health.status === 'degraded' ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      })
    } else {
      // Quick health check (just database)
      const isHealthy = await quickHealthCheck()
      
      return NextResponse.json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }, {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      })
    }
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  }
}

/**
 * HEAD /api/health
 * 
 * Lightweight health check for load balancers
 */
export async function HEAD() {
  try {
    const isHealthy = await quickHealthCheck()
    return new NextResponse(null, { status: isHealthy ? 200 : 503 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
