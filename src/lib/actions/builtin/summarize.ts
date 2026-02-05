import { ActionHandler, ActionContext, ActionResult, SummarizeConfig, QuickActionType } from '../types'

/**
 * /resumo - Summarize recent messages in a conversation
 */
export const summarizeHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: SummarizeConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    const messageCount = args[0] ? parseInt(args[0], 10) : (config.messageCount || 20)
    const maxLength = config.maxLength || 500
    const language = config.language || 'pt-BR'
    
    // Validate message count
    if (isNaN(messageCount) || messageCount < 1 || messageCount > 100) {
      return {
        success: false,
        error: 'Número de mensagens inválido. Use um valor entre 1 e 100.',
        durationMs: Date.now() - startTime,
      }
    }

    const messages = context.recentMessages || []
    
    if (messages.length === 0) {
      return {
        success: true,
        output: '📭 Não há mensagens recentes para resumir.',
        durationMs: Date.now() - startTime,
      }
    }

    // Take the last N messages
    const relevantMessages = messages.slice(-messageCount)
    
    // Filter out system messages and format for summarization
    const formattedMessages = relevantMessages
      .filter(m => m.role !== 'system')
      .map(m => {
        const sender = m.senderName || (m.role === 'bot' ? '🤖 Bot' : '👤 Usuário')
        const time = config.includeTimestamps 
          ? ` [${new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}]`
          : ''
        return `${sender}${time}: ${m.content}`
      })
      .join('\n')

    if (!formattedMessages) {
      return {
        success: true,
        output: '📭 Não há mensagens de usuários para resumir.',
        durationMs: Date.now() - startTime,
      }
    }

    // For now, create a simple summary (in production, use AI)
    // This is a placeholder - should integrate with AI service
    const summary = createSimpleSummary(relevantMessages, maxLength, language)

    return {
      success: true,
      output: `📋 **Resumo das últimas ${relevantMessages.length} mensagens:**\n\n${summary}`,
      data: {
        messageCount: relevantMessages.length,
        originalLength: formattedMessages.length,
        summaryLength: summary.length,
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao resumir mensagens: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Create a simple extractive summary (placeholder for AI-powered summary)
 */
function createSimpleSummary(
  messages: { content: string; role: string; senderName?: string }[],
  maxLength: number,
  language: string
): string {
  // Group messages by role
  const userMessages = messages.filter(m => m.role === 'user')
  const botMessages = messages.filter(m => m.role === 'bot')
  
  // Count participants
  const participants = new Set(messages.map(m => m.senderName).filter(Boolean))
  
  // Simple extractive summary
  const parts: string[] = []
  
  // Stats
  const stats = `Participantes: ${participants.size || 'N/A'} | Mensagens de usuários: ${userMessages.length} | Respostas do bot: ${botMessages.length}`
  parts.push(stats)
  
  // Main topics (simple keyword extraction - should use AI in production)
  if (userMessages.length > 0) {
    const allUserText = userMessages.map(m => m.content).join(' ').toLowerCase()
    const words = allUserText
      .split(/\s+/)
      .filter(w => w.length > 4)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    
    const topWords = Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
    
    if (topWords.length > 0) {
      parts.push(`\nTópicos principais: ${topWords.join(', ')}`)
    }
  }

  // Last messages preview
  const lastMessages = messages.slice(-3)
  if (lastMessages.length > 0) {
    parts.push('\nÚltimas mensagens:')
    lastMessages.forEach(m => {
      const sender = m.senderName || (m.role === 'bot' ? 'Bot' : 'Usuário')
      const preview = m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content
      parts.push(`• ${sender}: ${preview}`)
    })
  }

  const summary = parts.join('\n')
  
  // Truncate if too long
  if (summary.length > maxLength) {
    return summary.slice(0, maxLength - 3) + '...'
  }
  
  return summary
}

export const summarizeAction = {
  type: QuickActionType.SUMMARIZE,
  name: 'Resumir Mensagens',
  description: 'Resume as últimas mensagens da conversa',
  trigger: '/resumo',
  aliases: ['/resume', '/sum', '/summarize'],
  handler: summarizeHandler,
  defaultConfig: {
    messageCount: 20,
    maxLength: 500,
    language: 'pt-BR',
    includeTimestamps: false,
  } as SummarizeConfig,
  usage: '/resumo [quantidade]',
  examples: [
    '/resumo',
    '/resumo 50',
  ],
}
