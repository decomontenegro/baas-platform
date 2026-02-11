import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError, noContent } from '@/lib/api/errors'
import { parseBody, updateCampaignSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/campaigns/[id] - Get single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
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

    return apiResponse({ campaign })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/campaigns/[id] - Update campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
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

    // Can only update draft, scheduled, or paused campaigns
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
      throw new ForbiddenError(`Cannot update campaign with status ${campaign.status}`)
    }

    const data = await parseBody(request, updateCampaignSchema)

    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.content !== undefined) updateData.content = data.content
    if (data.contentType !== undefined) updateData.contentType = data.contentType
    if (data.attachments !== undefined) updateData.attachments = data.attachments
    if (data.template !== undefined) updateData.template = data.template
    if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null
    if (data.audienceType !== undefined) updateData.audienceType = data.audienceType
    if (data.audienceFilter !== undefined) updateData.audienceFilter = data.audienceFilter
    if (data.audienceIds !== undefined) updateData.audienceIds = data.audienceIds
    if (data.messagesPerMinute !== undefined) updateData.messagesPerMinute = data.messagesPerMinute
    if (data.delayBetweenMs !== undefined) updateData.delayBetweenMs = data.delayBetweenMs
    if (data.config !== undefined) updateData.config = data.config
    if (data.status !== undefined) updateData.status = data.status

    const updated = await prisma.campaign.update({
      where: { id },
      data: updateData,
    })

    return apiResponse({ campaign: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/campaigns/[id] - Cancel/delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
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

    // Can only delete draft, scheduled, paused, or failed campaigns
    if (!['DRAFT', 'SCHEDULED', 'PAUSED', 'FAILED'].includes(campaign.status)) {
      throw new ForbiddenError(`Cannot delete campaign with status ${campaign.status}`)
    }

    // Soft delete
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
