import { ActionHandler, ActionContext, ActionResult, HelpConfig, QuickActionType } from '../types'
import { prisma } from '@/lib/prisma'

/**
 * /ajuda - List available commands
 */
export const helpHandler: ActionHandler = async (
  context: ActionContext,
  args: string[],
  config: HelpConfig
): Promise<ActionResult> => {
  const startTime = Date.now()
  
  try {
    const specificCommand = args[0]?.startsWith('/') ? args[0] : args[0] ? `/${args[0]}` : null

    // Get all enabled actions for this tenant
    const actions = await prisma.quickAction.findMany({
      where: {
        tenantId: context.tenantId,
        isEnabled: true,
        deletedAt: null,
      },
      orderBy: [
        { isBuiltin: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })

    // If asking about a specific command
    if (specificCommand) {
      const action = actions.find(a => 
        a.trigger.toLowerCase() === specificCommand.toLowerCase() ||
        (a.triggerConfig as any)?.aliases?.some((alias: string) => 
          alias.toLowerCase() === specificCommand.toLowerCase()
        )
      )

      if (!action) {
        return {
          success: true,
          output: `❓ Comando "${specificCommand}" não encontrado.

Use \`/ajuda\` para ver todos os comandos disponíveis.`,
          durationMs: Date.now() - startTime,
        }
      }

      // Show detailed help for this command
      const parts: string[] = []
      parts.push(`📖 **${action.name}**\n`)
      
      if (action.description) {
        parts.push(action.description)
        parts.push('')
      }

      parts.push(`**Comando:** \`${action.trigger}\``)
      
      const aliases = (action.triggerConfig as any)?.aliases
      if (aliases?.length) {
        parts.push(`**Aliases:** ${aliases.map((a: string) => `\`${a}\``).join(', ')}`)
      }

      const actionConfig = action.config as any
      if (actionConfig?.usage) {
        parts.push(`\n**Uso:** \`${actionConfig.usage}\``)
      }

      if (actionConfig?.examples?.length) {
        parts.push('\n**Exemplos:**')
        actionConfig.examples.forEach((ex: string) => {
          parts.push(`• \`${ex}\``)
        })
      }

      return {
        success: true,
        output: parts.join('\n'),
        durationMs: Date.now() - startTime,
      }
    }

    // Show all available commands
    const parts: string[] = []
    parts.push('📚 **Comandos Disponíveis**\n')

    if (config.groupByType) {
      // Group by action type
      const grouped = groupByType(actions)
      
      for (const [type, typeActions] of Object.entries(grouped)) {
        parts.push(`\n**${getTypeName(type)}:**`)
        for (const action of typeActions) {
          parts.push(`• \`${action.trigger}\` - ${action.description || action.name}`)
        }
      }
    } else {
      // Simple list
      for (const action of actions) {
        const desc = action.description || action.name
        parts.push(`• \`${action.trigger}\` - ${desc}`)
      }
    }

    parts.push('\n---')
    parts.push('_Use `/ajuda [comando]` para mais detalhes sobre um comando específico._')

    return {
      success: true,
      output: parts.join('\n'),
      data: {
        commandCount: actions.length,
        commands: actions.map(a => ({
          trigger: a.trigger,
          name: a.name,
          type: a.type,
        })),
      },
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      success: false,
      error: `Erro ao listar comandos: ${message}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Group actions by type
 */
function groupByType(actions: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}
  
  for (const action of actions) {
    const type = action.type || 'CUSTOM'
    if (!grouped[type]) {
      grouped[type] = []
    }
    grouped[type].push(action)
  }
  
  return grouped
}

/**
 * Get human-readable type name
 */
function getTypeName(type: string): string {
  const names: Record<string, string> = {
    SUMMARIZE: '📋 Resumo',
    SEARCH: '🔍 Busca',
    REMIND: '⏰ Lembretes',
    TRANSLATE: '🌐 Tradução',
    TRANSCRIBE: '🎤 Transcrição',
    MUTE: '🔇 Controle',
    STATUS: '📊 Status',
    HELP: '❓ Ajuda',
    CUSTOM: '⚡ Personalizado',
  }
  
  return names[type] || type
}

export const helpAction = {
  type: QuickActionType.HELP,
  name: 'Ajuda',
  description: 'Lista os comandos disponíveis',
  trigger: '/ajuda',
  aliases: ['/help', '/comandos', '/commands', '/?'],
  handler: helpHandler,
  defaultConfig: {
    showHidden: false,
    groupByType: false,
  } as HelpConfig,
  usage: '/ajuda [comando]',
  examples: [
    '/ajuda',
    '/ajuda resumo',
    '/help buscar',
  ],
}
