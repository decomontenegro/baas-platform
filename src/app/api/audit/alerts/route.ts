/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Security Alerts API
 * 
 * GET /api/audit/alerts - Get recent security alerts
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
// GET - Get Security Alerts
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
    
    // Check permission - require admin access
    const permissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(permissions, 'settings:read')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // Get security alerts
    const alerts = await audit.getSecurityAlerts(tenantId, days, limit);

    // Group alerts by type
    const alertsByType: Record<string, number> = {};
    alerts.forEach((alert) => {
      const type = alert.action.replace('security.', '');
      alertsByType[type] = (alertsByType[type] || 0) + 1;
    });

    // Get critical alerts (last 24 hours)
    const criticalAlerts = alerts.filter((alert) => {
      const hoursSinceAlert = (Date.now() - new Date(alert.createdAt).getTime()) / 3600000;
      return hoursSinceAlert <= 24;
    });

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        criticalCount: criticalAlerts.length,
        byType: alertsByType,
      },
    });
  } catch (error) {
    console.error('[Security Alerts API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
