/**
 * LLM Gateway - Sistema de Alertas
 * 
 * Monitora consumo de LLM e cria alertas quando thresholds são atingidos.
 * Spec: /docs/LLM-GATEWAY.md seção 8
 */

import { prisma } from '@/lib/prisma';
import type { LLMUsageAlert, Tenant, LLMAlertType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface AlertThreshold {
  percent: number;      // Ex: 0.20 = 20% restante
  type: LLMAlertType;
  severity: 'info' | 'warning' | 'critical';
}

export interface CreateAlertData {
  type: LLMAlertType;
  threshold: number;
  currentUsage: number;
  limitValue: number;
  percentUsed: number;
  message: string;
}

export interface NotificationResult {
  email: boolean;
  whatsapp: boolean;
  slack: boolean;
}

// ============================================
// CONSTANTS
// ============================================

// Default thresholds: alert when X% remaining (not used)
export const DEFAULT_THRESHOLDS: number[] = [0.20, 0.10, 0.05, 0.01];

// Map remaining percentage to alert type
const THRESHOLD_TYPE_MAP: Record<number, LLMAlertType> = {
  0.20: 'BUDGET_WARNING',   // 20% restante
  0.10: 'BUDGET_WARNING',   // 10% restante
  0.05: 'BUDGET_CRITICAL',  // 5% restante
  0.01: 'BUDGET_EXCEEDED',  // 1% ou menos
};

// Daily thresholds (for dailyLimit)
const DAILY_THRESHOLD_MAP: Record<number, LLMAlertType> = {
  0.20: 'DAILY_WARNING',
  0.10: 'DAILY_WARNING',
  0.05: 'DAILY_EXCEEDED',
  0.01: 'DAILY_EXCEEDED',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get start of current month
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get start of today
 */
function getDayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Determine alert type based on remaining percentage
 */
function getAlertType(percentRemaining: number, isDaily: boolean = false): LLMAlertType {
  const map = isDaily ? DAILY_THRESHOLD_MAP : THRESHOLD_TYPE_MAP;
  
  if (percentRemaining <= 0.01) {
    return isDaily ? 'DAILY_EXCEEDED' : 'BUDGET_EXCEEDED';
  } else if (percentRemaining <= 0.05) {
    return isDaily ? 'DAILY_EXCEEDED' : 'BUDGET_CRITICAL';
  } else if (percentRemaining <= 0.10) {
    return isDaily ? 'DAILY_WARNING' : 'BUDGET_WARNING';
  } else if (percentRemaining <= 0.20) {
    return isDaily ? 'DAILY_WARNING' : 'BUDGET_WARNING';
  }
  
  return 'BUDGET_WARNING';
}

/**
 * Generate alert message based on type and values
 */
function generateAlertMessage(
  type: LLMAlertType,
  percentRemaining: number,
  currentUsage: number,
  limit: number
): string {
  const remaining = limit - currentUsage;
  const percentStr = (percentRemaining * 100).toFixed(0);
  
  switch (type) {
    case 'BUDGET_EXCEEDED':
      return `🛑 ORÇAMENTO EXCEDIDO! Uso: $${currentUsage.toFixed(2)} / Limite: $${limit.toFixed(2)}`;
    
    case 'BUDGET_CRITICAL':
      return `🚨 CRÍTICO: Apenas ${percentStr}% do orçamento mensal restante ($${remaining.toFixed(2)})`;
    
    case 'BUDGET_WARNING':
      return `⚠️ Alerta: ${percentStr}% do orçamento mensal restante ($${remaining.toFixed(2)})`;
    
    case 'DAILY_EXCEEDED':
      return `🛑 LIMITE DIÁRIO EXCEDIDO! Uso: $${currentUsage.toFixed(2)} / Limite: $${limit.toFixed(2)}`;
    
    case 'DAILY_WARNING':
      return `⚠️ Alerta diário: ${percentStr}% do limite restante ($${remaining.toFixed(2)})`;
    
    default:
      return `Alerta de consumo: ${percentStr}% restante`;
  }
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check tenant usage and create alerts if thresholds are crossed
 * 
 * @param tenantId - ID of the tenant to check
 * @returns Array of newly created alerts
 */
export async function checkAndCreateAlerts(tenantId: string): Promise<LLMUsageAlert[]> {
  const createdAlerts: LLMUsageAlert[] = [];
  
  // 1. Get tenant with budget info
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  
  // 2. Get thresholds (custom or default)
  const thresholds = (tenant.alertThresholds as number[]) || DEFAULT_THRESHOLDS;
  
  // 3. Check monthly budget
  if (tenant.monthlyBudget) {
    const monthAlerts = await checkBudgetThresholds(
      tenant,
      thresholds,
      false // monthly
    );
    createdAlerts.push(...monthAlerts);
  }
  
  // 4. Check daily limit
  if (tenant.dailyLimit) {
    const dailyAlerts = await checkBudgetThresholds(
      tenant,
      thresholds,
      true // daily
    );
    createdAlerts.push(...dailyAlerts);
  }
  
  return createdAlerts;
}

/**
 * Check budget thresholds and create alerts
 */
async function checkBudgetThresholds(
  tenant: Tenant,
  thresholds: number[],
  isDaily: boolean
): Promise<LLMUsageAlert[]> {
  const createdAlerts: LLMUsageAlert[] = [];
  
  const limit = isDaily ? tenant.dailyLimit : tenant.monthlyBudget;
  if (!limit) return createdAlerts;
  
  // Calculate current usage
  const periodStart = isDaily ? getDayStart() : getMonthStart();
  
  const usage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId: tenant.id,
      createdAt: { gte: periodStart },
    },
    _sum: { cost: true },
  });
  
  const currentUsage = usage._sum.cost || 0;
  const percentUsed = currentUsage / limit;
  const percentRemaining = 1 - percentUsed;
  
  // Check each threshold (sorted descending - check largest first)
  const sortedThresholds = [...thresholds].sort((a, b) => b - a);
  
  for (const threshold of sortedThresholds) {
    // If we have more remaining than this threshold, skip
    if (percentRemaining > threshold) {
      continue;
    }
    
    // Check if alert already exists for this threshold in current period
    const existingAlert = await prisma.lLMUsageAlert.findFirst({
      where: {
        tenantId: tenant.id,
        threshold,
        type: isDaily 
          ? { in: ['DAILY_WARNING', 'DAILY_EXCEEDED'] }
          : { in: ['BUDGET_WARNING', 'BUDGET_CRITICAL', 'BUDGET_EXCEEDED'] },
        createdAt: { gte: periodStart },
      },
    });
    
    // Skip if we already alerted for this threshold
    if (existingAlert) {
      continue;
    }
    
    // Determine alert type
    const alertType = getAlertType(percentRemaining, isDaily);
    
    // Create alert
    const alert = await prisma.lLMUsageAlert.create({
      data: {
        tenantId: tenant.id,
        type: alertType,
        threshold,
        message: generateAlertMessage(alertType, percentRemaining, currentUsage, limit),
        currentUsage,
        limitValue: limit,
        percentUsed,
        // Set expiration to end of period
        expiresAt: isDaily 
          ? new Date(getDayStart().getTime() + 24 * 60 * 60 * 1000)
          : new Date(getMonthStart().getTime() + 31 * 24 * 60 * 60 * 1000),
      },
    });
    
    createdAlerts.push(alert);
    
    // Send notifications
    await sendAlertNotifications(alert);
    
    // Only create ONE alert per check (the most severe one)
    break;
  }
  
  // Special case: check if budget is exceeded (> 100%)
  if (percentUsed >= 1.0) {
    const exceededType: LLMAlertType = isDaily ? 'DAILY_EXCEEDED' : 'BUDGET_EXCEEDED';
    
    const existingExceeded = await prisma.lLMUsageAlert.findFirst({
      where: {
        tenantId: tenant.id,
        type: exceededType,
        createdAt: { gte: periodStart },
      },
    });
    
    if (!existingExceeded) {
      const alert = await prisma.lLMUsageAlert.create({
        data: {
          tenantId: tenant.id,
          type: exceededType,
          threshold: 0, // 0% remaining
          message: generateAlertMessage(exceededType, 0, currentUsage, limit),
          currentUsage,
          limitValue: limit,
          percentUsed,
        },
      });
      
      createdAlerts.push(alert);
      await sendAlertNotifications(alert);
      
      // Optionally suspend tenant if configured
      if (!isDaily && tenant.settings && typeof tenant.settings === 'object') {
        const settings = tenant.settings as Record<string, unknown>;
        if (settings.suspendOnExceed) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { llmSuspended: true },
          });
        }
      }
    }
  }
  
  return createdAlerts;
}

/**
 * Get all active (unacknowledged) alerts for a tenant
 * 
 * @param tenantId - ID of the tenant
 * @returns Array of active alerts, ordered by creation date desc
 */
export async function getActiveAlerts(tenantId: string): Promise<LLMUsageAlert[]> {
  return prisma.lLMUsageAlert.findMany({
    where: {
      tenantId,
      acknowledged: false,
      // Optionally filter out expired alerts
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all alerts for a tenant (including acknowledged)
 * 
 * @param tenantId - ID of the tenant
 * @param options - Filter options
 * @returns Array of alerts
 */
export async function getAllAlerts(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    acknowledged?: boolean;
    type?: LLMAlertType;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ alerts: LLMUsageAlert[]; total: number }> {
  const where = {
    tenantId,
    ...(options.acknowledged !== undefined && { acknowledged: options.acknowledged }),
    ...(options.type && { type: options.type }),
    ...(options.startDate || options.endDate) && {
      createdAt: {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate }),
      },
    },
  };
  
  const [alerts, total] = await Promise.all([
    prisma.lLMUsageAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    }),
    prisma.lLMUsageAlert.count({ where }),
  ]);
  
  return { alerts, total };
}

/**
 * Acknowledge an alert
 * 
 * @param alertId - ID of the alert to acknowledge
 * @param userId - ID of the user acknowledging
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<void> {
  const alert = await prisma.lLMUsageAlert.findUnique({
    where: { id: alertId },
  });
  
  if (!alert) {
    throw new Error(`Alert not found: ${alertId}`);
  }
  
  if (alert.acknowledged) {
    throw new Error('Alert already acknowledged');
  }
  
  await prisma.lLMUsageAlert.update({
    where: { id: alertId },
    data: {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
  });
}

/**
 * Acknowledge multiple alerts
 * 
 * @param alertIds - IDs of alerts to acknowledge
 * @param userId - ID of the user acknowledging
 * @returns Number of alerts acknowledged
 */
export async function acknowledgeAlerts(
  alertIds: string[],
  userId: string
): Promise<number> {
  const result = await prisma.lLMUsageAlert.updateMany({
    where: {
      id: { in: alertIds },
      acknowledged: false,
    },
    data: {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
  });
  
  return result.count;
}

/**
 * Send notifications for an alert
 * 
 * This is a placeholder that prepares the structure for actual notification implementations.
 * Actual sending will be implemented based on integration settings.
 * 
 * @param alert - The alert to send notifications for
 * @returns Result indicating which notifications were sent
 */
export async function sendAlertNotifications(
  alert: LLMUsageAlert
): Promise<NotificationResult> {
  const result: NotificationResult = {
    email: false,
    whatsapp: false,
    slack: false,
  };
  
  // Get tenant settings for notification preferences
  const tenant = await prisma.tenant.findUnique({
    where: { id: alert.tenantId },
    select: {
      id: true,
      name: true,
      settings: true,
    },
  });
  
  if (!tenant) {
    console.error(`[Alerter] Tenant not found for alert: ${alert.id}`);
    return result;
  }
  
  const settings = (tenant.settings as Record<string, unknown>) || {};
  
  // Determine which notifications to send based on alert severity
  const isCritical = ['BUDGET_CRITICAL', 'BUDGET_EXCEEDED', 'DAILY_EXCEEDED'].includes(alert.type);
  
  // ============================================
  // EMAIL NOTIFICATION
  // ============================================
  if (settings.alertEmail || settings.notifyEmail !== false) {
    try {
      // TODO: Implement actual email sending
      // await sendAlertEmail(settings.alertEmail as string, alert, tenant.name);
      
      console.log(`[Alerter] Would send email for alert ${alert.id}: ${alert.message}`);
      
      // Mark as sent (placeholder - will be true when implemented)
      // result.email = true;
      
      await prisma.lLMUsageAlert.update({
        where: { id: alert.id },
        data: { emailSent: result.email },
      });
    } catch (error) {
      console.error(`[Alerter] Failed to send email:`, error);
    }
  }
  
  // ============================================
  // WHATSAPP NOTIFICATION (Critical only)
  // ============================================
  if (isCritical && settings.alertWhatsApp) {
    try {
      // TODO: Implement actual WhatsApp sending
      // await sendAlertWhatsApp(settings.alertWhatsApp as string, alert, tenant.name);
      
      console.log(`[Alerter] Would send WhatsApp for critical alert ${alert.id}: ${alert.message}`);
      
      // Mark as sent (placeholder - will be true when implemented)
      // result.whatsapp = true;
      
      await prisma.lLMUsageAlert.update({
        where: { id: alert.id },
        data: { whatsappSent: result.whatsapp },
      });
    } catch (error) {
      console.error(`[Alerter] Failed to send WhatsApp:`, error);
    }
  }
  
  // ============================================
  // SLACK NOTIFICATION
  // ============================================
  if (settings.alertSlackWebhook || settings.slackWebhook) {
    try {
      // TODO: Implement actual Slack sending
      // await sendAlertSlack(settings.alertSlackWebhook as string, alert, tenant.name);
      
      console.log(`[Alerter] Would send Slack for alert ${alert.id}: ${alert.message}`);
      
      // Mark as sent (placeholder - will be true when implemented)
      // result.slack = true;
      
      await prisma.lLMUsageAlert.update({
        where: { id: alert.id },
        data: { slackSent: result.slack },
      });
    } catch (error) {
      console.error(`[Alerter] Failed to send Slack:`, error);
    }
  }
  
  return result;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get usage statistics for alert context
 */
export async function getUsageContext(tenantId: string): Promise<{
  monthlyUsage: number;
  dailyUsage: number;
  monthlyBudget: number | null;
  dailyLimit: number | null;
  percentMonthlyUsed: number;
  percentDailyUsed: number;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }
  
  const monthStart = getMonthStart();
  const dayStart = getDayStart();
  
  const [monthlyAgg, dailyAgg] = await Promise.all([
    prisma.lLMUsage.aggregate({
      where: { tenantId, createdAt: { gte: monthStart } },
      _sum: { cost: true },
    }),
    prisma.lLMUsage.aggregate({
      where: { tenantId, createdAt: { gte: dayStart } },
      _sum: { cost: true },
    }),
  ]);
  
  const monthlyUsage = monthlyAgg._sum.cost || 0;
  const dailyUsage = dailyAgg._sum.cost || 0;
  
  return {
    monthlyUsage,
    dailyUsage,
    monthlyBudget: tenant.monthlyBudget,
    dailyLimit: tenant.dailyLimit,
    percentMonthlyUsed: tenant.monthlyBudget ? monthlyUsage / tenant.monthlyBudget : 0,
    percentDailyUsed: tenant.dailyLimit ? dailyUsage / tenant.dailyLimit : 0,
  };
}

/**
 * Clean up expired alerts (for maintenance jobs)
 */
export async function cleanupExpiredAlerts(): Promise<number> {
  const result = await prisma.lLMUsageAlert.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      acknowledged: true, // Only delete acknowledged expired alerts
    },
  });
  
  return result.count;
}

// ============================================
// ADDITIONAL EXPORTS (helpers that might be useful externally)
// ============================================

export {
  getMonthStart,
  getDayStart,
};
