import { BuiltinAction, QuickActionType } from '../types'
import { summarizeAction } from './summarize'
import { searchAction } from './search'
import { remindAction } from './remind'
import { translateAction } from './translate'
import { transcribeAction } from './transcribe'
import { muteAction, isChannelMuted, getMuteRemaining, unmuteChannel } from './mute'
import { statusAction } from './status'
import { helpAction } from './help'

/**
 * Registry of all built-in actions
 */
export const builtinActions: Record<QuickActionType, BuiltinAction> = {
  [QuickActionType.SUMMARIZE]: summarizeAction,
  [QuickActionType.SEARCH]: searchAction,
  [QuickActionType.REMIND]: remindAction,
  [QuickActionType.TRANSLATE]: translateAction,
  [QuickActionType.TRANSCRIBE]: transcribeAction,
  [QuickActionType.MUTE]: muteAction,
  [QuickActionType.STATUS]: statusAction,
  [QuickActionType.HELP]: helpAction,
  [QuickActionType.CUSTOM]: {
    type: QuickActionType.CUSTOM,
    name: 'Custom',
    description: 'Ação personalizada',
    trigger: '/custom',
    handler: async () => ({
      success: false,
      error: 'Ação customizada não implementada',
    }),
    defaultConfig: {},
  },
}

/**
 * Get a built-in action by type
 */
export function getBuiltinAction(type: QuickActionType): BuiltinAction | undefined {
  return builtinActions[type]
}

/**
 * Get all built-in action types
 */
export function getBuiltinActionTypes(): QuickActionType[] {
  return Object.values(QuickActionType).filter(
    type => type !== QuickActionType.CUSTOM
  )
}

/**
 * Get default configuration for a built-in action type
 */
export function getDefaultConfig(type: QuickActionType): Record<string, unknown> {
  const action = builtinActions[type]
  return action?.defaultConfig || {}
}

/**
 * Create built-in actions data for seeding the database
 */
export function getBuiltinActionsData(tenantId: string) {
  return Object.values(builtinActions)
    .filter(action => action.type !== QuickActionType.CUSTOM)
    .map(action => ({
      tenantId,
      name: action.name,
      description: action.description,
      trigger: action.trigger,
      type: action.type,
      config: {
        ...action.defaultConfig,
        usage: action.usage,
        examples: action.examples,
      },
      triggerType: 'COMMAND' as const,
      triggerConfig: {
        caseSensitive: false,
        aliases: action.aliases || [],
      },
      isEnabled: true,
      isBuiltin: true,
      sortOrder: getActionSortOrder(action.type),
    }))
}

/**
 * Get sort order for action types
 */
function getActionSortOrder(type: QuickActionType): number {
  const order: Record<QuickActionType, number> = {
    [QuickActionType.HELP]: 0,
    [QuickActionType.STATUS]: 1,
    [QuickActionType.SUMMARIZE]: 2,
    [QuickActionType.SEARCH]: 3,
    [QuickActionType.TRANSLATE]: 4,
    [QuickActionType.TRANSCRIBE]: 5,
    [QuickActionType.REMIND]: 6,
    [QuickActionType.MUTE]: 7,
    [QuickActionType.CUSTOM]: 100,
  }
  
  return order[type] ?? 50
}

// Re-export mute utilities
export { isChannelMuted, getMuteRemaining, unmuteChannel }
