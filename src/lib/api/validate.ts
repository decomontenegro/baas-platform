import { z, ZodSchema } from 'zod'
import { NextRequest } from 'next/server'
import { BadRequestError } from './errors'

// Parse and validate request body
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown
  
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('Invalid JSON body')
  }
  
  return schema.parse(body)
}

// Parse and validate query params
export function parseQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): T {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())
  return schema.parse(params)
}

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

// Tenant schemas
export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
})

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  settings: z.record(z.unknown()).optional(),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>

// Channel schemas
export const channelTypeSchema = z.enum([
  'WHATSAPP',
  'TELEGRAM',
  'DISCORD',
  'SLACK',
  'WEBCHAT',
  'API',
])

export const channelStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'ERROR',
  'CONNECTING',
])

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: channelTypeSchema,
  workspaceId: z.string().cuid(),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: channelStatusSchema.optional(),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const channelFilterSchema = z.object({
  workspaceId: z.string().cuid().optional(),
  type: channelTypeSchema.optional(),
  status: channelStatusSchema.optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateChannelInput = z.infer<typeof createChannelSchema>
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>
export type ChannelFilter = z.infer<typeof channelFilterSchema>

// Test channel schema
export const testChannelSchema = z.object({
  message: z.string().min(1).max(1000),
})

export type TestChannelInput = z.infer<typeof testChannelSchema>

// ID param validation
export const idParamSchema = z.object({
  id: z.string().cuid(),
})

// ============================================================================
// CONVERSATION SCHEMAS
// ============================================================================

export const conversationStatusSchema = z.enum([
  'ACTIVE',
  'WAITING',
  'HANDOFF',
  'RESOLVED',
  'ARCHIVED',
])

export const messageRoleSchema = z.enum([
  'USER',
  'BOT',
  'OPERATOR',
  'SYSTEM',
])

export const messageContentTypeSchema = z.enum([
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'LOCATION',
  'CONTACT',
  'STICKER',
  'INTERACTIVE',
  'TEMPLATE',
  'SYSTEM',
])

export const conversationFilterSchema = paginationSchema.extend({
  workspaceId: z.string().cuid().optional(),
  channelId: z.string().cuid().optional(),
  status: conversationStatusSchema.optional(),
  tag: z.string().optional(),
  assignedToId: z.string().cuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['lastMessageAt', 'createdAt', 'messageCount']).default('lastMessageAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const messageFilterSchema = paginationSchema.extend({
  role: messageRoleSchema.optional(),
  search: z.string().optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
})

export const createConversationSchema = z.object({
  workspaceId: z.string().cuid(),
  channelId: z.string().cuid().optional(),
  contactId: z.string().min(1).max(255),
  contactName: z.string().max(255).optional(),
  contactAvatar: z.string().url().optional(),
  contactInfo: z.record(z.unknown()).optional(),
  subject: z.string().max(255).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

export const updateConversationSchema = z.object({
  status: conversationStatusSchema.optional(),
  subject: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
})

export const addConversationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const addConversationTagSchema = z.object({
  tag: z.string().min(1).max(50),
  action: z.enum(['add', 'remove']).default('add'),
})

export const createMessageSchema = z.object({
  content: z.string().min(1).max(50000),
  contentType: messageContentTypeSchema.default('TEXT'),
  role: messageRoleSchema,
  senderName: z.string().max(255).optional(),
  externalId: z.string().max(255).optional(),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  aiMetadata: z.record(z.unknown()).optional(),
})

export type ConversationFilter = z.infer<typeof conversationFilterSchema>
export type MessageFilter = z.infer<typeof messageFilterSchema>
export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>
export type AddConversationNoteInput = z.infer<typeof addConversationNoteSchema>
export type AddConversationTagInput = z.infer<typeof addConversationTagSchema>
export type CreateMessageInput = z.infer<typeof createMessageSchema>

// ============================================================================
// HANDOFF SCHEMAS
// ============================================================================

export const handoffStatusSchema = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'ESCALATED',
  'CANCELLED',
  'EXPIRED',
])

export const handoffReasonSchema = z.enum([
  'KEYWORD_MATCH',
  'NEGATIVE_SENTIMENT',
  'BOT_LOOP',
  'CUSTOMER_REQUEST',
  'MANUAL_TRANSFER',
  'SCHEDULE_TRIGGER',
  'HIGH_VALUE',
  'VIP_CUSTOMER',
  'ESCALATION',
  'OTHER',
])

export const handoffPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
])

export const handoffTriggerTypeSchema = z.enum([
  'KEYWORD',
  'SENTIMENT',
  'BOT_LOOP',
  'SCHEDULE',
  'INTENT',
  'CUSTOM',
])

export const handoffActionSchema = z.enum([
  'CREATE_REQUEST',
  'AUTO_ASSIGN',
  'NOTIFY_ONLY',
])

// Create handoff request
export const createHandoffRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  channelId: z.string(),
  conversationId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerMeta: z.record(z.unknown()).optional(),
  reason: handoffReasonSchema,
  reasonText: z.string().max(2000).optional(),
  priority: handoffPrioritySchema.default('NORMAL'),
  conversationHistory: z.array(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateHandoffRequestInput = z.infer<typeof createHandoffRequestSchema>

// Update handoff request
export const updateHandoffRequestSchema = z.object({
  priority: handoffPrioritySchema.optional(),
  reasonText: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type UpdateHandoffRequestInput = z.infer<typeof updateHandoffRequestSchema>

// Assign handoff
export const assignHandoffSchema = z.object({
  assignTo: z.string().cuid(),
})

export type AssignHandoffInput = z.infer<typeof assignHandoffSchema>

// Resolve handoff
export const resolveHandoffSchema = z.object({
  resolutionNote: z.string().max(2000).optional(),
  returnToBot: z.boolean().default(true),
})

export type ResolveHandoffInput = z.infer<typeof resolveHandoffSchema>

// Handoff queue filters
export const handoffQueueFilterSchema = z.object({
  workspaceId: z.string().cuid().optional(),
  status: z.union([handoffStatusSchema, z.array(handoffStatusSchema)]).optional(),
  priority: handoffPrioritySchema.optional(),
  assignedTo: z.string().cuid().optional(),
  channelId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type HandoffQueueFilter = z.infer<typeof handoffQueueFilterSchema>

// Add handoff note
export const addHandoffNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(true),
})

export type AddHandoffNoteInput = z.infer<typeof addHandoffNoteSchema>

// Create handoff rule
export const createHandoffRuleSchema = z.object({
  workspaceId: z.string().cuid(),
  channelId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerType: handoffTriggerTypeSchema,
  triggerConfig: z.record(z.unknown()),
  action: handoffActionSchema.default('CREATE_REQUEST'),
  actionConfig: z.record(z.unknown()).optional(),
  priority: handoffPrioritySchema.default('NORMAL'),
  autoReplyMessage: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

export type CreateHandoffRuleInput = z.infer<typeof createHandoffRuleSchema>

// Update handoff rule
export const updateHandoffRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  priority: handoffPrioritySchema.optional(),
  autoReplyMessage: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type UpdateHandoffRuleInput = z.infer<typeof updateHandoffRuleSchema>

// Handoff settings
export const updateHandoffSettingsSchema = z.object({
  slaMinutes: z.number().int().min(1).max(1440).optional(),
  escalationMinutes: z.number().int().min(1).max(1440).optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifySound: z.boolean().optional(),
  notifyEmails: z.array(z.string().email()).optional(),
  enableBusinessHours: z.boolean().optional(),
  timezone: z.string().optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDays: z.array(z.number().int().min(0).max(6)).optional(),
  enableAutoAssign: z.boolean().optional(),
  roundRobinEnabled: z.boolean().optional(),
  outOfHoursMessage: z.string().max(2000).optional(),
  maxConcurrentPerAgent: z.number().int().min(1).max(50).optional(),
})

export type UpdateHandoffSettingsInput = z.infer<typeof updateHandoffSettingsSchema>

// ============================================================================
// SCHEDULED MESSAGES SCHEMAS
// ============================================================================

export const scheduleTypeSchema = z.enum([
  'ONE_TIME',
  'RECURRING',
  'TRIGGER_BASED',
])

export const scheduledMessageStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED',
  'PAUSED',
  'COMPLETED',
])

export const recurrenceSchema = z.object({
  pattern: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(), // 0=Sun, 6=Sat
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.string().datetime().optional(),
  maxOccurrences: z.number().int().min(1).optional(),
})

export const triggerConfigSchema = z.object({
  type: z.enum(['inactivity', 'after_event', 'after_conversation_end', 'after_handoff_resolved']),
  days: z.number().int().min(1).max(365).optional(),
  hours: z.number().int().min(1).max(8760).optional(),
  event: z.string().optional(),
})

export const createScheduledMessageSchema = z.object({
  workspaceId: z.string().cuid(),
  channelId: z.string().cuid(),
  contactId: z.string().min(1).max(255).optional(),
  conversationId: z.string().cuid().optional(),
  content: z.string().min(1).max(50000),
  contentType: messageContentTypeSchema.default('TEXT'),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  scheduledFor: z.string().datetime(),
  scheduleType: scheduleTypeSchema.default('ONE_TIME'),
  recurrence: recurrenceSchema.optional(),
  triggerConfig: triggerConfigSchema.optional(),
  name: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const updateScheduledMessageSchema = z.object({
  content: z.string().min(1).max(50000).optional(),
  contentType: messageContentTypeSchema.optional(),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  scheduledFor: z.string().datetime().optional(),
  recurrence: recurrenceSchema.optional(),
  triggerConfig: triggerConfigSchema.optional(),
  name: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(['PENDING', 'PAUSED', 'CANCELLED']).optional(),
})

export const scheduledMessageFilterSchema = paginationSchema.extend({
  workspaceId: z.string().cuid().optional(),
  channelId: z.string().cuid().optional(),
  status: scheduledMessageStatusSchema.optional(),
  scheduleType: scheduleTypeSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
})

export type CreateScheduledMessageInput = z.infer<typeof createScheduledMessageSchema>
export type UpdateScheduledMessageInput = z.infer<typeof updateScheduledMessageSchema>
export type ScheduledMessageFilter = z.infer<typeof scheduledMessageFilterSchema>

// ============================================================================
// CAMPAIGN SCHEMAS
// ============================================================================

export const campaignTypeSchema = z.enum([
  'BROADCAST',
  'NEWSLETTER',
  'FOLLOW_UP',
  'RE_ENGAGEMENT',
  'SATISFACTION',
  'PROMOTIONAL',
  'REMINDER',
  'CUSTOM',
])

export const campaignStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
])

export const audienceTypeSchema = z.enum([
  'ALL',
  'SEGMENT',
  'SPECIFIC',
  'IMPORT',
])

export const recipientStatusSchema = z.enum([
  'PENDING',
  'QUEUED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'RESPONDED',
  'FAILED',
  'SKIPPED',
  'OPT_OUT',
])

export const audienceFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  lastActiveAfter: z.string().datetime().optional(),
  lastActiveBefore: z.string().datetime().optional(),
  conversationStatus: z.array(conversationStatusSchema).optional(),
  channelType: z.array(channelTypeSchema).optional(),
  customFilters: z.record(z.unknown()).optional(),
})

export const templateConfigSchema = z.object({
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'contact_field']),
    default: z.string().optional(),
    required: z.boolean().default(false),
  })).optional(),
  bodyTemplate: z.string().optional(), // Template with {{variable}} placeholders
})

export const createCampaignSchema = z.object({
  workspaceId: z.string().cuid().optional(),
  channelId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: campaignTypeSchema,
  content: z.string().min(1).max(50000).optional(),
  contentType: messageContentTypeSchema.default('TEXT'),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  template: templateConfigSchema.optional(),
  scheduledFor: z.string().datetime().optional(),
  audienceType: audienceTypeSchema.default('ALL'),
  audienceFilter: audienceFilterSchema.optional(),
  audienceIds: z.array(z.string()).optional(),
  messagesPerMinute: z.number().int().min(1).max(100).default(30),
  delayBetweenMs: z.number().int().min(100).max(60000).default(1000),
  config: z.record(z.unknown()).optional(),
})

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  content: z.string().min(1).max(50000).optional(),
  contentType: messageContentTypeSchema.optional(),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
  template: templateConfigSchema.optional(),
  scheduledFor: z.string().datetime().optional(),
  audienceType: audienceTypeSchema.optional(),
  audienceFilter: audienceFilterSchema.optional(),
  audienceIds: z.array(z.string()).optional(),
  messagesPerMinute: z.number().int().min(1).max(100).optional(),
  delayBetweenMs: z.number().int().min(100).max(60000).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PAUSED', 'CANCELLED']).optional(),
})

export const campaignFilterSchema = paginationSchema.extend({
  workspaceId: z.string().cuid().optional(),
  channelId: z.string().cuid().optional(),
  type: campaignTypeSchema.optional(),
  status: campaignStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
})

export const addCampaignRecipientsSchema = z.object({
  recipients: z.array(z.object({
    contactId: z.string().min(1).max(255),
    contactName: z.string().max(255).optional(),
    contactInfo: z.record(z.unknown()).optional(),
    channelId: z.string().cuid().optional(),
  })).min(1).max(10000),
})

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type CampaignFilter = z.infer<typeof campaignFilterSchema>
export type AddCampaignRecipientsInput = z.infer<typeof addCampaignRecipientsSchema>
