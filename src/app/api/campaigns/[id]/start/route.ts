import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, BadRequestError } from '@/lib/api/errors'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/campaigns/[id]/start - Start a campaign
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
      include: {
        _count: {
          select: { recipients: true },
        },
      },
    })

    if (!campaign || campaign.deletedAt) {
      throw new NotFoundError('Campaign')
    }

    if (campaign.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    // Can only start draft or scheduled campaigns
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new ForbiddenError(`Cannot start campaign with status ${campaign.status}`)
    }

    // Must have content
    if (!campaign.content) {
      throw new BadRequestError('Campaign must have content before starting')
    }

    // Must have recipients
    if (campaign._count.recipients === 0) {
      throw new BadRequestError('Campaign must have at least one recipient')
    }

    // Update campaign status to queued
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'QUEUED',
        startedAt: new Date(),
      },
    })

    // Queue all pending recipients
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: id,
        status: 'PENDING',
      },
      data: {
        status: 'QUEUED',
      },
    })

    return apiResponse({
      campaign: updated,
      message: 'Campaign started successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
