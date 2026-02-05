// Handoff Types

export type HandoffStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'CANCELLED'
  | 'EXPIRED'

export type HandoffReason =
  | 'KEYWORD_MATCH'
  | 'NEGATIVE_SENTIMENT'
  | 'BOT_LOOP'
  | 'CUSTOMER_REQUEST'
  | 'MANUAL_TRANSFER'
  | 'SCHEDULE_TRIGGER'
  | 'HIGH_VALUE'
  | 'VIP_CUSTOMER'
  | 'ESCALATION'
  | 'OTHER'

export type HandoffPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type HandoffTriggerType =
  | 'KEYWORD'
  | 'SENTIMENT'
  | 'BOT_LOOP'
  | 'SCHEDULE'
  | 'INTENT'
  | 'CUSTOM'

export type HandoffAction = 'CREATE_REQUEST' | 'AUTO_ASSIGN' | 'NOTIFY_ONLY'

export interface HandoffRequest {
  id: string
  workspaceId: string
  channelId: string
  conversationId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerMeta: Record<string, unknown>
  reason: HandoffReason
  reasonText?: string
  priority: HandoffPriority
  status: HandoffStatus
  assignedTo?: string
  assignedBy?: string
  assignedAt?: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionNote?: string
  triggerRule?: string
  conversationHistory: ConversationMessage[]
  metadata: Record<string, unknown>
  slaDeadline?: string
  slaBreached: boolean
  createdAt: string
  updatedAt: string
  workspace?: {
    id: string
    name: string
  }
  notes?: HandoffNote[]
}

export interface HandoffNote {
  id: string
  handoffId: string
  content: string
  isInternal: boolean
  authorId: string
  authorName?: string
  createdAt: string
}

export interface HandoffRule {
  id: string
  workspaceId: string
  channelId?: string
  name: string
  description?: string
  triggerType: HandoffTriggerType
  triggerConfig: Record<string, unknown>
  action: HandoffAction
  actionConfig: Record<string, unknown>
  priority: HandoffPriority
  autoReplyMessage?: string
  isActive: boolean
  triggerCount: number
  lastTriggeredAt?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  workspace?: {
    id: string
    name: string
  }
}

export interface HandoffSettings {
  id: string
  workspaceId: string
  slaMinutes: number
  escalationMinutes: number
  notifyEmail: boolean
  notifyPush: boolean
  notifySound: boolean
  notifyEmails: string[]
  enableBusinessHours: boolean
  timezone: string
  businessHoursStart: string
  businessHoursEnd: string
  workDays: number[]
  enableAutoAssign: boolean
  roundRobinEnabled: boolean
  outOfHoursMessage?: string
  maxConcurrentPerAgent: number
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  role: 'customer' | 'bot' | 'agent'
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface HandoffQueueStats {
  pending: number
  assigned: number
  inProgress: number
  onHold: number
  resolved: number
  total: number
}

// UI helpers
export const statusLabels: Record<HandoffStatus, string> = {
  PENDING: 'Pendente',
  ASSIGNED: 'Atribuído',
  IN_PROGRESS: 'Em Atendimento',
  ON_HOLD: 'Em Espera',
  RESOLVED: 'Resolvido',
  ESCALATED: 'Escalado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
}

export const statusColors: Record<HandoffStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  RESOLVED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  ESCALATED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500',
}

export const priorityLabels: Record<HandoffPriority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const priorityColors: Record<HandoffPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  NORMAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export const reasonLabels: Record<HandoffReason, string> = {
  KEYWORD_MATCH: 'Palavra-chave',
  NEGATIVE_SENTIMENT: 'Sentimento negativo',
  BOT_LOOP: 'Loop do bot',
  CUSTOMER_REQUEST: 'Solicitação do cliente',
  MANUAL_TRANSFER: 'Transferência manual',
  SCHEDULE_TRIGGER: 'Fora do horário',
  HIGH_VALUE: 'Cliente de alto valor',
  VIP_CUSTOMER: 'Cliente VIP',
  ESCALATION: 'Escalação',
  OTHER: 'Outro',
}

export const triggerTypeLabels: Record<HandoffTriggerType, string> = {
  KEYWORD: 'Palavras-chave',
  SENTIMENT: 'Análise de sentimento',
  BOT_LOOP: 'Loop do bot',
  SCHEDULE: 'Horário',
  INTENT: 'Intenção',
  CUSTOM: 'Personalizado',
}
