/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Audit Log API Routes
 * 
 * GET /api/audit - List audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import audit, { type AuditLogFilters } from '@/lib/audit';
import {
  getUserPermissions,
  hasPermission,
} from '@/lib/permissions';

// ============================================================================
// GET - List Audit Logs
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = req.headers.get('x-tenant-id') || 
                     req.nextUrl.searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    
    // Check permission - require admin access for audit logs
    const permissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(permissions, 'settings:read')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);
    
    const filters: AuditLogFilters = {
      tenantId,
    };

    // Optional filters
    const userId = searchParams.get('userId');
    if (userId) filters.userId = userId;

    const action = searchParams.get('action');
    if (action) {
      filters.action = action.includes(',') ? action.split(',') : action;
    }

    const resource = searchParams.get('resource');
    if (resource) {
      filters.resource = resource.includes(',') ? resource.split(',') : resource;
    }

    const resourceId = searchParams.get('resourceId');
    if (resourceId) filters.resourceId = resourceId;

    const startDate = searchParams.get('startDate');
    if (startDate) filters.startDate = new Date(startDate);

    const endDate = searchParams.get('endDate');
    if (endDate) filters.endDate = new Date(endDate);

    const search = searchParams.get('search');
    if (search) filters.search = search;

    const ipAddress = searchParams.get('ipAddress');
    if (ipAddress) filters.ipAddress = ipAddress;

    // Query logs
    const result = await audit.query(filters, page, pageSize);

    // Get additional stats
    const [retentionStats, securityAlerts] = await Promise.all([
      audit.getRetentionStats(tenantId),
      audit.getSecurityAlerts(tenantId, 7, 5),
    ]);

    return NextResponse.json({
      ...result,
      stats: retentionStats,
      recentAlerts: securityAlerts,
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
