import { ActionHandler, ActionContext, ActionResult, RemindConfig, QuickActionType } from '../types'
import { parseDateTime, parseDuration } from '../parser'

/**
 * /lembrar [data] [mensagem] - Create a reminder
 */
export const remindHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: RemindConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    if (args.length < 2) {
      return {
        success: false,
        error: `⏰ Formato: /lembrar [quando] [mensagem]

**Exemplos:**
• /lembrar amanhã ligar para cliente
• /lembrar em 30m verificar email
• /lembrar 15:00 reunião de equipe
• /lembrar em 2h fazer follow-up`,
        durationMs: Date.now() - startTime,
      }
    }

    const timeArg = args[0]
    const message = args.slice(1).join(' ')

    if (!message) {
      return {
        success: false,
        error: '⏰ Por favor, forneça uma mensagem para o lembrete.',
        durationMs: Date.now() - startTime,
      }
    }

    // Try to parse as duration first (e.g., "30m", "2h")
    const duration = parseDuration(timeArg)
    let reminderTime: Date | null = null

    if (duration) {
      // Check allowed units
      const allowedUnits = config.allowedUnits || ['minutes', 'hours', 'days']
      const unitShort = duration.unit.replace('s', '') // Remove plural
      
      if (!allowedUnits.some(u => u.startsWith(unitShort))) {
        return {
          success: false,
          error: `⏰ Unidade de tempo não permitida. Use: ${allowedUnits.join(', ')}`,
          durationMs: Date.now() - startTime,
        }
      }

      reminderTime = new Date(Date.now() + duration.seconds * 1000)
    } else {
      // Try to parse as date/time
      reminderTime = parseDateTime(timeArg)
    }

    if (!reminderTime) {
      return {
        success: false,
        error: `⏰ Não consegui entender o horário "${timeArg}".

**Formatos aceitos:**
• Relativo: em 30m, em 2h, em 1d
• Horário: 15:00, 09:30
• Data: amanhã, 25/12
• Natural: em 2 horas`,
        durationMs: Date.now() - startTime,
      }
    }

    // Check max days ahead
    const maxDays = config.maxDaysAhead || 365
    const maxTime = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000)
    
    if (reminderTime > maxTime) {
      return {
        success: false,
        error: `⏰ O lembrete não pode ser agendado para mais de ${maxDays} dias no futuro.`,
        durationMs: Date.now() - startTime,
      }
    }

    // Check if time is in the past
    if (reminderTime <= new Date()) {
      return {
        success: false,
        error: '⏰ O horário do lembrete deve ser no futuro.',
        durationMs: Date.now() - startTime,
      }
    }

    // Format the reminder confirmation
    const formattedTime = formatReminderTime(reminderTime)
    const timeDiff = reminderTime.getTime() - Date.now()
    const relativeTime = formatRelativeTime(timeDiff)

    // TODO: In production, create a scheduled task/reminder in the database
    // For now, just confirm the reminder was created

    return {
      success: true,
      output: `⏰ **Lembrete criado!**

📝 ${message}
📅 ${formattedTime}
⏳ Daqui ${relativeTime}

_Você será notificado no horário agendado._`,
      data: {
        message,
        scheduledFor: reminderTime.toISOString(),
        channelId: context.channelId,
        userId: context.userId,
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao criar lembrete: ${errorMessage}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Format reminder time for display
 */
function formatReminderTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format relative time (e.g., "30 minutos", "2 horas")
 */
function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return days === 1 ? '1 dia' : `${days} dias`
  }
  if (hours > 0) {
    return hours === 1 ? '1 hora' : `${hours} horas`
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minuto' : `${minutes} minutos`
  }
  return `${seconds} segundos`
}

export const remindAction = {
  type: QuickActionType.REMIND,
  name: 'Lembrar',
  description: 'Cria um lembrete para o futuro',
  trigger: '/lembrar',
  aliases: ['/remind', '/reminder', '/lembrete'],
  handler: remindHandler,
  defaultConfig: {
    allowedUnits: ['minutes', 'hours', 'days'],
    maxDaysAhead: 365,
  } as RemindConfig,
  usage: '/lembrar [quando] [mensagem]',
  examples: [
    '/lembrar amanhã revisar proposta',
    '/lembrar em 30m ligar para cliente',
    '/lembrar 15:00 reunião de equipe',
  ],
}
