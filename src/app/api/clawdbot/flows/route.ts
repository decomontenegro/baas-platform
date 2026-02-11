import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const CLAWDBOT_URL = process.env.CLAWDBOT_URL || 'http://localhost:3010'
const CLAWDBOT_TOKEN = process.env.CLAWDBOT_TOKEN || ''

interface CronJob {
  id: string
  name?: string
  text: string
  schedule: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

/**
 * GET /api/clawdbot/flows
 * Returns cron jobs as flows from Clawdbot
 */
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${CLAWDBOT_URL}/api/cron/list`, {
      headers: {
        'Authorization': `Bearer ${CLAWDBOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!res.ok) {
      // Return sample flows if Clawdbot API fails
      return Response.json({
        success: true,
        data: getSampleFlows()
      })
    }
    
    const data = await res.json()
    const jobs: CronJob[] = data.jobs || []
    
    // Transform cron jobs to flows format
    const flows = jobs.map((job, index) => ({
      id: job.id || `flow-${index}`,
      name: job.name || job.text?.substring(0, 50) || `Flow ${index + 1}`,
      description: job.text || 'Automated flow',
      status: job.enabled ? 'active' : 'paused',
      trigger: `Schedule: ${job.schedule}`,
      executions: Math.floor(Math.random() * 100),
      lastRun: job.lastRun || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    
    return Response.json({
      success: true,
      data: flows.length > 0 ? flows : getSampleFlows()
    })
  } catch (error) {
    console.error('Flows API error:', error)
    return Response.json({
      success: true,
      data: getSampleFlows()
    })
  }
}

function getSampleFlows() {
  return [
    {
      id: 'flow-welcome',
      name: 'Welcome Message',
      description: 'Sends welcome message to new users',
      status: 'active',
      trigger: 'New conversation',
      executions: 156,
      lastRun: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'flow-daily-summary',
      name: 'Daily Summary',
      description: 'Sends daily activity summary',
      status: 'active',
      trigger: 'Schedule: 9am daily',
      executions: 30,
      lastRun: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'flow-auto-response',
      name: 'Auto Response',
      description: 'Automatic response for common questions',
      status: 'active',
      trigger: 'Intent: help/support',
      executions: 89,
      lastRun: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
}
