/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Clawdbot Connect API Route
 * POST: Connect to Clawdbot Gateway
 * DELETE: Disconnect from Gateway
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClawdbotClient, resetClawdbotClient } from '@/lib/clawdbot/client';
import { getAuthenticatedUser, requirePermission } from '@/lib/clawdbot/auth';
import type { ApiResponse, HelloOkPayload } from '@/lib/clawdbot/types';

/**
 * POST /api/clawdbot/connect
 * Establish connection to Clawdbot Gateway
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<HelloOkPayload>>> {
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  // Require at least write permission to connect
  const permError = requirePermission(user, 'write');
  if (permError) {
    return NextResponse.json(
      { success: false, error: permError },
      { status: permError.status }
    );
  }

  try {
    const client = getClawdbotClient();
    
    // Check if already connected
    if (client.isConnected()) {
      const state = client.getState();
      return NextResponse.json({
        success: true,
        data: {
          type: 'hello-ok',
          protocol: state.protocol || 3,
          policy: { tickIntervalMs: 30000 },
        } as HelloOkPayload,
        meta: { alreadyConnected: true },
      });
    }

    // Connect to gateway
    const result = await client.connect();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to connect to Clawdbot:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Clawdbot Gateway',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 503 }
    );
  }
}

/**
 * DELETE /api/clawdbot/connect
 * Disconnect from Clawdbot Gateway
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<{ disconnected: boolean }>>> {
  const authResult = await getAuthenticatedUser(request);
  
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error.status }
    );
  }

  const { user } = authResult;
  
  const permError = requirePermission(user, 'admin');
  if (permError) {
    return NextResponse.json(
      { success: false, error: permError },
      { status: permError.status }
    );
  }

  try {
    resetClawdbotClient();
    
    return NextResponse.json({
      success: true,
      data: { disconnected: true },
    });
  } catch (error) {
    console.error('Failed to disconnect:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DISCONNECT_FAILED',
          message: 'Failed to disconnect from Clawdbot Gateway',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
