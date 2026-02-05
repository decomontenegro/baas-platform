import { ActionHandler, ActionContext, ActionResult, StatusConfig, QuickActionType } from '../types'
import { isChannelMuted, getMuteRemaining } from './mute'
import { prisma } from '@/lib/prisma'

// Bot start time (for uptime calculation)
const botStartTime = new Date()

/**
 * /status - Show bot status in this channel
 */
export const statusHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: StatusConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    const parts: string[] = []
    
    // Header
    parts.push('📊 **Status do Bot**\n')

    // Basic status
    const isMuted = isChannelMuted(context.channelId)
    parts.push(`**Estado:** ${isMuted ? '🔇 Silenciado' : '🟢 Ativo'}`)

    // Mute info if muted
    if (isMuted) {
      const remaining = getMuteRemaining(context.channelId)
      if (remaining) {
        parts.push(`**Volta em:** ${formatDuration(remaining)}`)
      }
    }

    // Uptime
    if (config.showUptime !== false) {
      const uptime = Date.now() - botStartTime.getTime()
      parts.push(`**Uptime:** ${formatUptime(uptime)}`)
    }

    // Channel info
    parts.push(`\n**Canal:** \`${context.channelId}\``)
    
    // Stats
    if (config.showStats !== false) {
      try {
        const stats = await getChannelStats(context)
        
        parts.push('\n📈 **Estatísticas (últimas 24h):**')
        parts.push(`• Mensagens recebidas: ${stats.messagesIn}`)
        parts.push(`• Respostas enviadas: ${stats.messagesOut}`)
        parts.push(`• Tempo médio de resposta: ${stats.avgResponseTime || 'N/A'}`)
        
        if (stats.lastActivity) {
          parts.push(`• Última atividade: ${formatTimeAgo(stats.lastActivity)}`)
        }
      } catch (error) {
        // Stats not available, skip
      }
    }

    // Bot version/info
    parts.push('\n🤖 **Informações:**')
    parts.push(`• Versão: 1.0.0`)
    parts.push(`• Modelo: GPT-4o-mini`)
    parts.push(`• Ambiente: ${process.env.NODE_ENV || 'development'}`)

    return {
      success: true,
      output: parts.join('\n'),
      data: {
        channelId: context.channelId,
        isMuted,
        uptime: Date.now() - botStartTime.getTime(),
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao obter status: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

interface ChannelStats {
  messagesIn: number
  messagesOut: number
  avgResponseTime: string | null
  lastActivity: Date | null
}

/**
 * Get channel statistics
 */
async function getChannelStats(context: ActionContext): Promise<ChannelStats> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  // Try to get stats from analytics
  const dailyStats = await prisma.dailyStats.findFirst({
    where: {
      tenantId: context.tenantId,
      channelId: context.channelId,
      date: {
        gte: oneDayAgo,
      },
    },
    orderBy: { date: 'desc' },
  })

  if (dailyStats) {
    return {
      messagesIn: dailyStats.messagesIn,
      messagesOut: dailyStats.messagesOut,
      avgResponseTime: dailyStats.avgResponseTimeMs 
        ? `${Math.round(dailyStats.avgResponseTimeMs / 1000)}s` 
        : null,
      lastActivity: null,
    }
  }

  // Fallback: count from messages
  const [messagesIn, messagesOut] = await Promise.all([
    prisma.message.count({
      where: {
        conversation: {
          tenantId: context.tenantId,
          channelId: context.channelId,
        },
        role: 'USER',
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.message.count({
      where: {
        conversation: {
          tenantId: context.tenantId,
          channelId: context.channelId,
        },
        role: 'BOT',
        createdAt: { gte: oneDayAgo },
      },
    }),
  ])

  return {
    messagesIn,
    messagesOut,
    avgResponseTime: null,
    lastActivity: null,
  }
}

/**
 * Format uptime duration
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const parts: string[] = []
  
  if (days > 0) parts.push(`${days}d`)
  if (hours % 24 > 0) parts.push(`${hours % 24}h`)
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`)
  if (parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  
  if (minutes > 0) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
  }
  
  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`
}

/**
 * Format time ago
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'agora mesmo'
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min atrás`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  
  const days = Math.floor(hours / 24)
  return `${days} dia${days !== 1 ? 's' : ''} atrás`
}

export const statusAction = {
  type: QuickActionType.STATUS,
  name: 'Status',
  description: 'Mostra o status do bot neste canal',
  trigger: '/status',
  aliases: ['/info', '/estado'],
  handler: statusHandler,
  defaultConfig: {
    showUptime: true,
    showStats: true,
  } as StatusConfig,
  usage: '/status',
  examples: [
    '/status',
  ],
}
