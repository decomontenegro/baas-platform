/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Group Activation API Route
 * POST: Activate/Enable bot in a group
 * DELETE: Deactivate/Disable bot in a group
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClawdbotClient } from '@/lib/clawdbot/client';
import { getAuthenticatedUser, requirePermission } from '@/lib/clawdbot/auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, GroupConfig } from '@/lib/clawdbot/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ActivationResponse {
  groupId: string;
  activated: boolean;
  config: Partial<GroupConfig>;
}

/**
 * POST /api/clawdbot/groups/[id]/activate
 * Activate bot in a specific group
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ActivationResponse>>> {
  const { id: groupId } = await params;
  
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  // Require admin permission to activate groups
  const permError = requirePermission(user, 'admin');
  if (permError) {
    return NextResponse.json(
      { success: false, error: permError },
      { status: permError.status }
    );
  }

  try {
    // Parse optional config from body
    const body = await request.json().catch(() => ({})) as {
      personality?: GroupConfig['personality'];
      requireMention?: boolean;
      features?: GroupConfig['features'];
    };

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

    // Build activation config
    const activationConfig: Partial<GroupConfig> = {
      enabled: true,
      requireMention: body.requireMention ?? true, // Default to requiring mention
      personality: body.personality,
      features: body.features ?? {
        imageAnalysis: true,
        voiceMessages: false,
        codeExecution: false,
        webSearch: true,
      },
    };

    // Update config in Clawdbot Gateway
    await client.updateGroupConfig(groupId, activationConfig);

    // Update or create channel in local database
    // First, find the workspace for this tenant
    const workspace = await prisma.Workspace.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (workspace) {
      // Get group info from Clawdbot if available
      const groups = await client.getGroups();
      const group = groups.find(g => g.id === groupId);

      await prisma.Channel.upsert({
        where: {
          workspaceId_externalId: {
            workspaceId: workspace.id,
            externalId: groupId,
          },
        },
        create: {
          workspaceId: workspace.id,
          name: group?.name || `Group ${groupId.split('@')[0]}`,
          type: 'WHATSAPP',
          externalId: groupId,
          isActive: true,
          settings: {
            clawdbot: activationConfig,
          },
        },
        update: {
          isActive: true,
          settings: {
            clawdbot: activationConfig,
          },
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        groupId,
        activated: true,
        config: activationConfig,
      },
    });
  } catch (error) {
    console.error('Failed to activate group:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ACTIVATION_FAILED',
          message: 'Failed to activate bot in group',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clawdbot/groups/[id]/activate
 * Deactivate bot in a specific group
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ActivationResponse>>> {
  const { id: groupId } = await params;
  
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  // Require admin permission to deactivate groups
  const permError = requirePermission(user, 'admin');
  if (permError) {
    return NextResponse.json(
      { success: false, error: permError },
      { status: permError.status }
    );
  }

  try {
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

    // Disable in Clawdbot Gateway
    await client.updateGroupConfig(groupId, {
      enabled: false,
    });

    // Update local database
    const workspace = await prisma.Workspace.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (workspace) {
      await prisma.Channel.updateMany({
        where: {
          workspaceId: workspace.id,
          externalId: groupId,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        groupId,
        activated: false,
        config: { enabled: false },
      },
    });
  } catch (error) {
    console.error('Failed to deactivate group:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DEACTIVATION_FAILED',
          message: 'Failed to deactivate bot in group',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
