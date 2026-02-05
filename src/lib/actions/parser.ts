import { QuickAction, ActionTriggerType } from '@prisma/client'
import { 
  ParsedCommand, 
  CommandTriggerConfig, 
  KeywordTriggerConfig, 
  RegexTriggerConfig 
} from './types'

/**
 * Parse a message to extract command information
 */
export function parseCommand(message: string): ParsedCommand {
  const trimmed = message.trim()
  const isCommand = trimmed.startsWith('/')
  
  if (!isCommand) {
    return {
      trigger: '',
      command: '',
      args: [],
      rawArgs: trimmed,
      isCommand: false,
    }
  }

  // Split by whitespace, preserving quoted strings
  const parts = splitCommandArgs(trimmed)
  const command = parts[0] || ''
  const trigger = command.toLowerCase()
  const args = parts.slice(1)
  const rawArgs = parts.slice(1).join(' ')

  return {
    trigger,
    command,
    args,
    rawArgs,
    isCommand: true,
  }
}

/**
 * Split command arguments, preserving quoted strings
 */
function splitCommandArgs(input: string): string[] {
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  const parts: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(input)) !== null) {
    // Use the captured group (without quotes) if available, otherwise use the full match
    parts.push(match[1] || match[2] || match[0])
  }

  return parts
}

/**
 * Check if a message matches a specific action's trigger
 */
export function matchesAction(
  message: string,
  action: QuickAction
): { matches: boolean; args: string[] } {
  const triggerConfig = action.triggerConfig as Record<string, unknown>
  
  switch (action.triggerType) {
    case ActionTriggerType.COMMAND:
      return matchesCommandTrigger(message, action.trigger, triggerConfig as CommandTriggerConfig)
    
    case ActionTriggerType.KEYWORD:
      return matchesKeywordTrigger(message, triggerConfig as KeywordTriggerConfig)
    
    case ActionTriggerType.REGEX:
      return matchesRegexTrigger(message, triggerConfig as RegexTriggerConfig)
    
    default:
      return { matches: false, args: [] }
  }
}

/**
 * Match command trigger (e.g., /resumo, /buscar)
 */
function matchesCommandTrigger(
  message: string,
  trigger: string,
  config: CommandTriggerConfig
): { matches: boolean; args: string[] } {
  const parsed = parseCommand(message)
  
  if (!parsed.isCommand) {
    return { matches: false, args: [] }
  }

  const caseSensitive = config?.caseSensitive ?? false
  const triggers = [trigger, ...(config?.aliases || [])]
  
  const matchTrigger = (t: string) => {
    if (caseSensitive) {
      return parsed.command === t
    }
    return parsed.command.toLowerCase() === t.toLowerCase()
  }

  const matches = triggers.some(matchTrigger)
  
  return {
    matches,
    args: matches ? parsed.args : [],
  }
}

/**
 * Match keyword trigger
 */
function matchesKeywordTrigger(
  message: string,
  config: KeywordTriggerConfig
): { matches: boolean; args: string[] } {
  if (!config?.keywords?.length) {
    return { matches: false, args: [] }
  }

  const normalizedMessage = message.toLowerCase().trim()
  const matchType = config.matchType || 'contains'

  for (const keyword of config.keywords) {
    const normalizedKeyword = keyword.toLowerCase()
    let matches = false

    switch (matchType) {
      case 'exact':
        matches = normalizedMessage === normalizedKeyword
        break
      case 'startsWith':
        matches = normalizedMessage.startsWith(normalizedKeyword)
        break
      case 'endsWith':
        matches = normalizedMessage.endsWith(normalizedKeyword)
        break
      case 'contains':
      default:
        matches = normalizedMessage.includes(normalizedKeyword)
        break
    }

    if (matches) {
      // Extract the rest of the message after the keyword as args
      const keywordIndex = normalizedMessage.indexOf(normalizedKeyword)
      const afterKeyword = message.slice(keywordIndex + keyword.length).trim()
      return {
        matches: true,
        args: afterKeyword ? afterKeyword.split(/\s+/) : [],
      }
    }
  }

  return { matches: false, args: [] }
}

/**
 * Match regex trigger
 */
function matchesRegexTrigger(
  message: string,
  config: RegexTriggerConfig
): { matches: boolean; args: string[] } {
  if (!config?.pattern) {
    return { matches: false, args: [] }
  }

  try {
    const regex = new RegExp(config.pattern, config.flags || 'i')
    const match = message.match(regex)

    if (match) {
      // Return captured groups as args (excluding full match)
      const args = match.slice(1).filter(Boolean)
      return { matches: true, args }
    }
  } catch (error) {
    console.error('Invalid regex pattern:', config.pattern, error)
  }

  return { matches: false, args: [] }
}

/**
 * Find the first matching action for a message
 */
export function findMatchingAction(
  message: string,
  actions: QuickAction[]
): { action: QuickAction; args: string[] } | null {
  // Sort by sortOrder, then by isBuiltin (custom first)
  const sortedActions = [...actions].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }
    // Custom actions take priority over builtin
    if (a.isBuiltin !== b.isBuiltin) {
      return a.isBuiltin ? 1 : -1
    }
    return 0
  })

  for (const action of sortedActions) {
    if (!action.isEnabled) continue
    
    const { matches, args } = matchesAction(message, action)
    if (matches) {
      return { action, args }
    }
  }

  return null
}

/**
 * Extract time duration from string (e.g., "30m", "2h", "1d")
 */
export function parseDuration(input: string): { value: number; unit: string; seconds: number } | null {
  const match = input.match(/^(\d+)\s*(m|min|minutes?|h|hr|hours?|d|days?|s|sec|seconds?)$/i)
  
  if (!match) {
    return null
  }

  const value = parseInt(match[1], 10)
  const unitRaw = match[2].toLowerCase()
  
  let unit: string
  let multiplier: number

  if (unitRaw.startsWith('s')) {
    unit = 'seconds'
    multiplier = 1
  } else if (unitRaw.startsWith('m')) {
    unit = 'minutes'
    multiplier = 60
  } else if (unitRaw.startsWith('h')) {
    unit = 'hours'
    multiplier = 3600
  } else if (unitRaw.startsWith('d')) {
    unit = 'days'
    multiplier = 86400
  } else {
    return null
  }

  return {
    value,
    unit,
    seconds: value * multiplier,
  }
}

/**
 * Parse date/time from natural language input
 * Supports: "amanhã", "em 2 dias", "próxima segunda", "15:00", etc.
 */
export function parseDateTime(input: string, now: Date = new Date()): Date | null {
  const normalized = input.toLowerCase().trim()
  
  // Relative time patterns
  if (normalized === 'agora' || normalized === 'now') {
    return now
  }
  
  if (normalized === 'amanhã' || normalized === 'tomorrow') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0) // Default to 9 AM
    return tomorrow
  }
  
  if (normalized === 'hoje' || normalized === 'today') {
    const today = new Date(now)
    today.setHours(12, 0, 0, 0) // Default to noon
    return today
  }

  // "em X minutos/horas/dias"
  const relativeMatch = normalized.match(/em\s+(\d+)\s*(min|minutos?|h|horas?|d|dias?)/i)
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2].toLowerCase()
    const result = new Date(now)
    
    if (unit.startsWith('min')) {
      result.setMinutes(result.getMinutes() + value)
    } else if (unit.startsWith('h')) {
      result.setHours(result.getHours() + value)
    } else if (unit.startsWith('d')) {
      result.setDate(result.getDate() + value)
    }
    
    return result
  }

  // Time only (HH:MM)
  const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const result = new Date(now)
      result.setHours(hours, minutes, 0, 0)
      
      // If time has passed today, schedule for tomorrow
      if (result <= now) {
        result.setDate(result.getDate() + 1)
      }
      
      return result
    }
  }

  // Date format (DD/MM or DD/MM/YYYY)
  const dateMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10)
    const month = parseInt(dateMatch[2], 10) - 1
    const year = dateMatch[3] 
      ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3], 10) : parseInt(dateMatch[3], 10))
      : now.getFullYear()
    
    const result = new Date(year, month, day, 9, 0, 0, 0)
    
    if (!isNaN(result.getTime())) {
      return result
    }
  }

  return null
}

/**
 * Extract language code from input
 */
export function parseLanguage(input: string): string | null {
  const normalized = input.toLowerCase().trim()
  
  const languageMap: Record<string, string> = {
    // Portuguese
    'português': 'pt',
    'portugues': 'pt',
    'pt': 'pt',
    'pt-br': 'pt',
    // English
    'inglês': 'en',
    'ingles': 'en',
    'english': 'en',
    'en': 'en',
    // Spanish
    'espanhol': 'es',
    'spanish': 'es',
    'español': 'es',
    'es': 'es',
    // French
    'francês': 'fr',
    'frances': 'fr',
    'french': 'fr',
    'fr': 'fr',
    // German
    'alemão': 'de',
    'alemao': 'de',
    'german': 'de',
    'de': 'de',
    // Italian
    'italiano': 'it',
    'italian': 'it',
    'it': 'it',
    // Japanese
    'japonês': 'ja',
    'japones': 'ja',
    'japanese': 'ja',
    'ja': 'ja',
    // Chinese
    'chinês': 'zh',
    'chines': 'zh',
    'chinese': 'zh',
    'zh': 'zh',
    // Korean
    'coreano': 'ko',
    'korean': 'ko',
    'ko': 'ko',
    // Russian
    'russo': 'ru',
    'russian': 'ru',
    'ru': 'ru',
  }

  return languageMap[normalized] || null
}
