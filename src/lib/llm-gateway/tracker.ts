/**
 * LLM Gateway - Tracker
 * Registra e rastreia o uso de LLM por tenant/agent
 */

import { prisma } from '@/lib/prisma';
import type { LLMUsage, LLMRequestType } from '@prisma/client';
import { UsageRecord, UsageStats, AlertData } from './types';

// ============================================
// Core Functions
// ============================================

/**
 * Track a completed LLM request
 */
export async function trackUsage(record: UsageRecord): Promise<LLMUsage> {
  // 1. Get provider for cost calculation
  const provider = await prisma.lLMProvider.findUnique({
    where: { id: record.providerId }
  });
  
  if (!provider) {
    throw new Error(`Provider not found: ${record.providerId}`);
  }
  
  // 2. Calculate cost
  const cost = calculateCost(
    record.inputTokens,
    record.outputTokens,
    provider.costPerInputToken,
    provider.costPerOutputToken
  );
  
  // 3. Create usage record
  const usage = await prisma.lLMUsage.create({
    data: {
      tenantId: record.tenantId,
      agentId: record.agentId,
      providerId: record.providerId,
      model: record.model,
      requestType: record.requestType || 'CHAT',
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.inputTokens + record.outputTokens,
      cost,
      channel: record.channel,
      groupId: record.groupId,
      sessionId: record.sessionId,
      latencyMs: record.latencyMs,
      success: record.success,
      errorMessage: record.errorMessage,
      metadata: record.metadata || {}
    }
  });
  
  // 4. Check and trigger alerts asynchronously
  checkAndTriggerAlerts(record.tenantId).catch(err => {
    console.error('[Tracker] Failed to check alerts:', err);
  });
  
  return usage;
}

/**
 * Calculate cost based on tokens and provider rates
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  costPerInputToken: number,
  costPerOutputToken: number
): number {
  const inputCost = inputTokens * costPerInputToken;
  const outputCost = outputTokens * costPerOutputToken;
  return Number((inputCost + outputCost).toFixed(8));
}

// ============================================
// Aggregations
// ============================================

/**
 * Get usage statistics for a tenant
 */
export async function getTenantStats(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageStats> {
  // Total aggregations
  const totals = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: {
      totalTokens: true,
      cost: true,
      latencyMs: true
    },
    _avg: {
      latencyMs: true
    }
  });
  
  // Success count
  const successCount = await prisma.lLMUsage.count({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
      success: true
    }
  });
  
  // By model
  const byModel = await prisma.lLMUsage.groupBy({
    by: ['model'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: { totalTokens: true, cost: true }
  });
  
  // By agent
  const byAgent = await prisma.lLMUsage.groupBy({
    by: ['agentId'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: { totalTokens: true, cost: true }
  });
  
  // By channel
  const byChannel = await prisma.lLMUsage.groupBy({
    by: ['channel'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: { totalTokens: true, cost: true }
  });
  
  // By day (using raw query for date grouping)
  const byDay = await prisma.$queryRaw<Array<{
    date: Date;
    requests: bigint;
    tokens: bigint;
    cost: number;
  }>>`
    SELECT 
      DATE("createdAt") as date,
      COUNT(*) as requests,
      COALESCE(SUM("totalTokens"), 0) as tokens,
      COALESCE(SUM(cost), 0) as cost
    FROM "LLMUsage"
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY DATE("createdAt")
    ORDER BY date
  `;
  
  return {
    totalRequests: totals._count,
    totalTokens: totals._sum.totalTokens || 0,
    totalCost: totals._sum.cost || 0,
    avgLatencyMs: totals._avg.latencyMs || 0,
    successRate: totals._count > 0 ? successCount / totals._count : 1,
    byModel: Object.fromEntries(
      byModel.map(m => [m.model, {
        requests: m._count,
        tokens: m._sum.totalTokens || 0,
        cost: m._sum.cost || 0
      }])
    ),
    byAgent: Object.fromEntries(
      byAgent.map(a => [a.agentId || 'unknown', {
        requests: a._count,
        tokens: a._sum.totalTokens || 0,
        cost: a._sum.cost || 0
      }])
    ),
    byChannel: Object.fromEntries(
      byChannel
        .filter(c => c.channel)
        .map(c => [c.channel!, {
          requests: c._count,
          tokens: c._sum.totalTokens || 0,
          cost: c._sum.cost || 0
        }])
    ),
    byDay: byDay.map(d => ({
      date: d.date.toISOString().split('T')[0],
      requests: Number(d.requests),
      tokens: Number(d.tokens),
      cost: d.cost
    }))
  };
}

/**
 * Get current month's usage for a tenant
 */
export async function getCurrentMonthUsage(tenantId: string): Promise<{
  usage: number;
  requests: number;
  tokens: number;
}> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  const result = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: monthStart }
    },
    _count: true,
    _sum: {
      cost: true,
      totalTokens: true
    }
  });
  
  return {
    usage: result._sum.cost || 0,
    requests: result._count,
    tokens: result._sum.totalTokens || 0
  };
}

/**
 * Get today's usage for a tenant
 */
export async function getTodayUsage(tenantId: string): Promise<{
  usage: number;
  requests: number;
  tokens: number;
}> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  
  const result = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: dayStart }
    },
    _count: true,
    _sum: {
      cost: true,
      totalTokens: true
    }
  });
  
  return {
    usage: result._sum.cost || 0,
    requests: result._count,
    tokens: result._sum.totalTokens || 0
  };
}

// ============================================
// Alerts
// ============================================

/**
 * Check and trigger usage alerts
 */
export async function checkAndTriggerAlerts(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });
  
  if (!tenant) return;
  
  // Get thresholds (default: 20%, 10%, 5%, 1%)
  const thresholds = (tenant.alertThresholds as number[]) || [0.20, 0.10, 0.05, 0.01];
  
  // Check monthly budget
  if (tenant.monthlyBudget) {
    const monthlyUsage = await getCurrentMonthUsage(tenantId);
    const percentUsed = monthlyUsage.usage / tenant.monthlyBudget;
    const percentRemaining = 1 - percentUsed;
    
    // Check each threshold
    for (const threshold of thresholds) {
      if (percentRemaining <= threshold) {
        await maybeCreateAlert(tenant, {
          type: threshold <= 0.05 ? 'BUDGET_CRITICAL' : 'BUDGET_WARNING',
          threshold,
          currentUsage: monthlyUsage.usage,
          limitValue: tenant.monthlyBudget,
          percentUsed,
          message: `${(percentRemaining * 100).toFixed(0)}% do orçamento mensal restante ($${(tenant.monthlyBudget - monthlyUsage.usage).toFixed(2)})`
        });
      }
    }
    
    // Check if exceeded
    if (percentUsed >= 1.0) {
      await maybeCreateAlert(tenant, {
        type: 'BUDGET_EXCEEDED',
        threshold: 1.0,
        currentUsage: monthlyUsage.usage,
        limitValue: tenant.monthlyBudget,
        percentUsed,
        message: `Orçamento mensal EXCEDIDO! Uso: $${monthlyUsage.usage.toFixed(2)} / Limite: $${tenant.monthlyBudget.toFixed(2)}`
      });
      
      // Suspend if configured
      const settings = tenant.settings as Record<string, unknown> || {};
      if (settings.suspendOnExceed) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { llmSuspended: true }
        });
      }
    }
  }
  
  // Check daily limit
  if (tenant.dailyLimit) {
    const todayUsage = await getTodayUsage(tenantId);
    const percentUsed = todayUsage.usage / tenant.dailyLimit;
    
    if (percentUsed >= 0.9) {
      await maybeCreateAlert(tenant, {
        type: 'DAILY_WARNING',
        threshold: 0.9,
        currentUsage: todayUsage.usage,
        limitValue: tenant.dailyLimit,
        percentUsed,
        message: `90% do limite diário atingido ($${todayUsage.usage.toFixed(2)} / $${tenant.dailyLimit.toFixed(2)})`
      });
    }
    
    if (percentUsed >= 1.0) {
      await maybeCreateAlert(tenant, {
        type: 'DAILY_EXCEEDED',
        threshold: 1.0,
        currentUsage: todayUsage.usage,
        limitValue: tenant.dailyLimit,
        percentUsed,
        message: `Limite diário EXCEDIDO! Uso: $${todayUsage.usage.toFixed(2)} / Limite: $${tenant.dailyLimit.toFixed(2)}`
      });
    }
  }
}

/**
 * Create alert if not already created for this threshold/period
 */
async function maybeCreateAlert(
  tenant: { id: string; name: string },
  alertData: AlertData
): Promise<void> {
  const periodStart = alertData.type.includes('DAILY') 
    ? new Date(new Date().setHours(0, 0, 0, 0))
    : new Date(new Date().setDate(1));
  
  // Check if alert already exists
  const existingAlert = await prisma.lLMUsageAlert.findFirst({
    where: {
      tenantId: tenant.id,
      type: alertData.type as any,
      threshold: alertData.threshold,
      createdAt: { gte: periodStart }
    }
  });
  
  if (existingAlert) return;
  
  // Create alert
  await prisma.lLMUsageAlert.create({
    data: {
      tenantId: tenant.id,
      type: alertData.type as any,
      threshold: alertData.threshold,
      message: alertData.message,
      currentUsage: alertData.currentUsage,
      limitValue: alertData.limitValue,
      percentUsed: alertData.percentUsed
    }
  });
  
  console.log(`[Tracker] Alert created for ${tenant.name}: ${alertData.type} (${alertData.threshold})`);
  
  // TODO: Send notifications (email, whatsapp, slack)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get recent usage records
 */
export async function getRecentUsage(
  tenantId: string,
  limit: number = 100
): Promise<LLMUsage[]> {
  return prisma.lLMUsage.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      provider: true,
      agent: true
    }
  });
}

/**
 * Get usage for a specific agent
 */
export async function getAgentUsage(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  requests: number;
  tokens: number;
  cost: number;
  avgLatency: number;
}> {
  const result = await prisma.lLMUsage.aggregate({
    where: {
      agentId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: {
      totalTokens: true,
      cost: true
    },
    _avg: {
      latencyMs: true
    }
  });
  
  return {
    requests: result._count,
    tokens: result._sum.totalTokens || 0,
    cost: result._sum.cost || 0,
    avgLatency: result._avg.latencyMs || 0
  };
}
