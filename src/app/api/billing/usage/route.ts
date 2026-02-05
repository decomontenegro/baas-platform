import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { getCurrentPeriodUsage, getUsageHistory } from '@/lib/billing/usage'
import { getUsageSummary } from '@/lib/billing/limits'

/**
 * GET /api/billing/usage
 * Returns detailed usage for current period
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    
    const months = parseInt(searchParams.get('months') || '1')
    const includeHistory = searchParams.get('history') === 'true'

    // Get current period usage
    const currentUsage = await getCurrentPeriodUsage(tenantId)

    // Get summary (limits + usage)
    const summary = await getUsageSummary(tenantId)

    // Optionally get history
    let history: Awaited<ReturnType<typeof getUsageHistory>> | null = null
    if (includeHistory) {
      history = await getUsageHistory(tenantId, months)
    }

    return successResponse({
      current: {
        period: {
          // Will be filled from subscription data
          start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        },
        messages: {
          sent: currentUsage.messagesSent,
          received: currentUsage.messagesReceived,
          total: currentUsage.totalMessages,
          limit: summary.messages.limit,
          percentage: summary.messages.percentage,
        },
        tokens: {
          input: currentUsage.tokensInput,
          output: currentUsage.tokensOutput,
          total: currentUsage.totalTokens,
          byModel: currentUsage.byModel,
        },
        audio: {
          minutes: Math.round(currentUsage.audioMinutes * 100) / 100,
        },
        storage: {
          usedMB: currentUsage.storageMB,
          limitMB: summary.storage.limit,
          percentage: summary.storage.percentage,
        },
        channels: {
          used: summary.channels.used,
          limit: summary.channels.limit,
          percentage: summary.channels.percentage,
        },
        bots: {
          used: summary.bots.used,
          limit: summary.bots.limit,
          percentage: summary.bots.percentage,
        },
        users: {
          used: summary.users.used,
          limit: summary.users.limit,
          percentage: summary.users.percentage,
        },
        byDay: currentUsage.byDay,
      },
      history,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching usage:', error)
    return errorResponse('Erro ao buscar uso', 500)
  }
}
