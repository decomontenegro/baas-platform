export interface Channel {
  id: string
  name: string
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'api'
  status: 'active' | 'inactive' | 'error'
  config: ChannelConfig
  createdAt: string
  updatedAt: string
  messagesCount: number
  lastActivity?: string
}

export interface ChannelConfig {
  apiKey?: string
  webhookUrl?: string
  phoneNumber?: string
  botToken?: string
  serverId?: string
  [key: string]: unknown
}

export interface Message {
  id: string
  channelId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface MemoryItem {
  id: string
  channelId: string
  key: string
  value: string
  type: 'fact' | 'preference' | 'context'
  createdAt: string
}

export interface Personality {
  id: string
  name: string
  description?: string
  systemPrompt: string
  temperature: number
  creativity: number
  formality: number
  verbosity: number
  empathy: number
  humor: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface PersonalityTemplate {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  defaults: Partial<Omit<Personality, 'id' | 'name' | 'createdAt' | 'updatedAt'>>
}

export interface Analytics {
  totalMessages: number
  totalChannels: number
  activeChannels: number
  avgResponseTime: number
  messagesPerDay: DailyStats[]
  channelBreakdown: ChannelBreakdown[]
  recentActivity: ActivityItem[]
}

export interface DailyStats {
  date: string
  messages: number
  users: number
}

export interface ChannelBreakdown {
  type: string
  count: number
  percentage: number
}

export interface ActivityItem {
  id: string
  type: 'message' | 'channel_created' | 'channel_updated' | 'error'
  description: string
  channelId?: string
  channelName?: string
  createdAt: string
}

// Re-export template types
export * from './templates'

// Re-export bot types
export * from './bot'

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export type ConversationStatus = 'ACTIVE' | 'WAITING' | 'HANDOFF' | 'RESOLVED' | 'ARCHIVED'

export type MessageRole = 'USER' | 'BOT' | 'OPERATOR' | 'SYSTEM'

export type MessageContentType = 
  | 'TEXT' 
  | 'IMAGE' 
  | 'AUDIO' 
  | 'VIDEO' 
  | 'DOCUMENT' 
  | 'LOCATION' 
  | 'CONTACT' 
  | 'STICKER' 
  | 'INTERACTIVE' 
  | 'TEMPLATE' 
  | 'SYSTEM'

export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

export type ConversationEventType =
  | 'STARTED'
  | 'HANDOFF_REQUESTED'
  | 'HANDOFF_ACCEPTED'
  | 'HANDOFF_REJECTED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'NOTE_ADDED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'ARCHIVED'
  | 'EXPORTED'

export interface Conversation {
  id: string
  tenantId: string
  workspaceId: string
  channelId: string | null
  contactId: string
  contactName: string | null
  contactAvatar: string | null
  contactInfo: Record<string, unknown>
  subject: string | null
  tags: string[]
  status: ConversationStatus
  messageCount: number
  unreadCount: number
  assignedToId: string | null
  handoffAt: string | null
  handoffReason: string | null
  startedAt: string
  lastMessageAt: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  // Relations (when included)
  workspace?: { id: string; name: string }
  channel?: { id: string; name: string; type: string } | null
  assignedTo?: { id: string; name: string | null; email: string; image: string | null } | null
  lastMessage?: ConversationMessage | null
  _count?: { messages: number; notes: number }
}

export interface ConversationMessage {
  id: string
  conversationId: string
  content: string
  contentType: MessageContentType
  role: MessageRole
  senderId: string | null
  senderName: string | null
  externalId: string | null
  attachments: MessageAttachment[]
  aiMetadata: Record<string, unknown> | null
  status: MessageStatus
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
  // Relations (when included)
  sender?: { id: string; name: string | null; email: string; image: string | null } | null
}

export interface MessageAttachment {
  type: string
  url: string
  filename?: string
  size?: number
  mimeType?: string
}

export interface ConversationEvent {
  id: string
  conversationId: string
  type: ConversationEventType
  actorId: string | null
  actorName: string | null
  data: Record<string, unknown>
  createdAt: string
  // Relations
  actor?: { id: string; name: string | null; email: string } | null
}

export interface ConversationNote {
  id: string
  conversationId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  // Relations
  author?: { id: string; name: string | null; email: string; image: string | null }
}

export interface ConversationWithDetails extends Conversation {
  events: ConversationEvent[]
  notes: ConversationNote[]
}

export interface ConversationStats {
  messageCount: number
  durationSeconds: number
  messagesByRole: Record<MessageRole, number>
  firstMessageAt: string | null
  lastMessageAt: string | null
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: Record<string, unknown>
}

export interface MessagesResponse {
  messages: ConversationMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ConversationFilters {
  workspaceId?: string
  channelId?: string
  status?: ConversationStatus
  tag?: string
  assignedToId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'lastMessageAt' | 'createdAt' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
}
