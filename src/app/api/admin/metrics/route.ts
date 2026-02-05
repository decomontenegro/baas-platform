import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/metrics
 * Get metrics for admin agent dashboard
 * 
 * Query params:
 * - botId: string (optional) - filter by specific bot
 * - period: string (optional) - 24h, 7d, 30d, 90d (default: 7d)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const tenantId = user.tenantId
    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('botId')
    const period = searchParams.get('period') || '7d'

    // Calculate date range based on period
    const now = new Date()
    const periodDays = parsePeriod(period)
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

    // Base where clause
    const tenantWhere = { tenantId }
    const botWhere = botId ? { ...tenantWhere, id: botId } : tenantWhere
    const dateWhere = { createdAt: { gte: startDate } }

    // Fetch metrics in parallel
    const [
      // Bot metrics
      totalBots,
      activeBots,
      bots,
      // Conversation metrics
      totalConversations,
      conversationsByStatus,
      newConversations,
      // Message metrics
      totalMessages,
      messagesByRole,
      // Alert metrics
      openAlerts,
      // Handoff metrics
      handoffConversations
    ] = await Promise.all([
      // Total bots
      prisma.bot.count({ where: botWhere }),
      // Active bots
      prisma.bot.count({ where: { ...botWhere, isActive: true } }),
      // Bot details (for per-bot metrics)
      prisma.bot.findMany({
        where: botWhere,
        select: {
          id: true,
          name: true,
          avatar: true,
          isActive: true,
          messageCount: true,
          conversationCount: true,
          lastUsedAt: true
        }
      }),
      // Total conversations
      prisma.conversation.count({
        where: { ...tenantWhere, ...(botId ? {} : dateWhere) }
      }),
      // Conversations by status
      prisma.conversation.groupBy({
        by: ['status'],
        where: tenantWhere,
        _count: { id: true }
      }),
      // New conversations in period
      prisma.conversation.count({
        where: { ...tenantWhere, ...dateWhere }
      }),
      // Total messages
      prisma.message.count({
        where: {
          conversation: tenantWhere,
          ...(botId ? {} : dateWhere)
        }
      }),
      // Messages by role in period
      prisma.message.groupBy({
        by: ['role'],
        where: {
          conversation: tenantWhere,
          ...dateWhere
        },
        _count: { id: true }
      }),
      // Open alerts
      prisma.adminAlert.count({
        where: {
          adminAgent: { tenantId },
          status: 'OPEN',
          ...(botId ? { botId } : {})
        }
      }),
      // Handoff conversations
      prisma.conversation.count({
        where: {
          ...tenantWhere,
          status: 'HANDOFF',
          ...dateWhere
        }
      })
    ])

    // Calculate derived metrics
    const messagesByRoleMap = messagesByRole.reduce((acc, item) => {
      acc[item.role] = item._count.id
      return acc
    }, {} as Record<string, number>)

    const conversationsByStatusMap = conversationsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id
      return acc
    }, {} as Record<string, number>)

    // Calculate response metrics (average messages per conversation)
    const avgMessagesPerConversation = totalConversations > 0 
      ? Math.round((totalMessages / totalConversations) * 10) / 10 
      : 0

    // Build response
    const metrics = {
      period: {
        label: period,
        days: periodDays,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      },
      summary: {
        totalBots,
        activeBots,
        totalConversations,
        newConversations,
        totalMessages,
        openAlerts,
        handoffConversations
      },
      conversations: {
        total: totalConversations,
        new: newConversations,
        byStatus: conversationsByStatusMap,
        avgMessagesPerConversation
      },
      messages: {
        total: totalMessages,
        byRole: {
          user: messagesByRoleMap['USER'] || 0,
          assistant: messagesByRoleMap['ASSISTANT'] || 0,
          system: messagesByRoleMap['SYSTEM'] || 0,
          operator: messagesByRoleMap['OPERATOR'] || 0
        },
        inPeriod: Object.values(messagesByRoleMap).reduce((a, b) => a + b, 0)
      },
      bots: bots.map(bot => ({
        id: bot.id,
        name: bot.name,
        avatar: bot.avatar,
        isActive: bot.isActive,
        messageCount: bot.messageCount,
        conversationCount: bot.conversationCount,
        lastUsedAt: bot.lastUsedAt
      })),
      alerts: {
        open: openAlerts
      }
    }

    // If specific bot requested, add bot-specific metrics
    if (botId) {
      const bot = bots.find(b => b.id === botId)
      if (!bot) {
        return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
      }

      // Get bot-specific conversation and message counts for period
      const [botConversationsInPeriod, botMessagesInPeriod] = await Promise.all([
        prisma.conversation.count({
          where: {
            tenantId,
            ...dateWhere
            // Note: We'd need a botId field on Conversation to filter properly
            // For now, return tenant-level data
          }
        }),
        prisma.message.count({
          where: {
            conversation: { tenantId },
            role: 'ASSISTANT',
            ...dateWhere
          }
        })
      ])

      return NextResponse.json({
        ...metrics,
        bot: {
          ...bot,
          conversationsInPeriod: botConversationsInPeriod,
          messagesInPeriod: botMessagesInPeriod
        }
      })
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

/**
 * Parse period string to number of days
 */
function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)([hdwm])$/)
  if (!match) return 7 // default 7 days

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case 'h': return value / 24
    case 'd': return value
    case 'w': return value * 7
    case 'm': return value * 30
    default: return 7
  }
}
