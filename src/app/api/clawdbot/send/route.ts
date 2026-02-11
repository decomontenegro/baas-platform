/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Send Message API Route
 * POST: Send a message through Clawdbot Gateway
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClawdbotClient } from '@/lib/clawdbot/client';
import { getAuthenticatedUser, requirePermission } from '@/lib/clawdbot/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/lib/clawdbot/types';

interface SendMessageRequest {
  target: string; // Group JID or user JID
  message: string;
  quotedMessageId?: string;
  mediaUrl?: string;
  mediaCaption?: string;
}

interface SendMessageResponse {
  messageId: string;
  target: string;
  timestamp: number;
}

/**
 * POST /api/clawdbot/send
 * Send a message through Clawdbot Gateway
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SendMessageResponse>>> {
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  // Require write permission to send messages
  const permError = requirePermission(user, 'write');
  if (permError) {
    return NextResponse.json(
      { success: false, error: permError },
      { status: permError.status }
    );
  }

  try {
    const body = await request.json() as SendMessageRequest;

    // Validate request
    if (!body.target) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target (group or user ID) is required',
          },
        },
        { status: 400 }
      );
    }

    if (!body.message && !body.mediaUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message or media is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify the target belongs to user's tenant (if it's a tracked channel)
    const isGroupTarget = body.target.includes('@g.us');
    if (isGroupTarget) {
      const channel = await prisma.Channel.findFirst({
        where: {
          externalId: body.target,
          Workspace: {
            tenantId: user.tenantId,
          },
        },
      });

      if (!channel) {
        // Channel not in database - could be a new group or unauthorized
        console.warn(`Message sent to untracked group: ${body.target}`);
        // We'll still allow it but log it
      }
    }

    const client = getClawdbotClient();

    // Connect if not already connected
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch (connectError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'GATEWAY_UNAVAILABLE',
              message: 'Could not connect to Clawdbot Gateway',
              details: connectError instanceof Error ? connectError.message : 'Unknown error',
            },
          },
          { status: 503 }
        );
      }
    }

    // Send message
    const result = await client.sendMessage(body.target, body.message, {
      quotedMessageId: body.quotedMessageId,
      mediaUrl: body.mediaUrl,
      mediaCaption: body.mediaCaption,
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        target: body.target,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: 'Failed to send message',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
