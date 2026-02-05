/**
 * Seed Channel-level DailyStats
 * This fixes the Channel Breakdown chart on the Overview page
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedChannelStats() {
  console.log('🌱 Seeding channel-level statistics...\n')

  // Get all active tenants with channels
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: {
      workspaces: {
        where: { deletedAt: null },
        include: {
          channels: {
            where: { deletedAt: null },
            select: { id: true, name: true, type: true, workspaceId: true }
          }
        }
      }
    }
  })

  let totalCreated = 0

  for (const tenant of tenants) {
    console.log(`📊 Tenant: ${tenant.name}`)
    
    // Get existing tenant-level daily stats
    const tenantStats = await prisma.dailyStats.findMany({
      where: {
        tenantId: tenant.id,
        channelId: null
      },
      orderBy: { date: 'asc' }
    })

    if (tenantStats.length === 0) {
      console.log('   ⚠️ No tenant stats found, skipping...')
      continue
    }

    // Gather all channels for this tenant
    const allChannels = tenants
      .find(t => t.id === tenant.id)
      ?.workspaces
      .flatMap(w => w.channels.map(c => ({ ...c, workspaceId: w.id }))) || []

    if (allChannels.length === 0) {
      console.log('   ⚠️ No channels found, skipping...')
      continue
    }

    console.log(`   📱 Found ${allChannels.length} channels`)

    // For each day with stats, distribute among channels
    for (const dayStat of tenantStats) {
      // Check if channel stats already exist for this date
      const existingChannelStats = await prisma.dailyStats.count({
        where: {
          tenantId: tenant.id,
          date: dayStat.date,
          channelId: { not: null }
        }
      })

      if (existingChannelStats > 0) {
        continue // Skip if already has channel stats
      }

      // Distribute stats among channels with some variation
      const shuffled = [...allChannels].sort(() => Math.random() - 0.5)
      const activeChannels = shuffled.slice(0, Math.max(1, Math.floor(allChannels.length * 0.6)))
      
      // Generate weights for distribution
      const weights = activeChannels.map(() => Math.random() + 0.1)
      const totalWeight = weights.reduce((a, b) => a + b, 0)

      for (let i = 0; i < activeChannels.length; i++) {
        const channel = activeChannels[i]
        const weight = weights[i] / totalWeight

        // Distribute proportionally with some randomness
        const messagesIn = Math.floor(dayStat.messagesIn * weight * (0.8 + Math.random() * 0.4))
        const messagesOut = Math.floor(dayStat.messagesOut * weight * (0.8 + Math.random() * 0.4))
        const conversationsStarted = Math.floor(dayStat.conversationsStarted * weight)
        const conversationsEnded = Math.floor(dayStat.conversationsEnded * weight)
        const cost = Number(dayStat.cost) * weight
        const tokensIn = Math.floor(dayStat.tokensIn * weight)
        const tokensOut = Math.floor(dayStat.tokensOut * weight)
        const feedbackPositive = Math.floor(dayStat.feedbackPositive * weight)
        const feedbackNegative = Math.floor(dayStat.feedbackNegative * weight)

        // Add some variation to response time
        const avgResponseTimeMs = dayStat.avgResponseTimeMs 
          ? Math.floor(dayStat.avgResponseTimeMs * (0.7 + Math.random() * 0.6))
          : null

        await prisma.dailyStats.create({
          data: {
            tenantId: tenant.id,
            workspaceId: channel.workspaceId,
            channelId: channel.id,
            date: dayStat.date,
            messagesIn,
            messagesOut,
            conversationsStarted,
            conversationsEnded,
            avgResponseTimeMs,
            p50ResponseTimeMs: avgResponseTimeMs ? Math.floor(avgResponseTimeMs * 0.8) : null,
            p95ResponseTimeMs: avgResponseTimeMs ? Math.floor(avgResponseTimeMs * 1.5) : null,
            p99ResponseTimeMs: avgResponseTimeMs ? Math.floor(avgResponseTimeMs * 2) : null,
            handoffRequests: Math.floor(Math.random() * 3),
            handoffCompleted: Math.floor(Math.random() * 2),
            errorCount: Math.floor(Math.random() * 2),
            feedbackPositive,
            feedbackNegative,
            tokensIn,
            tokensOut,
            cost,
            uniqueUsers: Math.floor(messagesIn * 0.3) + 1,
            peakHour: Math.floor(Math.random() * 12) + 8, // 8-20h
          }
        })
        totalCreated++
      }
    }
    
    console.log(`   ✅ Created stats for ${tenantStats.length} days`)
  }

  console.log(`\n✅ Seeding complete! Created ${totalCreated} channel-level stat records.`)
}

seedChannelStats()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
