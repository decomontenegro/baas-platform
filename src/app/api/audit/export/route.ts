/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Audit Log Export API
 * 
 * GET /api/audit/export - Export audit logs to CSV
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
// GET - Export Audit Logs to CSV
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
    
    // Check permission - require admin access for audit export
    const permissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(permissions, 'analytics:export')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    
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

    const startDate = searchParams.get('startDate');
    if (startDate) filters.startDate = new Date(startDate);

    const endDate = searchParams.get('endDate');
    if (endDate) filters.endDate = new Date(endDate);

    // Generate CSV
    const csv = await audit.exportToCsv(filters);

    // Log the export action
    await audit.log({
      tenantId,
      userId: session.user.id,
      action: 'data.exported',
      resource: 'user',
      metadata: {
        exportType: 'audit_logs',
        filters,
        format: 'csv',
      },
    });

    // Return CSV file
    const filename = `audit-logs-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`;
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Audit Export API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
