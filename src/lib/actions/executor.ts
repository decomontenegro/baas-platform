import { QuickAction, ActionExecutionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ActionContext, ActionResult, QuickActionType } from './types'
import { findMatchingAction, parseCommand } from './parser'
import { builtinActions, isChannelMuted } from './builtin'

/**
 * Process a message and execute matching action if found
 */
export async function processMessage(
  message: string,
  context: ActionContext
): Promise<ActionResult | null> {
  // Check if channel is muted
  if (isChannelMuted(context.channelId)) {
    // Allow unmute command even when muted
    const parsed = parseCommand(message)
    if (parsed.isCommand && 
        (parsed.trigger === '/silenciar' || parsed.trigger === '/mute') &&
        (parsed.args[0] === 'off' || parsed.args[0] === 'desligar')) {
      // Continue to process unmute command
    } else {
      // Channel is muted, skip processing
      return null
    }
  }

  // Get enabled actions for this tenant
  const actions = await prisma.quickAction.findMany({
    where: {
      tenantId: context.tenantId,
      isEnabled: true,
      deletedAt: null,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { isBuiltin: 'desc' },
    ],
  })

  // Find matching action
  const match = findMatchingAction(message, actions)
  
  if (!match) {
    return null
  }

  // Execute the action
  return executeAction(match.action, context, match.args)
}

/**
 * Execute a specific action
 */
export async function executeAction(
  action: QuickAction,
  context: ActionContext,
  args: string[]
): Promise<ActionResult> {
  const startTime = Date.now()

  // Create execution record
  const execution = await prisma.actionExecution.create({
    data: {
      actionId: action.id,
      channelId: context.channelId,
      conversationId: context.conversationId,
      userId: context.userId,
      userName: context.userName,
      input: context.message,
      parsedArgs: args,
      status: ActionExecutionStatus.RUNNING,
      metadata: context.metadata || {},
    },
  })

  try {
    // Get the handler for this action type
    const handler = getActionHandler(action)
    
    if (!handler) {
      throw new Error(`No handler found for action type: ${action.type}`)
    }

    // Execute the action
    const config = action.config as Record<string, unknown>
    const result = await handler(context, args, config)

    // Update execution record
    await prisma.actionExecution.update({
      where: { id: execution.id },
      data: {
        status: result.success 
          ? ActionExecutionStatus.COMPLETED 
          : ActionExecutionStatus.FAILED,
        output: result.output,
        error: result.error,
        durationMs: Date.now() - startTime,
      },
    })

    // Update action stats
    await prisma.quickAction.update({
      where: { id: action.id },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update execution record with error
    await prisma.actionExecution.update({
      where: { id: execution.id },
      data: {
        status: ActionExecutionStatus.FAILED,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      },
    })

    return {
      success: false,
      error: `Erro ao executar ação: ${errorMessage}`,
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Get the handler function for an action
 */
function getActionHandler(action: QuickAction) {
  // For built-in actions, use the registered handler
  if (action.isBuiltin && action.type in builtinActions) {
    return builtinActions[action.type as QuickActionType].handler
  }

  // For custom actions, check config for webhook or script
  const config = action.config as Record<string, unknown>
  
  if (config.webhookUrl) {
    return createWebhookHandler(config)
  }

  // Default to the built-in handler if type matches
  if (action.type in builtinActions) {
    return builtinActions[action.type as QuickActionType].handler
  }

  return null
}

/**
 * Create a webhook handler for custom actions
 */
function createWebhookHandler(config: Record<string, unknown>) {
  return async (
    context: ActionContext,
    args: string[],
    actionConfig: Record<string, unknown>
  ): Promise<ActionResult> => {
    const startTime = Date.now()
    
    try {
      const webhookUrl = config.webhookUrl as string
      const method = (config.method as string) || 'POST'
      const headers = (config.headers as Record<string, string>) || {}
      
      // Prepare body
      const body = {
        context: {
          tenantId: context.tenantId,
          channelId: context.channelId,
          conversationId: context.conversationId,
          userId: context.userId,
          userName: context.userName,
        },
        message: context.message,
        args,
        config: actionConfig,
        timestamp: new Date().toISOString(),
      }

      // Make request
      const response = await fetch(webhookUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        output: result.message || result.output || 'Ação executada com sucesso.',
        data: result.data,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      return {
        success: false,
        error: `Erro no webhook: ${message}`,
        durationMs: Date.now() - startTime,
      }
    }
  }
}

/**
 * Execute an action by ID
 */
export async function executeActionById(
  actionId: string,
  context: ActionContext,
  args: string[] = []
): Promise<ActionResult> {
  const action = await prisma.quickAction.findUnique({
    where: { id: actionId },
  })

  if (!action) {
    return {
      success: false,
      error: 'Ação não encontrada',
    }
  }

  if (!action.isEnabled) {
    return {
      success: false,
      error: 'Ação está desabilitada',
    }
  }

  if (action.deletedAt) {
    return {
      success: false,
      error: 'Ação foi removida',
    }
  }

  return executeAction(action, context, args)
}

/**
 * Check if a message is a command (starts with /)
 */
export function isCommand(message: string): boolean {
  return message.trim().startsWith('/')
}

/**
 * Get action by trigger
 */
export async function getActionByTrigger(
  tenantId: string,
  trigger: string
): Promise<QuickAction | null> {
  return prisma.quickAction.findFirst({
    where: {
      tenantId,
      trigger: trigger.toLowerCase(),
      isEnabled: true,
      deletedAt: null,
    },
  })
}
