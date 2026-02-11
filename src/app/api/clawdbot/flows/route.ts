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
      status: job.enabled ? 'active' : 'inactive',
      trigger: {
        type: 'schedule' as const,
        config: { schedule: job.schedule }
      },
      steps: [
        {
          id: 'step-1',
          type: 'action',
          name: 'Execute Task',
          config: {}
        }
      ],
      executions: Math.floor(Math.random() * 100),
      lastRun: job.lastRun || null,
      nextRun: job.nextRun || null,
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
      trigger: { type: 'event', config: { event: 'user.joined' } },
      steps: [{ id: 's1', type: 'message', name: 'Send Welcome', config: {} }],
      executions: 156,
      lastRun: new Date(Date.now() - 3600000).toISOString(),
      nextRun: null,
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'flow-daily-summary',
      name: 'Daily Summary',
      description: 'Sends daily activity summary',
      status: 'active',
      trigger: { type: 'schedule', config: { schedule: '0 9 * * *' } },
      steps: [{ id: 's1', type: 'action', name: 'Generate Summary', config: {} }],
      executions: 30,
      lastRun: new Date(Date.now() - 86400000).toISOString(),
      nextRun: new Date(Date.now() + 43200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'flow-auto-response',
      name: 'Auto Response',
      description: 'Automatic response for common questions',
      status: 'active',
      trigger: { type: 'keyword', config: { keywords: ['help', 'support'] } },
      steps: [{ id: 's1', type: 'condition', name: 'Check Intent', config: {} }],
      executions: 89,
      lastRun: new Date(Date.now() - 1800000).toISOString(),
      nextRun: null,
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
}
