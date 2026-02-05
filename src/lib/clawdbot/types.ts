/**
 * Clawdbot Integration Types
 * Types for the BaaS Dashboard <-> Clawdbot Gateway communication
 */

// ============================================
// Gateway Protocol Types
// ============================================

export interface ClawdbotRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface ClawdbotResponse<T = unknown> {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: T;
  error?: ClawdbotError;
}

export interface ClawdbotEvent<T = unknown> {
  type: 'event';
  event: string;
  payload: T;
  seq?: number;
  stateVersion?: number;
}

export interface ClawdbotError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// ============================================
// Connection Types
// ============================================

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: ClientInfo;
  role: 'operator' | 'node';
  scopes: string[];
  caps?: string[];
  commands?: string[];
  auth?: { token: string };
  locale?: string;
  userAgent?: string;
}

export interface ClientInfo {
  id: string;
  version: string;
  platform: string;
  mode: 'operator' | 'node';
  displayName?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  instanceId?: string;
}

export interface HelloOkPayload {
  type: 'hello-ok';
  protocol: number;
  policy: {
    tickIntervalMs: number;
    maxPayload?: number;
    maxBufferedBytes?: number;
  };
  snapshot?: {
    presence?: PresenceEntry[];
    health?: HealthStatus;
    stateVersion?: number;
    uptimeMs?: number;
  };
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
  };
}

// ============================================
// Health & Status Types
// ============================================

export interface HealthStatus {
  ok: boolean;
  version: string;
  uptime: number;
  linkedChannel?: string;
  channels?: ChannelStatus[];
  models?: ModelStatus[];
}

export interface ChannelStatus {
  id: string;
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal' | 'imessage';
  linked: boolean;
  accountId?: string;
  displayName?: string;
}

export interface ModelStatus {
  id: string;
  provider: string;
  available: boolean;
}

export interface PresenceEntry {
  host: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  lastInputSeconds?: number;
  ts?: number;
  reason?: string;
  tags?: string[];
  instanceId?: string;
}

// ============================================
// WhatsApp Group Types
// ============================================

export interface WhatsAppGroup {
  id: string;               // e.g., "EXAMPLE_GROUP_ID@g.us"
  name: string;
  description?: string;
  participants?: GroupParticipant[];
  participantCount?: number;
  owner?: string;
  admins?: string[];
  createdAt?: number;
  inviteCode?: string;
  isReadOnly?: boolean;
  announce?: boolean;       // Only admins can send
}

export interface GroupParticipant {
  id: string;               // JID e.g., "5511999999999@s.whatsapp.net"
  name?: string;
  pushName?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

// ============================================
// Group Configuration Types
// ============================================

export interface GroupConfig {
  // Mention gating
  requireMention: boolean;
  mentionPatterns?: string[];
  
  // Response behavior
  enabled: boolean;
  historyLimit?: number;
  
  // Personality settings (mapped from dashboard)
  personality?: PersonalityConfig;
  
  // Agent binding
  agentId?: string;
  
  // Custom system prompt
  systemPrompt?: string;
  
  // Rate limiting
  rateLimit?: {
    maxMessagesPerMinute?: number;
    maxTokensPerDay?: number;
  };
  
  // Features
  features?: {
    imageAnalysis?: boolean;
    voiceMessages?: boolean;
    codeExecution?: boolean;
    webSearch?: boolean;
  };
}

export interface PersonalityConfig {
  // Slider values (0-100)
  formality: number;      // Casual <-> Formal
  verbosity: number;      // Concise <-> Verbose  
  creativity: number;     // Conservative <-> Creative
  empathy: number;        // Neutral <-> Empathetic
  humor: number;          // Serious <-> Playful
  
  // Optional overrides
  tone?: string;          // e.g., "professional", "friendly", "technical"
  language?: string;      // e.g., "pt-BR", "en-US"
  customInstructions?: string;
}

// ============================================
// Message Types
// ============================================

export interface Message {
  id: string;
  timestamp: number;
  from: string;
  fromName?: string;
  to: string;
  body?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'reaction';
  mediaUrl?: string;
  mediaCaption?: string;
  quotedMessage?: QuotedMessage;
  isFromMe: boolean;
  isMention?: boolean;
  isGroup: boolean;
  groupId?: string;
}

export interface QuotedMessage {
  id: string;
  from: string;
  body?: string;
  type: string;
}

// ============================================
// Webhook Payload & Event Types
// ============================================

/**
 * Signed webhook payload wrapper
 * All webhook requests from Clawdbot should follow this structure
 */
export interface WebhookPayload<T = WebhookEvent> {
  /** Unix timestamp in milliseconds when the webhook was generated */
  timestamp: number;
  /** HMAC-SHA256 signature of the payload (in header: x-clawdbot-signature) */
  signature?: string;
  /** Event type identifier */
  event: string;
  /** Event-specific data */
  data: T;
  /** Optional nonce for additional replay protection */
  nonce?: string;
  /** Webhook source identifier */
  source?: {
    gatewayId?: string;
    instanceId?: string;
    version?: string;
  };
}

/**
 * Raw webhook request as received (before parsing)
 */
export interface RawWebhookRequest {
  /** Raw body as string (for signature verification) */
  rawBody: string;
  /** Signature from x-clawdbot-signature header */
  signature: string | null;
  /** Timestamp from x-clawdbot-timestamp header (fallback) */
  timestampHeader: string | null;
  /** Source IP address */
  sourceIp: string | null;
  /** Organization ID from header */
  organizationId: string | null;
  /** Webhook secret from header (optional, for multi-tenant) */
  webhookSecret: string | null;
}

export type WebhookEvent = 
  | MessageReceivedEvent
  | MessageSentEvent
  | GroupJoinedEvent
  | GroupLeftEvent
  | StatusChangeEvent
  | AgentResponseEvent;

export interface MessageReceivedEvent {
  type: 'message.received';
  timestamp: number;
  message: Message;
  accountId?: string;
}

export interface MessageSentEvent {
  type: 'message.sent';
  timestamp: number;
  message: Message;
  accountId?: string;
}

export interface GroupJoinedEvent {
  type: 'group.joined';
  timestamp: number;
  group: WhatsAppGroup;
  accountId?: string;
}

export interface GroupLeftEvent {
  type: 'group.left';
  timestamp: number;
  groupId: string;
  reason?: string;
  accountId?: string;
}

export interface StatusChangeEvent {
  type: 'status.change';
  timestamp: number;
  status: 'online' | 'offline' | 'reconnecting';
  accountId?: string;
}

export interface AgentResponseEvent {
  type: 'agent.response';
  timestamp: number;
  runId: string;
  status: 'started' | 'completed' | 'error';
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  error?: string;
}

// ============================================
// Sync Types (Dashboard <-> Clawdbot)
// ============================================

export interface SyncResult {
  success: boolean;
  timestamp: number;
  added: string[];
  updated: string[];
  removed: string[];
  errors: SyncError[];
}

export interface SyncError {
  groupId: string;
  error: string;
  recoverable: boolean;
}

export interface ChannelSyncStatus {
  lastSyncAt: number;
  lastSyncResult?: SyncResult;
  syncInProgress: boolean;
  totalGroups: number;
  activeGroups: number;
}

// ============================================
// Dashboard-specific Types
// ============================================

export interface DashboardChannel {
  id: string;                    // DB ID
  clawdbotGroupId: string;       // Clawdbot group JID
  name: string;
  organizationId: string;
  type: 'whatsapp_group' | 'telegram_group' | 'discord_channel';
  status: 'active' | 'inactive' | 'pending' | 'error';
  config: GroupConfig;
  stats?: ChannelStats;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export interface ChannelStats {
  totalMessages: number;
  messagesThisMonth: number;
  totalResponses: number;
  responsesThisMonth: number;
  avgResponseTimeMs: number;
  tokensUsed: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
