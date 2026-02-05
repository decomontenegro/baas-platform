/**
 * Analytics Event Tracker
 * Records real-time analytics events for later aggregation
 */

import { prisma } from '@/lib/prisma'
import { AnalyticsEventType, Prisma } from '@prisma/client'

export interface TrackEventInput {
  tenantId: string
  workspaceId?: string
  channelId?: string
  eventType: AnalyticsEventType
  data?: Record<string, unknown>
  responseTimeMs?: number
  tokensIn?: number
  tokensOut?: number
  cost?: number
  model?: string
}

/**
 * Track a single analytics event
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        eventType: input.eventType,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        responseTimeMs: input.responseTimeMs,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        cost: input.cost,
        model: input.model,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Don't fail the main flow for analytics
    console.error('[Analytics] Failed to track event:', error)
  }
}

/**
 * Track incoming message
 */
export async function trackMessageIn(
  tenantId: string,
  channelId: string,
  data?: { userId?: string; messageLength?: number; workspaceId?: string }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data?.workspaceId,
    eventType: 'MESSAGE_IN',
    data: {
      userId: data?.userId,
      messageLength: data?.messageLength,
    },
  })
}

/**
 * Track outgoing message with response metrics
 */
export async function trackMessageOut(
  tenantId: string,
  channelId: string,
  metrics: {
    responseTimeMs: number
    tokensIn: number
    tokensOut: number
    cost: number
    model: string
    workspaceId?: string
    userId?: string
  }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: metrics.workspaceId,
    eventType: 'MESSAGE_OUT',
    responseTimeMs: metrics.responseTimeMs,
    tokensIn: metrics.tokensIn,
    tokensOut: metrics.tokensOut,
    cost: metrics.cost,
    model: metrics.model,
    data: { userId: metrics.userId },
  })
}

/**
 * Track conversation start
 */
export async function trackConversationStart(
  tenantId: string,
  channelId: string,
  data?: { userId?: string; workspaceId?: string }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data?.workspaceId,
    eventType: 'CONVERSATION_START',
    data: { userId: data?.userId },
  })
}

/**
 * Track conversation end
 */
export async function trackConversationEnd(
  tenantId: string,
  channelId: string,
  data?: { userId?: string; workspaceId?: string; durationMs?: number; resolved?: boolean }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data?.workspaceId,
    eventType: 'CONVERSATION_END',
    data: {
      userId: data?.userId,
      durationMs: data?.durationMs,
      resolved: data?.resolved,
    },
  })
}

/**
 * Track handoff request (user wants human)
 */
export async function trackHandoffRequest(
  tenantId: string,
  channelId: string,
  data?: { userId?: string; workspaceId?: string; reason?: string }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data?.workspaceId,
    eventType: 'HANDOFF_REQUESTED',
    data: { userId: data?.userId, reason: data?.reason },
  })
}

/**
 * Track handoff completion
 */
export async function trackHandoffCompleted(
  tenantId: string,
  channelId: string,
  data?: { userId?: string; workspaceId?: string; handledBy?: string; durationMs?: number }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data?.workspaceId,
    eventType: 'HANDOFF_COMPLETED',
    data: {
      userId: data?.userId,
      handledBy: data?.handledBy,
      durationMs: data?.durationMs,
    },
  })
}

/**
 * Track error
 */
export async function trackError(
  tenantId: string,
  channelId: string,
  error: { message: string; code?: string; workspaceId?: string }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: error.workspaceId,
    eventType: 'ERROR',
    data: { message: error.message, code: error.code },
  })
}

/**
 * Track user feedback
 */
export async function trackFeedback(
  tenantId: string,
  channelId: string,
  feedback: { positive: boolean; userId?: string; workspaceId?: string; comment?: string }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: feedback.workspaceId,
    eventType: feedback.positive ? 'FEEDBACK_POSITIVE' : 'FEEDBACK_NEGATIVE',
    data: { userId: feedback.userId, comment: feedback.comment },
  })
}

/**
 * Track specialist invocation
 */
export async function trackSpecialistInvoked(
  tenantId: string,
  channelId: string,
  data: {
    specialistId: string
    specialistName: string
    workspaceId?: string
    tokensIn?: number
    tokensOut?: number
    cost?: number
    model?: string
  }
): Promise<void> {
  await trackEvent({
    tenantId,
    channelId,
    workspaceId: data.workspaceId,
    eventType: 'SPECIALIST_INVOKED',
    tokensIn: data.tokensIn,
    tokensOut: data.tokensOut,
    cost: data.cost,
    model: data.model,
    data: { specialistId: data.specialistId, specialistName: data.specialistName },
  })
}

/**
 * Batch track multiple events (for efficiency)
 */
export async function trackEventsBatch(events: TrackEventInput[]): Promise<void> {
  try {
    await prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        tenantId: e.tenantId,
        workspaceId: e.workspaceId,
        channelId: e.channelId,
        eventType: e.eventType,
        data: (e.data ?? {}) as Prisma.InputJsonValue,
        responseTimeMs: e.responseTimeMs,
        tokensIn: e.tokensIn,
        tokensOut: e.tokensOut,
        cost: e.cost,
        model: e.model,
        timestamp: new Date(),
      })),
    })
  } catch (error) {
    console.error('[Analytics] Failed to track batch events:', error)
  }
}
