/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Status API Route
 * GET: Get current connection status and gateway health
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClawdbotClient } from '@/lib/clawdbot/client';
import { getAuthenticatedUser } from '@/lib/clawdbot/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, HealthStatus, ConnectionState } from '@/lib/clawdbot/types';

export interface ClawdbotStatus {
  connection: ConnectionState;
  gateway?: HealthStatus;
  channels?: {
    total: number;
    active: number;
    whatsapp?: {
      linked: boolean;
      accountId?: string;
      displayName?: string;
    };
  };
  lastSync?: {
    at: Date | null;
    groupCount: number;
  };
}

/**
 * GET /api/clawdbot/status
 * Get comprehensive status of Clawdbot integration
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<ClawdbotStatus>>> {
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  try {
    const client = getClawdbotClient();
    const connectionState = client.getState();

    const status: ClawdbotStatus = {
      connection: connectionState,
    };

    // If connected, get more detailed status
    if (client.isConnected()) {
      try {
        // Get gateway health
        const health = await client.health();
        status.gateway = health;

        // Extract channel info
        if (health.channels) {
          const whatsappChannel = health.channels.find(ch => ch.type === 'whatsapp');
          status.channels = {
            total: health.channels.length,
            active: health.channels.filter(ch => ch.linked).length,
            whatsapp: whatsappChannel ? {
              linked: whatsappChannel.linked,
              accountId: whatsappChannel.accountId,
              displayName: whatsappChannel.displayName,
            } : undefined,
          };
        }
      } catch (healthError) {
        console.warn('Could not fetch gateway health:', healthError);
      }
    }

    // Get local sync status from database
    try {
      const channelCount = await prisma.channel.count({
        where: {
          workspace: {
            tenantId: user.tenantId,
          },
          type: 'WHATSAPP',
        },
      });

      const activeCount = await prisma.channel.count({
        where: {
          workspace: {
            tenantId: user.tenantId,
          },
          type: 'WHATSAPP',
          isActive: true,
        },
      });

      const lastSyncChannel = await prisma.channel.findFirst({
        where: {
          workspace: {
            tenantId: user.tenantId,
          },
          type: 'WHATSAPP',
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });

      status.lastSync = {
        at: lastSyncChannel?.updatedAt || null,
        groupCount: channelCount,
      };

      if (!status.channels) {
        status.channels = {
          total: channelCount,
          active: activeCount,
        };
      }
    } catch (dbError) {
      console.warn('Could not fetch local sync status:', dbError);
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Failed to get status:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to get Clawdbot status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
