/**
 * Clawdbot Gateway Client
 * WebSocket client for communicating with Clawdbot Gateway
 */

import { EventEmitter } from 'events';
import { clawdbotLogger } from '@/lib/logger';
import type {
  ClawdbotRequest,
  ClawdbotResponse,
  ClawdbotEvent,
  ConnectParams,
  HelloOkPayload,
  HealthStatus,
  WhatsAppGroup,
  GroupConfig,
  Message,
} from './types';

const PROTOCOL_VERSION = 3;
const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';
const DEFAULT_TIMEOUT_MS = 30000;
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

const logger = clawdbotLogger.child({ component: 'client' });

export interface ClawdbotClientOptions {
  gatewayUrl?: string;
  token?: string;
  clientId?: string;
  autoReconnect?: boolean;
  timeoutMs?: number;
  onEvent?: (event: ClawdbotEvent) => void;
}

export interface ConnectionState {
  connected: boolean;
  authenticated: boolean;
  protocol?: number;
  lastError?: string;
  reconnectAttempts: number;
}

type EventHandler = (event: ClawdbotEvent) => void;

export class ClawdbotClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<ClawdbotClientOptions>;
  private state: ConnectionState = {
    connected: false,
    authenticated: false,
    reconnectAttempts: 0,
  };
  private pendingRequests: Map<string, {
    resolve: (value: ClawdbotResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private requestIdCounter = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  constructor(options: ClawdbotClientOptions = {}) {
    super();
    this.options = {
      gatewayUrl: options.gatewayUrl || process.env.CLAWDBOT_GATEWAY_URL || DEFAULT_GATEWAY_URL,
      token: options.token || process.env.CLAWDBOT_GATEWAY_TOKEN || '',
      clientId: options.clientId || 'baas-dashboard',
      autoReconnect: options.autoReconnect ?? true,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      onEvent: options.onEvent || (() => {}),
    };
  }

  // ============================================
  // Connection Management
  // ============================================

  async connect(): Promise<HelloOkPayload> {
    if (this.ws && this.state.connected) {
      throw new Error('Already connected');
    }

    logger.info({ 
      gatewayUrl: this.options.gatewayUrl,
      clientId: this.options.clientId,
    }, 'Connecting to Clawdbot Gateway');

    return new Promise((resolve, reject) => {
      try {
        // Use dynamic import for WebSocket in Node.js environment
        const WebSocketImpl = typeof WebSocket !== 'undefined' 
          ? WebSocket 
          : require('ws');
        
        this.ws = new WebSocketImpl(this.options.gatewayUrl);

        const connectionTimeout = setTimeout(() => {
          logger.error({ 
            gatewayUrl: this.options.gatewayUrl,
            timeoutMs: this.options.timeoutMs,
          }, 'Connection timeout');
          reject(new Error('Connection timeout'));
          this.ws?.close();
        }, this.options.timeoutMs);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.state.connected = true;
          this.state.reconnectAttempts = 0;
          this.emit('connected');
          
          logger.info('WebSocket connected, sending authentication');
          
          // Send connect request
          this.sendConnectRequest()
            .then(resolve)
            .catch(reject);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnect(event.reason || 'Connection closed');
        };

        this.ws.onerror = (error) => {
          this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ err: error }, 'WebSocket error');
          this.emit('error', error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        logger.error({ err: error }, 'Failed to create WebSocket connection');
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Clawdbot Gateway');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.options.autoReconnect = false; // Prevent reconnection
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    this.state.connected = false;
    this.state.authenticated = false;
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected && this.state.authenticated;
  }

  // ============================================
  // Gateway Methods
  // ============================================

  async health(): Promise<HealthStatus> {
    const response = await this.request<HealthStatus>('health', {});
    return response.payload!;
  }

  async status(): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>('status', {});
    return response.payload!;
  }

  /**
   * Get all WhatsApp groups the bot is part of
   */
  async getGroups(): Promise<WhatsAppGroup[]> {
    logger.debug('Fetching WhatsApp groups');
    
    // Use the config.get method to get group configuration
    const response = await this.request<{ config: Record<string, unknown> }>('config.get', {});
    const config = response.payload?.config;
    
    if (!config?.channels) {
      logger.debug('No channels found in config');
      return [];
    }

    const whatsappConfig = (config.channels as Record<string, unknown>).whatsapp as Record<string, unknown> | undefined;
    if (!whatsappConfig?.groups) {
      logger.debug('No WhatsApp groups found in config');
      return [];
    }

    const groupsConfig = whatsappConfig.groups as Record<string, unknown>;
    const groups: WhatsAppGroup[] = [];

    for (const [groupId, groupSettings] of Object.entries(groupsConfig)) {
      if (groupId === '*') continue; // Skip wildcard

      groups.push({
        id: groupId,
        name: (groupSettings as Record<string, unknown>).name as string || groupId,
        description: (groupSettings as Record<string, unknown>).description as string,
      });
    }

    logger.debug({ groupCount: groups.length }, 'Found WhatsApp groups');
    return groups;
  }

  /**
   * Get configuration for a specific group
   */
  async getGroupConfig(groupId: string): Promise<GroupConfig | null> {
    logger.debug({ groupId }, 'Fetching group config');
    
    const response = await this.request<{ config: Record<string, unknown> }>('config.get', {});
    const config = response.payload?.config;
    
    const whatsappConfig = (config?.channels as Record<string, unknown>)?.whatsapp as Record<string, unknown> | undefined;
    const groupsConfig = whatsappConfig?.groups as Record<string, unknown> | undefined;
    
    if (!groupsConfig) return null;

    // Check specific group config, fall back to wildcard
    const specificConfig = groupsConfig[groupId] as Record<string, unknown> | undefined;
    const wildcardConfig = groupsConfig['*'] as Record<string, unknown> | undefined;
    
    const mergedConfig = { ...wildcardConfig, ...specificConfig };
    
    if (!mergedConfig) return null;

    return this.parseGroupConfig(mergedConfig);
  }

  /**
   * Update configuration for a specific group
   */
  async updateGroupConfig(groupId: string, config: Partial<GroupConfig>): Promise<void> {
    logger.info({ groupId, configKeys: Object.keys(config) }, 'Updating group config');
    
    // First, get current config
    const currentConfigResponse = await this.request<{ config: Record<string, unknown>; hash: string }>('config.get', {});
    const currentConfig = currentConfigResponse.payload!;

    // Build the group config in Clawdbot format
    const clawdbotGroupConfig = this.buildClawdbotGroupConfig(config);

    // Build the patch
    const patch = {
      channels: {
        whatsapp: {
          groups: {
            [groupId]: clawdbotGroupConfig,
          },
        },
      },
    };

    // Apply the patch
    await this.request('config.patch', {
      raw: JSON.stringify(patch),
      baseHash: currentConfig.hash,
    });

    logger.info({ groupId }, 'Group config updated successfully');
  }

  /**
   * Send a message to a group or user
   */
  async sendMessage(target: string, message: string, options?: {
    quotedMessageId?: string;
    mediaUrl?: string;
    mediaCaption?: string;
  }): Promise<{ messageId: string }> {
    logger.debug({ target, hasOptions: !!options }, 'Sending message');
    
    const response = await this.request<{ messageId: string }>('send', {
      target,
      message,
      ...options,
    });
    
    logger.debug({ target, messageId: response.payload?.messageId }, 'Message sent');
    return response.payload!;
  }

  /**
   * Run an agent turn
   */
  async runAgent(params: {
    message: string;
    to?: string;
    sessionKey?: string;
    stream?: boolean;
  }): Promise<{ runId: string; status: string }> {
    logger.debug({ to: params.to, stream: params.stream }, 'Running agent');
    
    const response = await this.request<{ runId: string; status: string }>('agent', params);
    
    logger.debug({ runId: response.payload?.runId, status: response.payload?.status }, 'Agent run started');
    return response.payload!;
  }

  /**
   * Get current presence list
   */
  async getPresence(): Promise<unknown[]> {
    const response = await this.request<{ entries: unknown[] }>('system-presence', {});
    return response.payload?.entries || [];
  }

  // ============================================
  // Event Subscription
  // ============================================

  onEvent(eventType: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  // ============================================
  // Private Methods
  // ============================================

  private async sendConnectRequest(): Promise<HelloOkPayload> {
    const connectParams: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.options.clientId,
        version: '1.0.0',
        platform: 'node',
        mode: 'operator',
        displayName: 'BaaS Dashboard',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      locale: 'en-US',
      userAgent: 'baas-dashboard/1.0.0',
    };

    if (this.options.token) {
      connectParams.auth = { token: this.options.token };
    }

    const response = await this.request<HelloOkPayload>('connect', connectParams);
    
    if (response.payload?.type === 'hello-ok') {
      this.state.authenticated = true;
      this.state.protocol = response.payload.protocol;
      logger.info({ 
        protocol: response.payload.protocol,
        clientId: this.options.clientId,
      }, 'Authenticated with Clawdbot Gateway');
      this.emit('authenticated', response.payload);
      return response.payload;
    }

    throw new Error('Unexpected connect response');
  }

  private async request<T>(method: string, params: Record<string, unknown>): Promise<ClawdbotResponse<T>> {
    if (!this.ws || this.ws.readyState !== 1) { // 1 = OPEN
      throw new Error('Not connected');
    }

    const id = `${this.options.clientId}-${++this.requestIdCounter}`;
    const request: ClawdbotRequest = {
      type: 'req',
      id,
      method,
      params,
    };

    logger.trace({ method, id }, 'Sending request');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        logger.warn({ method, id, timeoutMs: this.options.timeoutMs }, 'Request timeout');
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeoutMs);

      this.pendingRequests.set(id, { resolve: resolve as (value: ClawdbotResponse) => void, reject, timeout });
      
      this.ws!.send(JSON.stringify(request));
    });
  }

  private handleMessage(data: string | Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'res') {
        // Handle response
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if (message.ok) {
            logger.trace({ id: message.id }, 'Request succeeded');
            pending.resolve(message);
          } else {
            logger.debug({ 
              id: message.id, 
              error: message.error?.message,
            }, 'Request failed');
            pending.reject(new Error(message.error?.message || 'Request failed'));
          }
        }
      } else if (message.type === 'event') {
        // Handle event
        this.handleEvent(message as ClawdbotEvent);
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse message');
      this.emit('error', new Error(`Failed to parse message: ${error}`));
    }
  }

  private handleEvent(event: ClawdbotEvent): void {
    logger.debug({ event: event.event }, 'Received event');
    
    // Call global event handler
    this.options.onEvent(event);

    // Emit on EventEmitter
    this.emit('event', event);
    this.emit(event.event, event.payload);

    // Call specific handlers
    const handlers = this.eventHandlers.get(event.event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          logger.error({ 
            err: error, 
            event: event.event,
          }, 'Event handler error');
        }
      }
    }
  }

  private handleDisconnect(reason: string): void {
    this.state.connected = false;
    this.state.authenticated = false;
    this.state.lastError = reason;
    this.ws = null;

    logger.warn({ reason }, 'Disconnected from Clawdbot Gateway');

    this.emit('disconnected', reason);

    if (this.options.autoReconnect && this.state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.state.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.state.reconnectAttempts - 1);

    logger.info({ 
      attempt: this.state.reconnectAttempts, 
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      delayMs: delay,
    }, 'Scheduling reconnection');

    this.emit('reconnecting', { attempt: this.state.reconnectAttempts, delay });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch (error) {
        logger.error({ 
          err: error, 
          attempt: this.state.reconnectAttempts,
        }, 'Reconnection attempt failed');
        // Will retry on next disconnect if attempts remaining
      }
    }, delay);
  }

  private parseGroupConfig(raw: Record<string, unknown>): GroupConfig {
    return {
      requireMention: raw.requireMention as boolean ?? true,
      mentionPatterns: raw.mentionPatterns as string[] | undefined,
      enabled: raw.enabled !== false,
      historyLimit: raw.historyLimit as number | undefined,
      agentId: raw.agentId as string | undefined,
      systemPrompt: raw.systemPrompt as string | undefined,
      personality: raw.personality as GroupConfig['personality'] | undefined,
      rateLimit: raw.rateLimit as GroupConfig['rateLimit'] | undefined,
      features: raw.features as GroupConfig['features'] | undefined,
    };
  }

  private buildClawdbotGroupConfig(config: Partial<GroupConfig>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (config.requireMention !== undefined) {
      result.requireMention = config.requireMention;
    }

    if (config.mentionPatterns) {
      result.mentionPatterns = config.mentionPatterns;
    }

    if (config.enabled !== undefined) {
      result.enabled = config.enabled;
    }

    if (config.historyLimit !== undefined) {
      result.historyLimit = config.historyLimit;
    }

    if (config.agentId) {
      result.agentId = config.agentId;
    }

    if (config.systemPrompt) {
      result.systemPrompt = config.systemPrompt;
    }

    // Personality is handled separately via config-mapper
    if (config.personality) {
      result.personality = config.personality;
    }

    if (config.rateLimit) {
      result.rateLimit = config.rateLimit;
    }

    if (config.features) {
      result.features = config.features;
    }

    return result;
  }
}

// ============================================
// Singleton Instance
// ============================================

let defaultClient: ClawdbotClient | null = null;

export function getClawdbotClient(options?: ClawdbotClientOptions): ClawdbotClient {
  if (!defaultClient) {
    defaultClient = new ClawdbotClient(options);
  }
  return defaultClient;
}

export function resetClawdbotClient(): void {
  if (defaultClient) {
    defaultClient.disconnect();
    defaultClient = null;
  }
}

// ============================================
// HTTP Client (for REST API fallback)
// ============================================

export class ClawdbotHttpClient {
  private baseUrl: string;
  private token?: string;

  constructor(options?: { baseUrl?: string; token?: string }) {
    this.baseUrl = options?.baseUrl || process.env.CLAWDBOT_HTTP_URL || 'http://127.0.0.1:18789';
    this.token = options?.token || process.env.CLAWDBOT_GATEWAY_TOKEN;
  }

  async health(): Promise<HealthStatus> {
    const response = await this.fetch('/health');
    return response as HealthStatus;
  }

  async chatCompletions(params: {
    model: string;
    messages: { role: string; content: string }[];
    max_tokens?: number;
    stream?: boolean;
  }): Promise<unknown> {
    return this.fetch('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    logger.debug({ path, method: options.method || 'GET' }, 'HTTP request');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ 
        path, 
        status: response.status, 
        error,
      }, 'HTTP request failed');
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return response.json();
  }
}
