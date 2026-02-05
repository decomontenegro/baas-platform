import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analytics/activity
 * Returns recent activity feed for the dashboard
 * Query params: limit (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Get tenant from membership
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { tenantId: true },
    })

    if (!membership) {
      return errorResponse('Tenant não encontrado', 404)
    }

    const tenantId = membership.tenantId

    // Get recent analytics events
    const events = await prisma.analyticsEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    // Get channel info for the events
    const channelIds = [...new Set(events.map(e => e.channelId).filter(Boolean))] as string[]
    const channels = await prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, name: true, type: true },
    })
    const channelMap = new Map(channels.map(c => [c.id, c]))

    // Map events to activity items
    const activity = events.map((event, idx) => {
      const channel = event.channelId ? channelMap.get(event.channelId) : null
      
      // Map event type to activity description
      let type: 'message' | 'channel_created' | 'channel_updated' | 'error' = 'message'
      let description = ''
      
      switch (event.eventType) {
        case 'MESSAGE_IN':
          description = 'Mensagem recebida'
          type = 'message'
          break
        case 'MESSAGE_OUT':
          description = 'Resposta enviada pelo bot'
          type = 'message'
          break
        case 'CONVERSATION_START':
          description = 'Nova conversa iniciada'
          type = 'channel_created'
          break
        case 'CONVERSATION_END':
          description = 'Conversa encerrada'
          type = 'channel_updated'
          break
        case 'HANDOFF_REQUESTED':
          description = 'Atendimento humano solicitado'
          type = 'channel_updated'
          break
        case 'HANDOFF_COMPLETED':
          description = 'Atendimento humano concluído'
          type = 'channel_updated'
          break
        case 'ERROR':
          description = 'Erro no processamento'
          type = 'error'
          break
        case 'FEEDBACK_POSITIVE':
          description = 'Feedback positivo recebido'
          type = 'message'
          break
        case 'FEEDBACK_NEGATIVE':
          description = 'Feedback negativo recebido'
          type = 'message'
          break
        case 'SPECIALIST_INVOKED':
          description = 'Especialista acionado'
          type = 'message'
          break
        case 'API_CALL':
          description = 'Chamada de API externa'
          type = 'message'
          break
        default:
          description = `Evento: ${event.eventType}`
      }

      return {
        id: event.id,
        type,
        description,
        channelId: event.channelId,
        channelName: channel?.name || 'Sistema',
        channelType: channel?.type || null,
        createdAt: event.timestamp.toISOString(),
        data: event.data,
      }
    })

    return successResponse({
      activity,
      total: activity.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching activity:', error)
    return errorResponse('Erro ao buscar atividade', 500)
  }
}
