import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, addCampaignRecipientsSchema, paginationSchema, parseQuery } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/campaigns/[id]/recipients - List campaign recipients
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    })

    if (!campaign || campaign.deletedAt) {
      throw new NotFoundError('Campaign')
    }

    if (campaign.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    const { page, limit } = parseQuery(request, paginationSchema)
    const skip = (page - 1) * limit

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ])

    return apiResponse({
      recipients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/campaigns/[id]/recipients - Add recipients to campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    })

    if (!campaign || campaign.deletedAt) {
      throw new NotFoundError('Campaign')
    }

    if (campaign.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    // Can only add recipients to draft or scheduled campaigns
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new ForbiddenError(`Cannot add recipients to campaign with status ${campaign.status}`)
    }

    const data = await parseBody(request, addCampaignRecipientsSchema)

    // Create recipients (skip duplicates)
    const createdRecipients = await prisma.$transaction(async (tx) => {
      const results = []
      
      for (const recipient of data.recipients) {
        try {
          const created = await tx.campaignRecipient.create({
            data: {
              campaignId: id,
              contactId: recipient.contactId,
              contactName: recipient.contactName,
              contactInfo: recipient.contactInfo || {},
              channelId: recipient.channelId,
              status: 'PENDING',
            },
          })
          results.push({ success: true, recipient: created })
        } catch (error) {
          // Skip duplicates (unique constraint violation)
          results.push({ 
            success: false, 
            contactId: recipient.contactId, 
            error: 'Duplicate recipient' 
          })
        }
      }
      
      // Update campaign total
      const newTotal = await tx.campaignRecipient.count({
        where: { campaignId: id },
      })
      
      await tx.campaign.update({
        where: { id },
        data: { totalRecipients: newTotal },
      })
      
      return results
    })

    const successCount = createdRecipients.filter(r => r.success).length
    const failedCount = createdRecipients.filter(r => !r.success).length

    return apiResponse({
      added: successCount,
      skipped: failedCount,
      details: createdRecipients,
    }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
