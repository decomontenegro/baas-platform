/**
 * LLM Gateway - Alerts API
 * 
 * GET  /api/llm/alerts - List alerts for tenant
 * POST /api/llm/alerts - Acknowledge alert(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getAllAlerts,
  getActiveAlerts,
  acknowledgeAlert,
  acknowledgeAlerts,
  checkAndCreateAlerts,
  getUsageContext,
} from '@/lib/llm-gateway/alerter';
import { cacheGet, cacheSet, invalidateCache } from '@/lib/admin-agent/cache';
import type { LLMAlertType } from '@prisma/client';

// Cache TTL for alerts (30 seconds - alerts need to be fresh)
const ALERTS_CACHE_TTL = 30;

// ============================================
// GET /api/llm/alerts
// ============================================

/**
 * List alerts for the authenticated tenant
 * 
 * Query params:
 * - acknowledged: boolean - Filter by acknowledged status
 * - type: LLMAlertType - Filter by alert type
 * - limit: number - Max results (default 50)
 * - offset: number - Pagination offset
 * - start: ISO date - Filter alerts after this date
 * - end: ISO date - Filter alerts before this date
 * - active: boolean - If true, only return unacknowledged alerts
 * - check: boolean - If true, run alert check before returning
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get tenant ID from user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'User not associated with a tenant' },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId;

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    
    const activeOnly = searchParams.get('active') === 'true';
    const runCheck = searchParams.get('check') === 'true';
    const acknowledgedParam = searchParams.get('acknowledged');
    const typeParam = searchParams.get('type') as LLMAlertType | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // 4. Optionally run alert check (creates new alerts if needed)
    let newAlerts: Awaited<ReturnType<typeof checkAndCreateAlerts>> = [];
    if (runCheck) {
      newAlerts = await checkAndCreateAlerts(tenantId);
      // Invalidate cache after creating new alerts
      await invalidateCache(`llm:alerts:${tenantId}:*`);
    }

    // 5. Build cache key based on query params
    const cacheKey = `llm:alerts:${tenantId}:${activeOnly}:${acknowledgedParam}:${typeParam}:${limit}:${offset}`;
    const noCache = searchParams.get('noCache') === 'true';

    // Try cache for non-check requests
    if (!runCheck && !noCache) {
      const cached = await cacheGet<{ alerts: unknown[]; total: number; usageContext: unknown }>(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            alerts: cached.alerts,
            pagination: {
              total: cached.total,
              limit,
              offset,
              hasMore: offset + cached.alerts.length < cached.total,
            },
            usage: cached.usageContext,
          },
          _cached: true,
        });
      }
    }

    // 6. Fetch alerts from database
    let alerts;
    let total;

    if (activeOnly) {
      // Simple path: only active alerts
      alerts = await getActiveAlerts(tenantId);
      total = alerts.length;
    } else {
      // Full query with filters
      const result = await getAllAlerts(tenantId, {
        limit,
        offset,
        acknowledged: acknowledgedParam !== null ? acknowledgedParam === 'true' : undefined,
        type: typeParam || undefined,
        startDate: startParam ? new Date(startParam) : undefined,
        endDate: endParam ? new Date(endParam) : undefined,
      });
      alerts = result.alerts;
      total = result.total;
    }

    // 7. Get usage context for response
    const usageContext = await getUsageContext(tenantId);

    // Cache the result (only if not a check request)
    if (!runCheck) {
      await cacheSet(cacheKey, { alerts, total, usageContext }, ALERTS_CACHE_TTL);
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      data: {
        alerts,
        newAlerts: runCheck ? newAlerts : undefined,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + alerts.length < total,
        },
        usage: usageContext,
      },
      _cached: false,
    });
  } catch (error) {
    console.error('[API] GET /api/llm/alerts error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/llm/alerts
// ============================================

/**
 * Acknowledge alert(s)
 * 
 * Body:
 * - alertId: string - Single alert ID to acknowledge
 * - alertIds: string[] - Multiple alert IDs to acknowledge
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get tenant ID from user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'User not associated with a tenant' },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId;
    const userId = session.user.id;

    // 3. Parse body
    const body = await request.json();
    const { alertId, alertIds } = body as { alertId?: string; alertIds?: string[] };

    if (!alertId && (!alertIds || alertIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'alertId or alertIds is required' },
        { status: 400 }
      );
    }

    // 4. Verify alerts belong to tenant
    const idsToCheck = alertId ? [alertId] : alertIds!;
    
    const alertsToAck = await prisma.lLMUsageAlert.findMany({
      where: {
        id: { in: idsToCheck },
        tenantId,
      },
      select: { id: true, acknowledged: true },
    });

    if (alertsToAck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No alerts found for this tenant' },
        { status: 404 }
      );
    }

    // Filter out already acknowledged
    const unacknowledged = alertsToAck.filter(a => !a.acknowledged);
    
    if (unacknowledged.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          acknowledged: 0,
          message: 'All alerts were already acknowledged',
        },
      });
    }

    // 5. Acknowledge
    let acknowledgedCount: number;

    if (alertId && unacknowledged.length === 1) {
      // Single alert
      await acknowledgeAlert(alertId, userId);
      acknowledgedCount = 1;
    } else {
      // Multiple alerts
      acknowledgedCount = await acknowledgeAlerts(
        unacknowledged.map(a => a.id),
        userId
      );
    }

    // 6. Invalidate alerts cache for this tenant
    await invalidateCache(`llm:alerts:${tenantId}:*`);

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: {
        acknowledged: acknowledgedCount,
        message: `Acknowledged ${acknowledgedCount} alert(s)`,
      },
    });
  } catch (error) {
    console.error('[API] POST /api/llm/alerts error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
