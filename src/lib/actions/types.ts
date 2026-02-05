import { QuickActionType, ActionTriggerType, ActionExecutionStatus } from '@prisma/client'

// ============================================================================
// ACTION TYPES
// ============================================================================

export interface ActionContext {
  tenantId: string
  channelId: string
  conversationId?: string
  userId?: string
  userName?: string
  message: string
  recentMessages?: MessageContext[]
  metadata?: Record<string, unknown>
}

export interface MessageContext {
  id: string
  content: string
  role: 'user' | 'bot' | 'operator' | 'system'
  senderName?: string
  createdAt: Date
  attachments?: Attachment[]
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'document'
  url: string
  filename?: string
  mimeType?: string
}

export interface ActionResult {
  success: boolean
  output?: string
  error?: string
  data?: Record<string, unknown>
  durationMs?: number
}

export interface ParsedCommand {
  trigger: string
  command: string
  args: string[]
  rawArgs: string
  isCommand: boolean
}

// ============================================================================
// ACTION CONFIG TYPES
// ============================================================================

export interface SummarizeConfig {
  messageCount?: number
  maxLength?: number
  language?: string
  includeTimestamps?: boolean
}

export interface SearchConfig {
  knowledgeBaseId?: string
  maxResults?: number
  minScore?: number
}

export interface RemindConfig {
  allowedUnits?: ('minutes' | 'hours' | 'days')[]
  maxDaysAhead?: number
}

export interface TranslateConfig {
  supportedLanguages?: string[]
  autoDetect?: boolean
  defaultTarget?: string
}

export interface TranscribeConfig {
  maxDurationSeconds?: number
  language?: string
}

export interface MuteConfig {
  maxDurationSeconds?: number
  defaultDurationSeconds?: number
}

export interface StatusConfig {
  showUptime?: boolean
  showStats?: boolean
}

export interface HelpConfig {
  showHidden?: boolean
  groupByType?: boolean
}

export interface CustomConfig {
  webhookUrl?: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  bodyTemplate?: string
  responseTemplate?: string
}

export type ActionConfig = 
  | SummarizeConfig
  | SearchConfig
  | RemindConfig
  | TranslateConfig
  | TranscribeConfig
  | MuteConfig
  | StatusConfig
  | HelpConfig
  | CustomConfig

// ============================================================================
// TRIGGER CONFIG TYPES
// ============================================================================

export interface CommandTriggerConfig {
  caseSensitive?: boolean
  aliases?: string[]
}

export interface KeywordTriggerConfig {
  keywords: string[]
  matchType?: 'contains' | 'exact' | 'startsWith' | 'endsWith'
}

export interface RegexTriggerConfig {
  pattern: string
  flags?: string
}

export type TriggerConfig = 
  | CommandTriggerConfig
  | KeywordTriggerConfig
  | RegexTriggerConfig

// ============================================================================
// ACTION HANDLER TYPE
// ============================================================================

export type ActionHandler = (
  context: ActionContext,
  args: string[],
  config: ActionConfig
) => Promise<ActionResult>

// ============================================================================
// BUILT-IN ACTIONS REGISTRY
// ============================================================================

export interface BuiltinAction {
  type: QuickActionType
  name: string
  description: string
  trigger: string
  aliases?: string[]
  handler: ActionHandler
  defaultConfig: ActionConfig
  usage?: string
  examples?: string[]
}

// ============================================================================
// MUTE STATE
// ============================================================================

export interface MuteState {
  channelId: string
  mutedUntil: Date
  mutedBy?: string
}

// Re-export Prisma types
export { QuickActionType, ActionTriggerType, ActionExecutionStatus }
