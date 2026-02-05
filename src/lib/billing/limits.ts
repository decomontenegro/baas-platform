/**
 * Plan limits checking and enforcement
 */

import { prisma } from '@/lib/prisma'
import { getPlan, isUnlimited, type PlanId } from './plans'

export interface UsageSummary {
  messages: { used: number; limit: number; percentage: number }
  channels: { used: number; limit: number; percentage: number }
  bots: { used: number; limit: number; percentage: number }
  users: { used: number; limit: number; percentage: number }
  storage: { used: number; limit: number; percentage: number } // in MB
}

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  currentUsage: number
  limit: number
  percentage: number
  softLimitReached: boolean  // 80% threshold
  hardLimitReached: boolean  // 100% threshold
}

// Soft limit threshold (80%)
const SOFT_LIMIT_THRESHOLD = 0.8

/**
 * Get current usage summary for a tenant
 */
export async function getUsageSummary(tenantId: string): Promise<UsageSummary> {
  // Get subscription/plan info
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: {
      plan: true,
      maxChannels: true,
      maxMessages: true,
      maxBots: true,
      maxUsers: true,
      maxStorage: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  })

  const plan = getPlan((subscription?.plan as PlanId) || 'FREE')
  const periodStart = subscription?.currentPeriodStart || getFirstDayOfMonth()
  const periodEnd = subscription?.currentPeriodEnd || getLastDayOfMonth()

  // Get actual usage counts in parallel
  const [messagesUsed, channelsCount, botsCount, usersCount, storageUsed] = await Promise.all([
    // Messages this period
    prisma.usageRecord.aggregate({
      where: {
        tenantId,
        type: { in: ['MESSAGES_SENT', 'MESSAGES_RECEIVED'] },
        date: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }).then(r => Math.floor(r._sum.amount || 0)),

    // Active channels (groups)
    prisma.channel.count({
      where: { 
        workspace: { tenantId },
        isActive: true,
        deletedAt: null,
      },
    }),

    // Active bots
    prisma.bot.count({
      where: { 
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    }),

    // Team members
    prisma.teamMember.count({
      where: { 
        tenantId,
        deletedAt: null,
      },
    }),

    // Storage used (aggregate from usage records or knowledge base)
    prisma.knowledgeDocument.aggregate({
      where: {
        knowledgeBase: { tenantId },
        deletedAt: null,
      },
      _sum: { fileSize: true },
    }).then(r => Math.floor((r._sum.fileSize || 0) / (1024 * 1024))), // Convert to MB
  ])

  const limits = {
    messages: subscription?.maxMessages ?? plan.maxMessages,
    channels: subscription?.maxChannels ?? plan.maxChannels,
    bots: subscription?.maxBots ?? plan.maxBots,
    users: subscription?.maxUsers ?? plan.maxUsers,
    storage: subscription?.maxStorage ?? plan.maxStorage,
  }

  return {
    messages: {
      used: messagesUsed,
      limit: limits.messages,
      percentage: calculatePercentage(messagesUsed, limits.messages),
    },
    channels: {
      used: channelsCount,
      limit: limits.channels,
      percentage: calculatePercentage(channelsCount, limits.channels),
    },
    bots: {
      used: botsCount,
      limit: limits.bots,
      percentage: calculatePercentage(botsCount, limits.bots),
    },
    users: {
      used: usersCount,
      limit: limits.users,
      percentage: calculatePercentage(usersCount, limits.users),
    },
    storage: {
      used: storageUsed,
      limit: limits.storage,
      percentage: calculatePercentage(storageUsed, limits.storage),
    },
  }
}

/**
 * Check if a specific action is allowed within limits
 */
export async function checkLimit(
  tenantId: string,
  limitType: 'messages' | 'channels' | 'bots' | 'users' | 'storage',
  incrementBy: number = 1
): Promise<LimitCheckResult> {
  const usage = await getUsageSummary(tenantId)
  const { used, limit } = usage[limitType]

  const newUsage = used + incrementBy
  const percentage = calculatePercentage(newUsage, limit)
  const softLimitReached = percentage >= SOFT_LIMIT_THRESHOLD * 100
  const hardLimitReached = !isUnlimited(limit) && newUsage > limit

  // Special rule: messages continue even over limit (don't cut off service)
  const isMessageType = limitType === 'messages'
  const allowed = isMessageType || !hardLimitReached

  let reason: string | undefined
  if (hardLimitReached && !isMessageType) {
    reason = `Limite de ${limitType} atingido (${used}/${limit}). Faça upgrade para continuar.`
  }

  return {
    allowed,
    reason,
    currentUsage: used,
    limit,
    percentage: Math.min(percentage, 100),
    softLimitReached,
    hardLimitReached,
  }
}

/**
 * Check if can add a new channel/group
 */
export async function canAddChannel(tenantId: string): Promise<LimitCheckResult> {
  return checkLimit(tenantId, 'channels', 1)
}

/**
 * Check if can add a new bot
 */
export async function canAddBot(tenantId: string): Promise<LimitCheckResult> {
  return checkLimit(tenantId, 'bots', 1)
}

/**
 * Check if can add a new team member
 */
export async function canAddTeamMember(tenantId: string): Promise<LimitCheckResult> {
  return checkLimit(tenantId, 'users', 1)
}

/**
 * Check if can upload more storage
 */
export async function canUploadStorage(tenantId: string, fileSizeMB: number): Promise<LimitCheckResult> {
  return checkLimit(tenantId, 'storage', fileSizeMB)
}

/**
 * Get all limit warnings for dashboard display
 */
export async function getLimitWarnings(tenantId: string): Promise<string[]> {
  const usage = await getUsageSummary(tenantId)
  const warnings: string[] = []

  for (const [key, value] of Object.entries(usage)) {
    const { percentage, limit } = value
    if (isUnlimited(limit)) continue

    if (percentage >= 100) {
      warnings.push(`Limite de ${translateLimitType(key)} atingido`)
    } else if (percentage >= 80) {
      warnings.push(`${translateLimitType(key)}: ${percentage}% do limite usado`)
    }
  }

  return warnings
}

// Helper functions
function calculatePercentage(used: number, limit: number): number {
  if (isUnlimited(limit)) return 0
  if (limit === 0) return 100
  return Math.round((used / limit) * 100)
}

function translateLimitType(type: string): string {
  const translations: Record<string, string> = {
    messages: 'mensagens',
    channels: 'grupos',
    bots: 'bots',
    users: 'membros da equipe',
    storage: 'armazenamento',
  }
  return translations[type] || type
}

function getFirstDayOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getLastDayOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
}
