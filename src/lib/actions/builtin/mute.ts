import { ActionHandler, ActionContext, ActionResult, MuteConfig, QuickActionType, MuteState } from '../types'
import { parseDuration } from '../parser'

// In-memory mute state (in production, use Redis or database)
const muteStates = new Map<string, MuteState>()

/**
 * Check if a channel is currently muted
 */
export function isChannelMuted(channelId: string): boolean {
  const state = muteStates.get(channelId)
  if (!state) return false
  
  if (new Date() >= state.mutedUntil) {
    muteStates.delete(channelId)
    return false
  }
  
  return true
}

/**
 * Get remaining mute time in seconds
 */
export function getMuteRemaining(channelId: string): number | null {
  const state = muteStates.get(channelId)
  if (!state) return null
  
  const remaining = state.mutedUntil.getTime() - Date.now()
  if (remaining <= 0) {
    muteStates.delete(channelId)
    return null
  }
  
  return Math.ceil(remaining / 1000)
}

/**
 * Unmute a channel
 */
export function unmuteChannel(channelId: string): boolean {
  return muteStates.delete(channelId)
}

/**
 * /silenciar [tempo] - Mute bot in this channel
 */
export const muteHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: MuteConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    const timeArg = args[0]
    
    // Check if requesting unmute
    if (timeArg === 'off' || timeArg === 'desligar' || timeArg === 'parar') {
      const wasMuted = unmuteChannel(context.channelId)
      
      return {
        success: true,
        output: wasMuted 
          ? '🔊 Bot reativado! Voltei a responder normalmente.'
          : '🔊 O bot já está ativo neste canal.',
        durationMs: Date.now() - startTime,
      }
    }

    // Check current mute status
    if (!timeArg || timeArg === 'status') {
      const remaining = getMuteRemaining(context.channelId)
      
      if (remaining) {
        return {
          success: true,
          output: `🔇 Bot silenciado por mais ${formatDuration(remaining)}.

Use \`/silenciar off\` para reativar.`,
          durationMs: Date.now() - startTime,
        }
      }
      
      return {
        success: true,
        output: `🔊 O bot está ativo neste canal.

**Para silenciar:**
/silenciar [tempo]

**Exemplos:**
• /silenciar 30m - silencia por 30 minutos
• /silenciar 2h - silencia por 2 horas
• /silenciar off - reativa o bot`,
        durationMs: Date.now() - startTime,
      }
    }

    // Parse duration
    const duration = parseDuration(timeArg)
    
    if (!duration) {
      return {
        success: false,
        error: `⏱️ Formato de tempo inválido: "${timeArg}"

**Use:**
• Minutos: 30m, 15min
• Horas: 1h, 2hr
• Segundos: 60s

**Exemplo:** /silenciar 30m`,
        durationMs: Date.now() - startTime,
      }
    }

    // Check max duration
    const maxDuration = config.maxDurationSeconds || 3600 // 1 hour default
    
    if (duration.seconds > maxDuration) {
      return {
        success: false,
        error: `⏱️ Duração máxima permitida: ${formatDuration(maxDuration)}`,
        durationMs: Date.now() - startTime,
      }
    }

    // Apply mute
    const mutedUntil = new Date(Date.now() + duration.seconds * 1000)
    
    muteStates.set(context.channelId, {
      channelId: context.channelId,
      mutedUntil,
      mutedBy: context.userId,
    })

    return {
      success: true,
      output: `🔇 Bot silenciado por ${duration.value} ${formatUnit(duration.unit)}.

Voltarei a responder às ${mutedUntil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.

Use \`/silenciar off\` para reativar antes.`,
      data: {
        mutedUntil: mutedUntil.toISOString(),
        durationSeconds: duration.seconds,
        channelId: context.channelId,
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao silenciar: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`
  }
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (remainingMinutes === 0) {
    return `${hours} hora${hours !== 1 ? 's' : ''}`
  }
  
  return `${hours}h${remainingMinutes}m`
}

/**
 * Format unit name in Portuguese
 */
function formatUnit(unit: string): string {
  const units: Record<string, string> = {
    seconds: 'segundos',
    minutes: 'minutos',
    hours: 'horas',
    days: 'dias',
  }
  
  return units[unit] || unit
}

export const muteAction = {
  type: QuickActionType.MUTE,
  name: 'Silenciar',
  description: 'Silencia o bot temporariamente neste canal',
  trigger: '/silenciar',
  aliases: ['/mute', '/quiet', '/pause'],
  handler: muteHandler,
  defaultConfig: {
    maxDurationSeconds: 3600, // 1 hour
    defaultDurationSeconds: 300, // 5 minutes
  } as MuteConfig,
  usage: '/silenciar [tempo]',
  examples: [
    '/silenciar 30m',
    '/silenciar 1h',
    '/silenciar off',
    '/silenciar status',
  ],
}
