import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { runSchedulerWorker } from '@/lib/workers/scheduler'
import { handleApiError, apiResponse, UnauthorizedError } from '@/lib/api/errors'

/**
 * POST /api/cron/scheduler
 * 
 * Processes scheduled messages and campaigns.
 * Should be called by a cron job every minute.
 * 
 * Authentication via CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret') || 
                       request.headers.get('authorization')?.replace('Bearer ', '')
    
    const expectedSecret = process.env.CRON_SECRET

    // In development, allow requests without secret
    if (process.env.NODE_ENV === 'production' && expectedSecret) {
      if (cronSecret !== expectedSecret) {
        throw new UnauthorizedError('Invalid cron secret')
      }
    }

    // Run the scheduler worker
    const result = await runSchedulerWorker()

    return apiResponse({
      success: true,
      timestamp: new Date().toISOString(),
      scheduledMessages: {
        processed: result.scheduledMessages.processed,
        sent: result.scheduledMessages.sent,
        failed: result.scheduledMessages.failed,
        errors: result.scheduledMessages.errors.slice(0, 10), // Limit error details
      },
      campaigns: {
        campaignsProcessed: result.campaigns.campaignsProcessed,
        messagesSent: result.campaigns.messagesSent,
        messagesFailed: result.campaigns.messagesFailed,
        errors: result.campaigns.errors.slice(0, 10),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET endpoint for health check
export async function GET() {
  return apiResponse({
    status: 'ok',
    endpoint: '/api/cron/scheduler',
    description: 'POST to this endpoint to process scheduled messages and campaigns',
    environment: process.env.NODE_ENV,
  })
}
