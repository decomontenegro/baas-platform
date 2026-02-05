/**
 * Seed AnalyticsEvent records for Recent Activity feed
 */

import { PrismaClient, EventType } from '@prisma/client'

const prisma = new PrismaClient()

const EVENT_TYPES: EventType[] = [
  'MESSAGE_IN',
  'MESSAGE_OUT',
  'CONVERSATION_START',
  'CONVERSATION_END',
  'HANDOFF_REQUESTED',
  'HANDOFF_COMPLETED',
  'FEEDBACK_POSITIVE',
  'FEEDBACK_NEGATIVE',
  'SPECIALIST_INVOKED',
  'API_CALL',
  'ERROR'
]

const EVENT_WEIGHTS = {
  MESSAGE_IN: 30,
  MESSAGE_OUT: 30,
  CONVERSATION_START: 10,
  CONVERSATION_END: 8,
  FEEDBACK_POSITIVE: 5,
  FEEDBACK_NEGATIVE: 2,
  SPECIALIST_INVOKED: 5,
  API_CALL: 5,
  HANDOFF_REQUESTED: 3,
  HANDOFF_COMPLETED: 1,
  ERROR: 1,
}

function weightedRandom(): EventType {
  const totalWeight = Object.values(EVENT_WEIGHTS).reduce((a, b) => a + b, 0)
  let random = Math.random() * totalWeight
  
  for (const [type, weight] of Object.entries(EVENT_WEIGHTS)) {
    random -= weight
    if (random <= 0) return type as EventType
  }
  return 'MESSAGE_IN'
}

async function seedAnalyticsEvents() {
  console.log('🌱 Seeding analytics events...\n')

  // Get tenant with channels
  const tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE', deletedAt: null },
    include: {
      workspaces: {
        where: { deletedAt: null },
        include: {
          channels: {
            where: { deletedAt: null },
            take: 10
          }
        }
      }
    }
  })

  if (!tenant) {
    console.log('❌ No tenant found')
    return
  }

  console.log(`📊 Tenant: ${tenant.name}`)

  const allChannels = tenant.workspaces.flatMap(w => 
    w.channels.map(c => ({ ...c, workspaceId: w.id }))
  )

  if (allChannels.length === 0) {
    console.log('❌ No channels found')
    return
  }

  console.log(`📱 Using ${allChannels.length} channels`)

  // Generate events for last 24 hours
  const now = new Date()
  const events = []

  for (let i = 0; i < 100; i++) {
    const channel = allChannels[Math.floor(Math.random() * allChannels.length)]
    const eventType = weightedRandom()
    const hoursAgo = Math.random() * 24
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)

    const hasTokens = ['MESSAGE_IN', 'MESSAGE_OUT', 'SPECIALIST_INVOKED'].includes(eventType)
    const hasResponseTime = eventType === 'MESSAGE_OUT'

    events.push({
      tenantId: tenant.id,
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      eventType,
      data: {
        source: 'seed',
        messageId: `msg_${Date.now()}_${i}`,
      },
      responseTimeMs: hasResponseTime ? Math.floor(Math.random() * 3000) + 500 : null,
      tokensIn: hasTokens ? Math.floor(Math.random() * 500) + 100 : 0,
      tokensOut: hasTokens ? Math.floor(Math.random() * 1000) + 200 : 0,
      cost: hasTokens ? Math.random() * 0.05 : 0,
      model: hasTokens ? 'gpt-4o-mini' : null,
      timestamp,
    })
  }

  // Delete old seeded events
  await prisma.analyticsEvent.deleteMany({
    where: {
      tenantId: tenant.id,
      data: { path: ['source'], equals: 'seed' }
    }
  })

  // Create new events
  await prisma.analyticsEvent.createMany({ data: events })

  console.log(`✅ Created ${events.length} analytics events`)
}

seedAnalyticsEvents()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
