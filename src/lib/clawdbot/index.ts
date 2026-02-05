/**
 * Clawdbot Integration Module
 * Main entry point for Clawdbot integration in the BaaS Dashboard
 */

// Client exports
export {
  ClawdbotClient,
  ClawdbotHttpClient,
  getClawdbotClient,
  resetClawdbotClient,
  type ClawdbotClientOptions,
  type ConnectionState,
} from './client';

// Types exports
export type {
  // Protocol types
  ClawdbotRequest,
  ClawdbotResponse,
  ClawdbotEvent,
  ClawdbotError,
  ConnectParams,
  ClientInfo,
  HelloOkPayload,

  // Health & Status
  HealthStatus,
  ChannelStatus,
  ModelStatus,
  PresenceEntry,

  // WhatsApp types
  WhatsAppGroup,
  GroupParticipant,

  // Configuration
  GroupConfig,
  PersonalityConfig,

  // Messages
  Message,
  QuotedMessage,

  // Webhooks
  WebhookPayload,
  RawWebhookRequest,
  WebhookEvent,
  MessageReceivedEvent,
  MessageSentEvent,
  GroupJoinedEvent,
  GroupLeftEvent,
  StatusChangeEvent,
  AgentResponseEvent,

  // Sync
  SyncResult,
  SyncError,
  ChannelSyncStatus,
  DashboardChannel,
  ChannelStats,

  // API
  ApiResponse,
  PaginatedResponse,
} from './types';

// Webhook Security exports
export {
  verifyWebhookSignature,
  verifyWebhookTimestamp,
  verifySourceIp,
  verifyWebhook,
  generateWebhookSecret,
  createWebhookSignature,
  logWebhookSecurityEvent,
  type WebhookVerificationResult,
  type WebhookSecurityError,
  type WebhookErrorCode,
  type WebhookVerificationOptions,
} from './webhook-security';

// Sync exports
export {
  ClawdbotSyncService,
  ClawdbotWebhookHandler,
  type SyncOptions,
  type SyncProgress,
} from './sync';

// Config mapper exports
export {
  personalityToSystemPrompt,
  dashboardToClawdbotConfig,
  clawdbotToDashboardConfig,
  validateGroupConfig,
  diffConfigs,
  getPresetById,
  PERSONALITY_PRESETS,
  type SystemPromptOptions,
  type ClawdbotGroupConfig,
  type ClawdbotChannelConfig,
  type ClawdbotAgentConfig,
  type PersonalityPreset,
  type ConfigValidationResult,
  type ConfigDiff,
} from './config-mapper';

// Message Router exports
export {
  routeMessage,
  processIncomingMessage,
} from './message-router';

// Auth exports
export {
  getAuthenticatedUser,
  hasPermission,
  requirePermission,
  type AuthenticatedUser,
  type AuthResult,
} from './auth';

// ============================================
// Quick Start Examples
// ============================================

/**
 * Example: Connect to Clawdbot and list groups
 * 
 * ```typescript
 * import { getClawdbotClient } from '@/lib/clawdbot';
 * 
 * const client = getClawdbotClient({
 *   gatewayUrl: 'ws://127.0.0.1:18789',
 *   token: process.env.CLAWDBOT_GATEWAY_TOKEN,
 * });
 * 
 * await client.connect();
 * const groups = await client.getGroups();
 * console.log('Groups:', groups);
 * ```
 */

/**
 * Example: Update group personality
 * 
 * ```typescript
 * import { getClawdbotClient, personalityToSystemPrompt } from '@/lib/clawdbot';
 * 
 * const client = getClawdbotClient();
 * await client.connect();
 * 
 * const personality = {
 *   formality: 70,
 *   verbosity: 50,
 *   creativity: 40,
 *   empathy: 80,
 *   humor: 30,
 * };
 * 
 * const systemPrompt = personalityToSystemPrompt({ personality });
 * 
 * await client.updateGroupConfig('EXAMPLE_GROUP_ID@g.us', {
 *   personality,
 *   systemPrompt,
 *   requireMention: true,
 * });
 * ```
 */

/**
 * Example: Sync groups with database
 * 
 * ```typescript
 * import { ClawdbotSyncService } from '@/lib/clawdbot';
 * import { prisma } from '@/lib/prisma';
 * 
 * const syncService = new ClawdbotSyncService(prisma);
 * 
 * const result = await syncService.syncGroups({
 *   organizationId: 'org_123',
 *   onProgress: (progress) => {
 *     console.log(`${progress.stage}: ${progress.current}/${progress.total}`);
 *   },
 * });
 * 
 * console.log('Sync complete:', result);
 * ```
 */

/**
 * Example: Handle webhooks
 * 
 * ```typescript
 * import { ClawdbotWebhookHandler } from '@/lib/clawdbot';
 * import { prisma } from '@/lib/prisma';
 * 
 * const handler = new ClawdbotWebhookHandler(prisma, {
 *   onNewGroup: async (group, orgId) => {
 *     // Send notification about new group
 *     await sendNotification(orgId, `New group joined: ${group.name}`);
 *   },
 * });
 * 
 * // In your webhook route:
 * await handler.handleEvent(event, organizationId);
 * ```
 */
