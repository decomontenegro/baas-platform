/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Single Audit Log API
 * 
 * GET /api/audit/[id] - Get details of a specific audit log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import audit from '@/lib/audit';
import {
  getUserPermissions,
  hasPermission,
} from '@/lib/permissions';

// ============================================================================
// GET - Get Single Audit Log Entry
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await context.params;
    
    // Get the audit log entry
    const entry = await audit.getById(id);
    
    if (!entry) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
    }
    
    // Check permission - user must have access to the tenant
    if (entry.tenantId) {
      const permissions = await getUserPermissions(session.user.id, entry.tenantId);
      if (!hasPermission(permissions, 'settings:read')) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }
    
    // Get related logs (same resource)
    let relatedLogs: Awaited<ReturnType<typeof audit.getResourceHistory>> = [];
    if (entry.resource && entry.resourceId) {
      relatedLogs = await audit.getResourceHistory(
        entry.resource as Parameters<typeof audit.getResourceHistory>[0],
        entry.resourceId,
        10
      );
      // Exclude current entry from related
      relatedLogs = relatedLogs.filter(log => log.id !== id);
    }

    // Get user activity if there's a userId
    let userActivity = null;
    if (entry.userId) {
      userActivity = await audit.getUserActivity(
        entry.userId,
        entry.tenantId || undefined,
        30
      );
    }

    return NextResponse.json({
      log: entry,
      relatedLogs,
      userActivity,
    });
  } catch (error) {
    console.error('[Audit Single API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
