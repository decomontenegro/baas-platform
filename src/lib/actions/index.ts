// Main executor
export {
  processMessage,
  executeAction,
  executeActionById,
  isCommand,
  getActionByTrigger,
} from './executor'

// Parser utilities
export {
  parseCommand,
  matchesAction,
  findMatchingAction,
  parseDuration,
  parseDateTime,
  parseLanguage,
} from './parser'

// Built-in actions
export {
  builtinActions,
  getBuiltinAction,
  getBuiltinActionTypes,
  getDefaultConfig,
  getBuiltinActionsData,
  isChannelMuted,
  getMuteRemaining,
  unmuteChannel,
} from './builtin'

// Types
export type {
  ActionContext,
  ActionResult,
  ParsedCommand,
  MessageContext,
  Attachment,
  BuiltinAction,
  ActionHandler,
  ActionConfig,
  TriggerConfig,
  SummarizeConfig,
  SearchConfig,
  RemindConfig,
  TranslateConfig,
  TranscribeConfig,
  MuteConfig,
  StatusConfig,
  HelpConfig,
  CustomConfig,
  MuteState,
} from './types'

export {
  QuickActionType,
  ActionTriggerType,
  ActionExecutionStatus,
} from './types'
