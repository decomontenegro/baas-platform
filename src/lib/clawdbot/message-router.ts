/**
 * Clawdbot Message Router
 * Routes incoming messages to the appropriate bot, applies personality,
 * and sends responses through the Gateway
 */

import { getClawdbotClient } from './client';
import { prisma } from '@/lib/prisma';
import { clawdbotLogger } from '@/lib/logger';
import type { Message, GroupConfig, PersonalityConfig } from './types';

const logger = clawdbotLogger.child({ component: 'message-router' });

interface RouteResult {
  processed: boolean;
  responded: boolean;
  response?: string;
  error?: string;
  channelId?: string;
  botId?: string;
}

interface ChannelContext {
  channelId: string;
  workspaceId: string;
  tenantId: string;
  config: GroupConfig;
  botId?: string;
  personality?: PersonalityConfig;
  knowledgeBaseId?: string;
  systemPrompt?: string;
}

/**
 * Route and process an incoming message
 */
export async function routeMessage(
  message: Message,
  tenantId: string
): Promise<RouteResult> {
  const startTime = Date.now();

  logger.debug({
    messageId: message.id,
    groupId: message.groupId,
    from: message.from,
    tenantId,
  }, 'Routing message');

  try {
    // Skip our own messages
    if (message.isFromMe) {
      return { processed: false, responded: false };
    }

    // Get channel context
    const context = await getChannelContext(message.groupId || message.to, tenantId);
    
    if (!context) {
      logger.debug({ groupId: message.groupId }, 'No channel context found, skipping');
      return { processed: false, responded: false };
    }

    // Check if bot is enabled for this channel
    if (!context.config.enabled) {
      logger.debug({ channelId: context.channelId }, 'Bot disabled for this channel');
      return { processed: true, responded: false, channelId: context.channelId };
    }

    // Check mention requirement
    if (context.config.requireMention && !message.isMention) {
      // Check custom mention patterns
      const mentionPatterns = context.config.mentionPatterns || [];
      const hasMentionPattern = mentionPatterns.some(pattern => 
        message.body?.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (!hasMentionPattern) {
        logger.debug({ channelId: context.channelId }, 'Mention required but not found');
        return { processed: true, responded: false, channelId: context.channelId };
      }
    }

    // Generate response
    const response = await generateResponse(message, context);

    if (!response) {
      logger.debug({ channelId: context.channelId }, 'No response generated');
      return { processed: true, responded: false, channelId: context.channelId };
    }

    // Send response
    const client = getClawdbotClient();
    if (!client.isConnected()) {
      await client.connect();
    }

    await client.sendMessage(message.groupId || message.from, response, {
      quotedMessageId: message.id,
    });

    const durationMs = Date.now() - startTime;
    logger.info({
      channelId: context.channelId,
      messageId: message.id,
      durationMs,
    }, 'Message processed and responded');

    // Record analytics
    await recordMessageAnalytics(context, message, response, durationMs);

    return {
      processed: true,
      responded: true,
      response,
      channelId: context.channelId,
      botId: context.botId,
    };
  } catch (error) {
    logger.error({ err: error, messageId: message.id }, 'Message routing failed');
    return {
      processed: true,
      responded: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get channel context from database
 */
async function getChannelContext(
  groupId: string | undefined,
  tenantId: string
): Promise<ChannelContext | null> {
  if (!groupId) return null;

  const channel = await prisma.channel.findFirst({
    where: {
      externalId: groupId,
      workspace: {
        tenantId,
        isActive: true,
      },
    },
    include: {
      workspace: {
        include: {
          personalities: {
            where: { isActive: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!channel) return null;

  const settings = channel.settings as Record<string, unknown> || {};
  const clawdbotConfig = settings.clawdbot as GroupConfig || {};

  return {
    channelId: channel.id,
    workspaceId: channel.workspaceId,
    tenantId,
    config: {
      enabled: channel.isActive,
      requireMention: clawdbotConfig.requireMention ?? true,
      mentionPatterns: clawdbotConfig.mentionPatterns,
      historyLimit: clawdbotConfig.historyLimit ?? 50,
      personality: clawdbotConfig.personality,
      features: clawdbotConfig.features,
      systemPrompt: clawdbotConfig.systemPrompt,
    },
    botId: settings.botId as string | undefined,
    personality: clawdbotConfig.personality || channel.workspace.personalities[0]?.sliders as PersonalityConfig | undefined,
    knowledgeBaseId: settings.knowledgeBaseId as string | undefined,
    systemPrompt: clawdbotConfig.systemPrompt,
  };
}

/**
 * Generate AI response based on message and context
 */
async function generateResponse(
  message: Message,
  context: ChannelContext
): Promise<string | null> {
  // Build system prompt based on personality
  const systemPrompt = buildSystemPrompt(context);

  // Get conversation history if available
  const history = await getConversationHistory(
    context.channelId,
    context.config.historyLimit || 50
  );

  // Use Clawdbot's agent to generate response
  const client = getClawdbotClient();
  
  if (!client.isConnected()) {
    await client.connect();
  }

  try {
    // Run the agent
    const result = await client.runAgent({
      message: message.body || '',
      to: message.groupId || message.from,
      sessionKey: `${context.channelId}:${message.from}`,
      stream: false,
    });

    logger.debug({ runId: result.runId, status: result.status }, 'Agent run completed');
    
    // The agent handles the response internally through Clawdbot
    // Return null here since the agent sends the message directly
    return null;
  } catch (error) {
    logger.error({ err: error }, 'Agent run failed, falling back to simple response');
    
    // Fallback: generate simple response
    return generateSimpleResponse(message, context, systemPrompt);
  }
}

/**
 * Build system prompt based on personality settings
 */
function buildSystemPrompt(context: ChannelContext): string {
  const parts: string[] = [];

  // Base prompt
  if (context.systemPrompt) {
    parts.push(context.systemPrompt);
  }

  // Personality modifiers
  if (context.personality) {
    const p = context.personality;
    
    // Formality (0 = casual, 100 = formal)
    if (p.formality < 30) {
      parts.push('Use casual, friendly language. Feel free to use contractions and informal expressions.');
    } else if (p.formality > 70) {
      parts.push('Maintain a formal, professional tone. Use proper grammar and avoid slang.');
    }

    // Verbosity (0 = concise, 100 = verbose)
    if (p.verbosity < 30) {
      parts.push('Keep responses short and to the point. Be concise.');
    } else if (p.verbosity > 70) {
      parts.push('Provide detailed, comprehensive responses with examples when helpful.');
    }

    // Creativity (0 = conservative, 100 = creative)
    if (p.creativity > 70) {
      parts.push('Be creative and think outside the box. Suggest unique ideas.');
    }

    // Empathy (0 = neutral, 100 = empathetic)
    if (p.empathy > 70) {
      parts.push('Be warm and empathetic. Acknowledge feelings and show understanding.');
    }

    // Humor (0 = serious, 100 = playful)
    if (p.humor > 70) {
      parts.push('Feel free to use humor and be playful when appropriate.');
    } else if (p.humor < 30) {
      parts.push('Maintain a serious, straightforward tone. Avoid jokes.');
    }

    // Custom tone
    if (p.tone) {
      parts.push(`Overall tone should be: ${p.tone}`);
    }

    // Language
    if (p.language) {
      parts.push(`Respond in ${p.language}`);
    }

    // Custom instructions
    if (p.customInstructions) {
      parts.push(p.customInstructions);
    }
  }

  return parts.join('\n\n');
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  channelId: string,
  limit: number
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  // Try to get from conversations table
  const conversation = await prisma.conversation.findFirst({
    where: {
      channelId,
      status: 'ACTIVE',
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: limit,
      },
    },
  });

  if (!conversation?.messages) return [];

  return conversation.messages
    .reverse()
    .map(msg => ({
      role: msg.senderType === 'BOT' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    }));
}

/**
 * Generate simple response without full agent
 */
async function generateSimpleResponse(
  message: Message,
  context: ChannelContext,
  systemPrompt: string
): Promise<string> {
  // This is a fallback - in production you'd use the AI directly
  // For now, return a simple acknowledgment
  
  const greetings = [
    'Olá! Como posso ajudar?',
    'Oi! Em que posso ser útil?',
    'Hello! How can I help you?',
  ];

  // Detect language from message
  const isPortuguese = /[áéíóúãõç]/i.test(message.body || '') || 
    /\b(oi|olá|bom|dia|tarde|noite|obrigado)\b/i.test(message.body || '');

  return isPortuguese ? greetings[0] : greetings[2];
}

/**
 * Record message analytics
 */
async function recordMessageAnalytics(
  context: ChannelContext,
  message: Message,
  response: string,
  durationMs: number
): Promise<void> {
  try {
    // Update channel stats
    await prisma.channel.update({
      where: { id: context.channelId },
      data: {
        updatedAt: new Date(),
        // Could add custom stats here via JSON field
      },
    });

    // Create or update conversation
    await prisma.conversation.upsert({
      where: {
        id: `${context.channelId}:${message.from}`,
      },
      create: {
        id: `${context.channelId}:${message.from}`,
        channelId: context.channelId,
        tenantId: context.tenantId,
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        metadata: {
          participantId: message.from,
          participantName: message.fromName,
        },
      },
      update: {
        lastMessageAt: new Date(),
        messageCount: { increment: 2 }, // User message + bot response
      },
    });
  } catch (error) {
    logger.warn({ err: error }, 'Failed to record analytics');
  }
}

/**
 * Process webhook event (entry point for webhook handler)
 */
export async function processIncomingMessage(
  event: { message: Message },
  tenantId: string
): Promise<RouteResult> {
  return routeMessage(event.message, tenantId);
}
