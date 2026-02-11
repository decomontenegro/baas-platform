/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Webhook API Route
 * POST: Receives events from Clawdbot Gateway (messages, status changes, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClawdbotWebhookHandler } from '@/lib/clawdbot/sync';
import { webhookLogger, startTiming } from '@/lib/logger';
import { runWithContext, createNextContext } from '@/lib/logger/context';
import type {
  WebhookEvent,
  MessageReceivedEvent,
  MessageSentEvent,
  GroupJoinedEvent,
  AgentResponseEvent,
  ApiResponse,
} from '@/lib/clawdbot/types';
import crypto from 'crypto';

const logger = webhookLogger.child({ endpoint: 'clawdbot-webhook' });

// Placeholder for database client
const db = {
  channels: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async (data: unknown) => data,
    update: async (data: unknown) => data,
    delete: async () => {},
    upsert: async (data: unknown) => data,
  },
  syncStatus: {
    findUnique: async () => null,
    upsert: async (data: unknown) => data,
  },
  Message: {
    create: async (data: unknown) => data,
  },
  analytics: {
    increment: async (key: string, value: number) => {},
    record: async (data: unknown) => {},
  },
  organizations: {
    findByWebhookSecret: async (secret: string) => ({ id: 'org_123' }),
  },
} as any;

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.CLAWDBOT_WEBHOOK_SECRET;

/**
 * Verify webhook signature from Clawdbot
 */
function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

/**
 * POST /api/clawdbot/webhook
 * Receive events from Clawdbot Gateway
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ received: boolean }>>> {
  const context = createNextContext(request);
  
  return runWithContext(context, async () => {
    const timing = startTiming('webhook-processing', { requestId: context.requestId });
    
    try {
      const rawBody = await request.text();
      const signature = request.headers.get('x-clawdbot-signature');
      const webhookSecret = request.headers.get('x-webhook-secret') || WEBHOOK_SECRET;

      // Verify signature if secret is configured
      if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
        logger.warn({ 
          hasSignature: !!signature,
          hasSecret: !!webhookSecret,
        }, 'Webhook signature verification failed');
        
        return NextResponse.json(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' },
          },
          { status: 401 }
        );
      }

      const event = JSON.parse(rawBody) as WebhookEvent;
      
      logger.debug({ 
        eventType: event.type, 
        timestamp: event.timestamp,
      }, 'Webhook event received');

      // Get organization from webhook secret or header
      const organizationId = request.headers.get('x-organization-id');
      if (!organizationId) {
        // Try to find org by webhook secret
        const org = await db.organizations.findByWebhookSecret(webhookSecret);
        if (!org) {
          logger.warn('Organization not found for webhook');
          return NextResponse.json(
            {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Organization not found' },
            },
            { status: 401 }
          );
        }
      }

      const resolvedOrgId = organizationId || 'org_123'; // TODO: Use actual org lookup

      // Process the event
      await processWebhookEvent(event, resolvedOrgId);

      timing.end({ eventType: event.type, organizationId: resolvedOrgId });

      return NextResponse.json({
        success: true,
        data: { received: true },
      });
    } catch (error) {
      logger.error({ err: error }, 'Webhook processing error');
      
      timing.end({ error: true });
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to process webhook',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 }
      );
    }
  });
}

/**
 * Process incoming webhook events
 */
async function processWebhookEvent(event: WebhookEvent, organizationId: string): Promise<void> {
  logger.info({ 
    eventType: event.type, 
    organizationId, 
    timestamp: event.timestamp,
  }, 'Processing webhook event');

  switch (event.type) {
    case 'message.received':
      await handleMessageReceived(event, organizationId);
      break;

    case 'message.sent':
      await handleMessageSent(event, organizationId);
      break;

    case 'group.joined':
      await handleGroupJoined(event, organizationId);
      break;

    case 'group.left':
      await handleGroupLeft(event, organizationId);
      break;

    case 'status.change':
      await handleStatusChange(event, organizationId);
      break;

    case 'agent.response':
      await handleAgentResponse(event, organizationId);
      break;

    default:
      logger.debug({ eventType: (event as any).type }, 'Unhandled webhook event type');
  }
}

/**
 * Handle incoming message event
 */
async function handleMessageReceived(event: MessageReceivedEvent, organizationId: string): Promise<void> {
  const { message } = event;

  logger.debug({ 
    messageId: message.id, 
    groupId: message.groupId, 
    from: message.from,
    type: message.type,
    organizationId,
  }, 'Message received');

  // Route message to appropriate bot for response
  try {
    const { processIncomingMessage } = await import('@/lib/clawdbot/message-router');
    const result = await processIncomingMessage(event, organizationId);
    
    logger.debug({
      messageId: message.id,
      processed: result.processed,
      responded: result.responded,
      channelId: result.channelId,
    }, 'Message routing complete');
  } catch (routingError) {
    logger.error({ err: routingError, messageId: message.id }, 'Message routing failed');
  }

  // Update channel stats
  if (message.groupId) {
    await db.channels.update({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: message.groupId,
        },
      },
      data: {
        lastMessageAt: new Date(),
        $inc: { 'stats.totalMessages': 1, 'stats.messagesThisMonth': 1 },
      },
    });

    // Increment analytics
    await db.analytics.increment(`messages:received:${organizationId}`, 1);
    await db.analytics.increment(`messages:received:${organizationId}:${message.groupId}`, 1);
  }

  // Emit real-time event (if using websockets for dashboard updates)
  await emitRealtimeEvent(organizationId, 'message.received', {
    groupId: message.groupId,
    from: message.from,
    type: message.type,
    timestamp: event.timestamp,
  });
}

/**
 * Handle outgoing message event
 */
async function handleMessageSent(event: MessageSentEvent, organizationId: string): Promise<void> {
  const { message } = event;

  logger.debug({ 
    messageId: message.id, 
    groupId: message.groupId,
    organizationId,
  }, 'Message sent');

  // Log outgoing message
  await db.Message.create({
    data: {
      organizationId,
      clawdbotMessageId: message.id,
      groupId: message.groupId,
      from: message.from,
      type: message.type,
      isFromMe: true,
      isGroup: message.isGroup,
      timestamp: new Date(message.timestamp),
    },
  });

  // Update channel stats
  if (message.groupId) {
    await db.channels.update({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: message.groupId,
        },
      },
      data: {
        $inc: { 'stats.totalResponses': 1, 'stats.responsesThisMonth': 1 },
      },
    });

    await db.analytics.increment(`messages:sent:${organizationId}`, 1);
  }
}

/**
 * Handle new group joined event
 */
async function handleGroupJoined(event: GroupJoinedEvent, organizationId: string): Promise<void> {
  const { group } = event;

  logger.info({ 
    groupId: group.id, 
    groupName: group.name,
    organizationId,
  }, 'Bot joined new group');

  // Use the sync handler
  const webhookHandler = new ClawdbotWebhookHandler(db, {
    onNewGroup: async (newGroup, orgId) => {
      // Notify dashboard about new group
      await emitRealtimeEvent(orgId, 'group.new', {
        groupId: newGroup.id,
        groupName: newGroup.name,
        timestamp: event.timestamp,
      });

      logger.info({ 
        groupId: newGroup.id, 
        groupName: newGroup.name, 
        organizationId: orgId,
      }, 'New group detected and created');
    },
  });

  await webhookHandler.handleEvent(event, organizationId);
}

/**
 * Handle group left event
 */
async function handleGroupLeft(event: { type: 'group.left'; timestamp: number; groupId: string; reason?: string }, organizationId: string): Promise<void> {
  const { groupId, reason } = event;

  logger.info({ 
    groupId, 
    reason,
    organizationId,
  }, 'Bot left group');

  // Update channel status
  await db.channels.update({
    where: {
      organizationId_clawdbotGroupId: {
        organizationId,
        clawdbotGroupId: groupId,
      },
    },
    data: {
      status: 'inactive',
      updatedAt: new Date(),
    },
  });

  // Notify dashboard
  await emitRealtimeEvent(organizationId, 'group.left', {
    groupId,
    reason,
    timestamp: event.timestamp,
  });
}

/**
 * Handle status change event
 */
async function handleStatusChange(
  event: { type: 'status.change'; timestamp: number; status: string; accountId?: string },
  organizationId: string
): Promise<void> {
  const { status, accountId } = event;

  logger.info({ 
    status, 
    accountId,
    organizationId,
  }, 'Status change event');

  // Log status change
  await db.analytics.record({
    type: 'status_change',
    organizationId,
    accountId,
    status,
    timestamp: new Date(event.timestamp),
  });

  // Notify dashboard
  await emitRealtimeEvent(organizationId, 'status.change', {
    status,
    accountId,
    timestamp: event.timestamp,
  });

  // If disconnected, could trigger alerts
  if (status === 'offline') {
    logger.warn({ organizationId, accountId }, 'Clawdbot went offline');
    // TODO: Send alert to org admins
  }
}

/**
 * Handle agent response event
 */
async function handleAgentResponse(event: AgentResponseEvent, organizationId: string): Promise<void> {
  const { runId, status, inputTokens, outputTokens, durationMs, error } = event;

  logger.debug({ 
    runId, 
    status, 
    inputTokens, 
    outputTokens, 
    durationMs,
    organizationId,
  }, 'Agent response event');

  // Record agent run for analytics and billing
  await db.analytics.record({
    type: 'agent_run',
    organizationId,
    runId,
    status,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    totalTokens: (inputTokens || 0) + (outputTokens || 0),
    durationMs: durationMs || 0,
    error: error || null,
    timestamp: new Date(event.timestamp),
  });

  // Update token usage for billing
  if (inputTokens || outputTokens) {
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);
    await db.analytics.increment(`tokens:used:${organizationId}`, totalTokens);
    await db.analytics.increment(`tokens:used:${organizationId}:${new Date().toISOString().slice(0, 7)}`, totalTokens);
  }

  // Track response time for analytics
  if (durationMs) {
    await db.analytics.record({
      type: 'response_time',
      organizationId,
      durationMs,
      timestamp: new Date(event.timestamp),
    });
  }

  // If error, could trigger alerts
  if (status === 'error') {
    logger.error({ 
      runId, 
      error,
      organizationId,
    }, 'Agent run error');
    // TODO: Aggregate errors and alert if threshold exceeded
  }
}

/**
 * Emit real-time event to connected dashboard clients
 * This is a placeholder - implement with your real-time solution
 */
async function emitRealtimeEvent(organizationId: string, eventType: string, data: unknown): Promise<void> {
  // TODO: Implement with Pusher, Socket.io, Redis Pub/Sub, or similar
  logger.trace({ 
    organizationId, 
    eventType,
  }, 'Emitting realtime event');
  
  // Example with Pusher:
  // await pusher.trigger(`private-org-${organizationId}`, eventType, data);
  
  // Example with Redis:
  // await redis.publish(`org:${organizationId}:events`, JSON.stringify({ type: eventType, data }));
}

/**
 * GET /api/clawdbot/webhook
 * Health check endpoint for webhook
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'clawdbot-webhook',
    timestamp: new Date().toISOString(),
  });
}
