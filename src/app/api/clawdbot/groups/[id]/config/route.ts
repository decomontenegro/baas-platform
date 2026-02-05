/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Group Config API Route
 * GET: Get current configuration for a specific group
 * PATCH: Update group configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClawdbotClient } from '@/lib/clawdbot/client';
import {
  dashboardToClawdbotConfig,
  validateGroupConfig,
  diffConfigs,
} from '@/lib/clawdbot/config-mapper';
import type { ApiResponse, GroupConfig } from '@/lib/clawdbot/types';

// Placeholder for auth - replace with actual auth implementation
async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string; organizationId: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  return {
    id: 'user_123',
    organizationId: 'org_123',
  };
}

// Placeholder for database client
const db = {
  channels: {
    findUnique: async (query: { where: { organizationId_clawdbotGroupId: { organizationId: string; clawdbotGroupId: string } } }) => {
      // TODO: Replace with actual Prisma query
      return null;
    },
    update: async (query: { where: { id: string }; data: Partial<{ config: GroupConfig; updatedAt: Date }> }) => {
      // TODO: Replace with actual Prisma query
      return query.data;
    },
  },
  configHistory: {
    create: async (data: { data: unknown }) => {
      // TODO: Replace with actual Prisma query - for audit logging
      return data;
    },
  },
} as any;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clawdbot/groups/[id]/config
 * Get current configuration for a specific group
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<GroupConfig>>> {
  try {
    const { id: groupId } = await params;
    
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
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

    // Fetch config from Clawdbot
    const clawdbotConfig = await client.getGroupConfig(groupId);

    if (!clawdbotConfig) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Configuration not found for group ${groupId}`,
          },
        },
        { status: 404 }
      );
    }

    // Also fetch local config if available
    const searchParams = request.nextUrl.searchParams;
    const mergeLocal = searchParams.get('mergeLocal') !== 'false';

    if (mergeLocal) {
      const localChannel = await db.channels.findUnique({
        where: {
          organizationId_clawdbotGroupId: {
            organizationId: user.organizationId,
            clawdbotGroupId: groupId,
          },
        },
      });

      if (localChannel?.config) {
        // Merge local config (dashboard-specific fields like personality)
        const mergedConfig: GroupConfig = {
          ...clawdbotConfig,
          personality: localChannel.config.personality || clawdbotConfig.personality,
          rateLimit: localChannel.config.rateLimit || clawdbotConfig.rateLimit,
          features: localChannel.config.features || clawdbotConfig.features,
        };

        return NextResponse.json({
          success: true,
          data: mergedConfig,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: clawdbotConfig,
    });
  } catch (error) {
    console.error('Error fetching group config:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch group configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clawdbot/groups/[id]/config
 * Update group configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<GroupConfig>>> {
  try {
    const { id: groupId } = await params;
    
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updates = body as Partial<GroupConfig>;

    // Validate the config
    const validation = validateGroupConfig(updates);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid configuration',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
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

    // Get current config for diffing
    const currentConfig = await client.getGroupConfig(groupId);

    // Apply update to Clawdbot
    const { groupConfig, systemPrompt } = dashboardToClawdbotConfig(updates, {
      groupId,
    });

    // Update Clawdbot config
    await client.updateGroupConfig(groupId, {
      ...groupConfig,
      ...(systemPrompt && { systemPrompt }),
      personality: updates.personality,
    });

    // Update local database
    const localChannel = await db.channels.findUnique({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId: user.organizationId,
          clawdbotGroupId: groupId,
        },
      },
    });

    const mergedConfig: GroupConfig = {
      ...(currentConfig || {}),
      ...updates,
    };

    if (localChannel) {
      await db.channels.update({
        where: { id: localChannel.id },
        data: {
          config: mergedConfig,
          updatedAt: new Date(),
        },
      });
    }

    // Log config change for audit
    if (currentConfig) {
      const diffs = diffConfigs(currentConfig, mergedConfig);
      if (diffs.length > 0) {
        await db.configHistory.create({
          data: {
            channelId: localChannel?.id,
            groupId,
            userId: user.id,
            changes: diffs,
            timestamp: new Date(),
          },
        });
      }
    }

    // Include warnings in response
    const response: ApiResponse<GroupConfig> = {
      success: true,
      data: mergedConfig,
    };

    if (validation.warnings.length > 0) {
      response.meta = { warnings: validation.warnings };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating group config:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update group configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clawdbot/groups/[id]/config
 * Replace entire group configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<GroupConfig>>> {
  try {
    const { id: groupId } = await params;
    
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const newConfig = body as GroupConfig;

    // Validate the full config
    const validation = validateGroupConfig(newConfig);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid configuration',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const client = getClawdbotClient();

    if (!client.isConnected()) {
      await client.connect();
    }

    // Apply full config to Clawdbot
    const { groupConfig, systemPrompt } = dashboardToClawdbotConfig(newConfig, {
      groupId,
    });

    await client.updateGroupConfig(groupId, {
      ...groupConfig,
      ...(systemPrompt && { systemPrompt }),
      personality: newConfig.personality,
    });

    // Update local database
    const localChannel = await db.channels.findUnique({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId: user.organizationId,
          clawdbotGroupId: groupId,
        },
      },
    });

    if (localChannel) {
      await db.channels.update({
        where: { id: localChannel.id },
        data: {
          config: newConfig,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: newConfig,
    });
  } catch (error) {
    console.error('Error replacing group config:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to replace group configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
