/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Admin Agent - Cron Control API
 * 
 * Endpoints:
 * - GET  /api/admin/cron        - Get cron status
 * - POST /api/admin/cron/start  - Start cron scheduler
 * - POST /api/admin/cron/stop   - Stop cron scheduler
 * - POST /api/admin/cron/run    - Trigger manual run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  startCron, 
  stopCron, 
  getCronStatus, 
  triggerManualRun,
  isExecuting 
} from '@/lib/admin-agent/cron'

// Helper to check admin access
async function checkAdminAccess(): Promise<{ 
  authorized: boolean
  error?: NextResponse 
}> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { 
      authorized: false, 
      error: NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }
  }
  
  // Only OWNER and ADMIN can control cron
  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
    return { 
      authorized: false, 
      error: NextResponse.json(
        { error: 'Forbidden: Admin access required' }, 
        { status: 403 }
      )
    }
  }
  
  return { authorized: true }
}

/**
 * GET /api/admin/cron
 * Get current cron status
 */
export async function GET() {
  const { authorized, error } = await checkAdminAccess()
  if (!authorized) return error

  try {
    const status = getCronStatus()
    
    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (err) {
    console.error('[API] Error getting cron status:', err)
    return NextResponse.json(
      { error: 'Failed to get cron status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/cron
 * Control cron: start, stop, or trigger manual run
 */
export async function POST(request: NextRequest) {
  const { authorized, error } = await checkAdminAccess()
  if (!authorized) return error

  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action as string
    
    switch (action) {
      case 'start': {
        const schedule = body.schedule as string | undefined
        const started = startCron(schedule)
        
        return NextResponse.json({
          success: started,
          message: started 
            ? 'Cron scheduler started' 
            : 'Failed to start cron scheduler',
          data: getCronStatus()
        })
      }
      
      case 'stop': {
        const stopped = stopCron()
        
        return NextResponse.json({
          success: stopped,
          message: stopped 
            ? 'Cron scheduler stopped' 
            : 'No active scheduler to stop',
          data: getCronStatus()
        })
      }
      
      case 'run': {
        if (isExecuting()) {
          return NextResponse.json({
            success: false,
            error: 'Health check already in progress'
          }, { status: 409 })
        }
        
        const results = await triggerManualRun()
        
        return NextResponse.json({
          success: true,
          message: `Health check completed for ${results.length} tenants`,
          data: {
            results,
            summary: {
              totalTenants: results.length,
              totalHealthy: results.reduce((sum, r) => sum + r.healthy, 0),
              totalDegraded: results.reduce((sum, r) => sum + r.degraded, 0),
              totalUnhealthy: results.reduce((sum, r) => sum + r.unhealthy, 0),
              totalDead: results.reduce((sum, r) => sum + r.dead, 0),
              totalActions: results.reduce((sum, r) => sum + r.actions.length, 0),
              errors: results.filter(r => r.error).length
            }
          }
        })
      }
      
      case 'status': {
        return NextResponse.json({
          success: true,
          data: getCronStatus()
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: start, stop, run, or status',
          validActions: ['start', 'stop', 'run', 'status']
        }, { status: 400 })
    }
  } catch (err) {
    console.error('[API] Error in cron control:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
