import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/campaigns/[id]/pause - Pause a running campaign
export async function POST(
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

    // Can only pause running or queued campaigns
    if (!['RUNNING', 'QUEUED'].includes(campaign.status)) {
      throw new ForbiddenError(`Cannot pause campaign with status ${campaign.status}`)
    }

    // Update campaign status to paused
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'PAUSED',
      },
    })

    return apiResponse({
      campaign: updated,
      message: 'Campaign paused successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
