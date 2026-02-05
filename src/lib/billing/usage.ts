/**
 * Usage tracking and recording
 */

import { prisma } from '@/lib/prisma'
import type { UsageRecordType } from '@prisma/client'

export interface UsageEvent {
  tenantId: string
  type: UsageRecordType
  amount: number
  unit: string
  metadata?: Record<string, unknown>
}

/**
 * Record a usage event
 * Aggregates by day for efficiency
 */
export async function recordUsage(event: UsageEvent): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.usageRecord.create({
    data: {
      tenantId: event.tenantId,
      type: event.type,
      amount: event.amount,
      unit: event.unit,
      date: today,
      metadata: event.metadata || {},
    },
  })
}

/**
 * Record message sent by bot
 */
export async function recordMessageSent(
  tenantId: string,
  metadata?: { channelId?: string; botId?: string }
): Promise<void> {
  await recordUsage({
    tenantId,
    type: 'MESSAGES_SENT',
    amount: 1,
    unit: 'messages',
    metadata,
  })
}

/**
 * Record message received from user
 */
export async function recordMessageReceived(
  tenantId: string,
  metadata?: { channelId?: string; contactId?: string }
): Promise<void> {
  await recordUsage({
    tenantId,
    type: 'MESSAGES_RECEIVED',
    amount: 1,
    unit: 'messages',
    metadata,
  })
}

/**
 * Record token usage (for AI models)
 */
export async function recordTokens(
  tenantId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<void> {
  // Record input tokens
  await recordUsage({
    tenantId,
    type: 'TOKENS_INPUT',
    amount: inputTokens,
    unit: 'tokens',
    metadata: { model },
  })

  // Record output tokens
  await recordUsage({
    tenantId,
    type: 'TOKENS_OUTPUT',
    amount: outputTokens,
    unit: 'tokens',
    metadata: { model },
  })
}

/**
 * Record audio transcription usage
 */
export async function recordAudioTranscription(
  tenantId: string,
  durationSeconds: number,
  metadata?: { format?: string; fileSize?: number }
): Promise<void> {
  const minutes = durationSeconds / 60
  await recordUsage({
    tenantId,
    type: 'AUDIO_TRANSCRIPTION',
    amount: minutes,
    unit: 'minutes',
    metadata,
  })
}

/**
 * Record storage usage (knowledge base)
 */
export async function recordStorageUsage(
  tenantId: string,
  sizeMB: number,
  metadata?: { fileType?: string; fileName?: string; documentId?: string }
): Promise<void> {
  await recordUsage({
    tenantId,
    type: 'STORAGE_KB',
    amount: sizeMB,
    unit: 'mb',
    metadata,
  })
}

/**
 * Get usage for a specific period
 */
export interface PeriodUsage {
  messagesSent: number
  messagesReceived: number
  totalMessages: number
  tokensInput: number
  tokensOutput: number
  totalTokens: number
  audioMinutes: number
  storageMB: number
  byModel: Record<string, { input: number; output: number }>
  byDay: Array<{ date: string; messages: number; tokens: number }>
}

export async function getUsageForPeriod(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<PeriodUsage> {
  const records = await prisma.usageRecord.findMany({
    where: {
      tenantId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  const result: PeriodUsage = {
    messagesSent: 0,
    messagesReceived: 0,
    totalMessages: 0,
    tokensInput: 0,
    tokensOutput: 0,
    totalTokens: 0,
    audioMinutes: 0,
    storageMB: 0,
    byModel: {},
    byDay: [],
  }

  const dayMap: Map<string, { messages: number; tokens: number }> = new Map()

  for (const record of records) {
    const dateKey = record.date.toISOString().split('T')[0]
    const dayData = dayMap.get(dateKey) || { messages: 0, tokens: 0 }

    switch (record.type) {
      case 'MESSAGES_SENT':
        result.messagesSent += record.amount
        result.totalMessages += record.amount
        dayData.messages += record.amount
        break
      case 'MESSAGES_RECEIVED':
        result.messagesReceived += record.amount
        result.totalMessages += record.amount
        dayData.messages += record.amount
        break
      case 'TOKENS_INPUT':
        result.tokensInput += record.amount
        result.totalTokens += record.amount
        dayData.tokens += record.amount
        // Track by model
        const modelIn = (record.metadata as { model?: string })?.model || 'unknown'
        if (!result.byModel[modelIn]) {
          result.byModel[modelIn] = { input: 0, output: 0 }
        }
        result.byModel[modelIn].input += record.amount
        break
      case 'TOKENS_OUTPUT':
        result.tokensOutput += record.amount
        result.totalTokens += record.amount
        dayData.tokens += record.amount
        const modelOut = (record.metadata as { model?: string })?.model || 'unknown'
        if (!result.byModel[modelOut]) {
          result.byModel[modelOut] = { input: 0, output: 0 }
        }
        result.byModel[modelOut].output += record.amount
        break
      case 'AUDIO_TRANSCRIPTION':
        result.audioMinutes += record.amount
        break
      case 'STORAGE_KB':
        result.storageMB += record.amount
        break
    }

    dayMap.set(dateKey, dayData)
  }

  // Convert day map to array
  result.byDay = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return result
}

/**
 * Get current billing period usage
 */
export async function getCurrentPeriodUsage(tenantId: string): Promise<PeriodUsage> {
  // Get subscription period
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: {
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  })

  const now = new Date()
  const startDate = subscription?.currentPeriodStart || new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = subscription?.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0)

  return getUsageForPeriod(tenantId, startDate, endDate)
}

/**
 * Get usage history (last N months)
 */
export async function getUsageHistory(
  tenantId: string,
  months: number = 6
): Promise<Array<{ month: string; messages: number; tokens: number; cost: number }>> {
  const now = new Date()
  const history: Array<{ month: string; messages: number; tokens: number; cost: number }> = []

  for (let i = 0; i < months; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    
    const usage = await getUsageForPeriod(tenantId, monthStart, monthEnd)
    
    history.push({
      month: monthStart.toISOString().slice(0, 7),
      messages: usage.totalMessages,
      tokens: usage.totalTokens,
      cost: estimateCost(usage),
    })
  }

  return history.reverse()
}

/**
 * Estimate cost based on usage
 * This is a rough estimate - actual billing may vary
 */
function estimateCost(usage: PeriodUsage): number {
  // Rough cost estimates
  const tokenCostPer1k = 0.002 // R$ per 1k tokens (average)
  const audioCostPerMinute = 0.01 // R$ per minute
  const storageCostPerMB = 0.0005 // R$ per MB/month

  return (
    (usage.totalTokens / 1000) * tokenCostPer1k +
    usage.audioMinutes * audioCostPerMinute +
    usage.storageMB * storageCostPerMB
  )
}
