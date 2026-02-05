import { z } from 'zod'
import { paginationSchema } from './validate'

// ============================================================================
// QUICK ACTION SCHEMAS
// ============================================================================

export const quickActionTypeSchema = z.enum([
  'SUMMARIZE',
  'SEARCH',
  'REMIND',
  'TRANSLATE',
  'TRANSCRIBE',
  'MUTE',
  'STATUS',
  'HELP',
  'CUSTOM',
])

export const actionTriggerTypeSchema = z.enum([
  'COMMAND',
  'KEYWORD',
  'REGEX',
])

export const actionExecutionStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
])

// Create action schema
export const createQuickActionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trigger: z.string().min(1).max(50).regex(/^\/[a-zA-Z0-9_-]+$/, {
    message: 'Trigger must start with / and contain only letters, numbers, _ or -',
  }),
  type: quickActionTypeSchema,
  config: z.record(z.unknown()).optional(),
  triggerType: actionTriggerTypeSchema.default('COMMAND'),
  triggerConfig: z.record(z.unknown()).optional(),
  responseTemplate: z.string().max(2000).optional(),
  errorTemplate: z.string().max(500).optional(),
  allowedRoles: z.array(z.string()).optional(),
  cooldownSeconds: z.number().int().min(0).max(3600).default(0),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

// Update action schema
export const updateQuickActionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  trigger: z.string().min(1).max(50).regex(/^\/[a-zA-Z0-9_-]+$/).optional(),
  type: quickActionTypeSchema.optional(),
  config: z.record(z.unknown()).optional(),
  triggerType: actionTriggerTypeSchema.optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  responseTemplate: z.string().max(2000).optional().nullable(),
  errorTemplate: z.string().max(500).optional().nullable(),
  allowedRoles: z.array(z.string()).optional(),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// Execute action schema
export const executeActionSchema = z.object({
  message: z.string().min(1).max(10000),
  channelId: z.string().min(1).max(255),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  args: z.array(z.string()).optional(),
  recentMessages: z.array(z.object({
    id: z.string(),
    content: z.string(),
    role: z.enum(['user', 'bot', 'operator', 'system']),
    senderName: z.string().optional(),
    createdAt: z.string().datetime(),
    attachments: z.array(z.object({
      type: z.enum(['image', 'audio', 'video', 'document']),
      url: z.string().url(),
      filename: z.string().optional(),
      mimeType: z.string().optional(),
    })).optional(),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Filter schemas
export const quickActionFilterSchema = paginationSchema.extend({
  type: quickActionTypeSchema.optional(),
  triggerType: actionTriggerTypeSchema.optional(),
  isEnabled: z.coerce.boolean().optional(),
  isBuiltin: z.coerce.boolean().optional(),
  search: z.string().optional(),
})

export const executionHistoryFilterSchema = paginationSchema.extend({
  actionId: z.string().cuid().optional(),
  channelId: z.string().optional(),
  status: actionExecutionStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

// Types
export type CreateQuickActionInput = z.infer<typeof createQuickActionSchema>
export type UpdateQuickActionInput = z.infer<typeof updateQuickActionSchema>
export type ExecuteActionInput = z.infer<typeof executeActionSchema>
export type QuickActionFilter = z.infer<typeof quickActionFilterSchema>
export type ExecutionHistoryFilter = z.infer<typeof executionHistoryFilterSchema>
