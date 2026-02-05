/**
 * Scheduled Messages & Campaigns Worker
 * 
 * This worker processes scheduled messages and campaigns.
 * It should be called by a cron job every minute.
 * 
 * Usage:
 *   - Cron job: Call POST /api/cron/scheduler every minute
 *   - Or run directly: npx tsx src/lib/workers/scheduler.ts
 */

import { prisma } from '@/lib/prisma'
import { addDays, addWeeks, addMonths, isBefore, isAfter } from 'date-fns'

interface SendMessageParams {
  channelId: string
  contactId: string
  content: string
  contentType: string
  attachments?: unknown[]
}

// Placeholder for actual message sending
// In production, this would integrate with the channel provider (WhatsApp, Telegram, etc.)
async function sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // TODO: Implement actual message sending via channel provider
  console.log('[Scheduler] Sending message:', params)
  
  // Simulate sending delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // For now, return success
  return {
    success: true,
    externalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
}

/**
 * Process scheduled messages that are due
 */
export async function processScheduledMessages(): Promise<{
  processed: number
  sent: number
  failed: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []
  let processed = 0
  let sent = 0
  let failed = 0

  try {
    // Find messages that are due for sending
    const dueMessages = await prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: {
          lte: now,
        },
        deletedAt: null,
      },
      take: 100, // Process in batches
      orderBy: {
        scheduledFor: 'asc',
      },
    })

    console.log(`[Scheduler] Found ${dueMessages.length} messages to process`)

    for (const message of dueMessages) {
      processed++

      try {
        // Mark as processing
        await prisma.scheduledMessage.update({
          where: { id: message.id },
          data: { status: 'PROCESSING' },
        })

        // Send the message
        const result = await sendMessage({
          channelId: message.channelId,
          contactId: message.contactId || '',
          content: message.content,
          contentType: message.contentType,
          attachments: message.attachments as unknown[],
        })

        if (result.success) {
          sent++

          // Handle recurring messages
          if (message.scheduleType === 'RECURRING' && message.recurrence) {
            const recurrence = message.recurrence as {
              pattern: 'daily' | 'weekly' | 'monthly'
              interval: number
              endDate?: string
              maxOccurrences?: number
            }

            // Calculate next occurrence
            let nextDate: Date
            switch (recurrence.pattern) {
              case 'daily':
                nextDate = addDays(message.scheduledFor, recurrence.interval || 1)
                break
              case 'weekly':
                nextDate = addWeeks(message.scheduledFor, recurrence.interval || 1)
                break
              case 'monthly':
                nextDate = addMonths(message.scheduledFor, recurrence.interval || 1)
                break
              default:
                nextDate = addDays(message.scheduledFor, 1)
            }

            // Check if recurrence should end
            const shouldContinue =
              (!recurrence.endDate || isBefore(nextDate, new Date(recurrence.endDate)))

            if (shouldContinue) {
              // Update for next occurrence
              await prisma.scheduledMessage.update({
                where: { id: message.id },
                data: {
                  status: 'PENDING',
                  scheduledFor: nextDate,
                  sentAt: now,
                },
              })
            } else {
              // Mark as completed
              await prisma.scheduledMessage.update({
                where: { id: message.id },
                data: {
                  status: 'COMPLETED',
                  sentAt: now,
                },
              })
            }
          } else {
            // One-time message - mark as sent
            await prisma.scheduledMessage.update({
              where: { id: message.id },
              data: {
                status: 'SENT',
                sentAt: now,
              },
            })
          }
        } else {
          failed++
          
          // Handle retry logic
          const retryCount = message.retryCount + 1
          
          if (retryCount < message.maxRetries) {
            // Schedule retry (exponential backoff: 1min, 5min, 25min)
            const retryDelay = Math.pow(5, retryCount) * 60 * 1000
            const nextRetry = new Date(now.getTime() + retryDelay)

            await prisma.scheduledMessage.update({
              where: { id: message.id },
              data: {
                status: 'PENDING',
                retryCount,
                lastRetryAt: now,
                nextRetryAt: nextRetry,
                error: result.error,
              },
            })
          } else {
            // Max retries reached
            await prisma.scheduledMessage.update({
              where: { id: message.id },
              data: {
                status: 'FAILED',
                retryCount,
                lastRetryAt: now,
                error: result.error || 'Max retries exceeded',
              },
            })
          }
          
          errors.push(`Message ${message.id}: ${result.error}`)
        }
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Message ${message.id}: ${errorMessage}`)

        // Mark as failed
        await prisma.scheduledMessage.update({
          where: { id: message.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
          },
        })
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Scheduler error: ${errorMessage}`)
  }

  return { processed, sent, failed, errors }
}

/**
 * Process campaign messages in queue
 */
export async function processCampaigns(): Promise<{
  campaignsProcessed: number
  messagesSent: number
  messagesFailed: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []
  let campaignsProcessed = 0
  let messagesSent = 0
  let messagesFailed = 0

  try {
    // Find campaigns that are queued or running
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        status: {
          in: ['QUEUED', 'RUNNING'],
        },
        deletedAt: null,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: now } },
        ],
      },
      include: {
        recipients: {
          where: {
            status: 'QUEUED',
          },
          take: 100, // Process in batches
        },
      },
    })

    console.log(`[Scheduler] Found ${activeCampaigns.length} active campaigns`)

    for (const campaign of activeCampaigns) {
      campaignsProcessed++

      // Update status to running if queued
      if (campaign.status === 'QUEUED') {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'RUNNING', startedAt: now },
        })
      }

      // Process recipients
      for (const recipient of campaign.recipients) {
        try {
          // Mark as sending
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SENDING' },
          })

          // Send message
          const result = await sendMessage({
            channelId: recipient.channelId || campaign.channelId || '',
            contactId: recipient.contactId,
            content: campaign.content || '',
            contentType: campaign.contentType,
            attachments: campaign.attachments as unknown[],
          })

          if (result.success) {
            messagesSent++

            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SENT',
                sentAt: now,
                externalMessageId: result.externalId,
              },
            })

            // Update campaign counters
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { sentCount: { increment: 1 } },
            })
          } else {
            messagesFailed++

            await prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                failedAt: now,
                failureReason: result.error,
              },
            })

            // Update campaign counters
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { failedCount: { increment: 1 } },
            })

            errors.push(`Campaign ${campaign.id}, Recipient ${recipient.id}: ${result.error}`)
          }

          // Respect rate limiting
          await new Promise(resolve => setTimeout(resolve, campaign.delayBetweenMs))
        } catch (error) {
          messagesFailed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Campaign ${campaign.id}, Recipient ${recipient.id}: ${errorMessage}`)

          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              failedAt: now,
              failureReason: errorMessage,
            },
          })
        }
      }

      // Check if campaign is complete
      const remainingRecipients = await prisma.campaignRecipient.count({
        where: {
          campaignId: campaign.id,
          status: { in: ['PENDING', 'QUEUED', 'SENDING'] },
        },
      })

      if (remainingRecipients === 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
          },
        })
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Campaign processor error: ${errorMessage}`)
  }

  return { campaignsProcessed, messagesSent, messagesFailed, errors }
}

/**
 * Main worker function - processes both scheduled messages and campaigns
 */
export async function runSchedulerWorker(): Promise<{
  scheduledMessages: Awaited<ReturnType<typeof processScheduledMessages>>
  campaigns: Awaited<ReturnType<typeof processCampaigns>>
}> {
  console.log('[Scheduler] Starting worker run...')
  const startTime = Date.now()

  const [scheduledMessages, campaigns] = await Promise.all([
    processScheduledMessages(),
    processCampaigns(),
  ])

  const duration = Date.now() - startTime
  console.log(`[Scheduler] Worker completed in ${duration}ms`)
  console.log(`[Scheduler] Messages: ${scheduledMessages.sent} sent, ${scheduledMessages.failed} failed`)
  console.log(`[Scheduler] Campaigns: ${campaigns.messagesSent} sent, ${campaigns.messagesFailed} failed`)

  return { scheduledMessages, campaigns }
}

// Allow running directly via CLI
if (require.main === module) {
  runSchedulerWorker()
    .then((result) => {
      console.log('Worker result:', JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error('Worker error:', error)
      process.exit(1)
    })
}
