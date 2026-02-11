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

// GET /api/campaigns/[id]/stats - Get campaign statistics
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
    })

    if (!campaign || campaign.deletedAt) {
      throw new NotFoundError('Campaign')
    }

    if (campaign.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied')
    }

    // Get recipient statistics
    const [
      totalRecipients,
      statusCounts,
      recentRecipients,
      responseTypes,
    ] = await Promise.all([
      // Total recipients
      prisma.campaignRecipient.count({
        where: { campaignId: id },
      }),
      
      // Count by status
      prisma.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId: id },
        _count: { status: true },
      }),
      
      // Recent activity (last 10 recipients with activity)
      prisma.campaignRecipient.findMany({
        where: { 
          campaignId: id,
          OR: [
            { sentAt: { not: null } },
            { deliveredAt: { not: null } },
            { respondedAt: { not: null } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          contactId: true,
          contactName: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          respondedAt: true,
          response: true,
          responseType: true,
        },
      }),
      
      // Response types breakdown
      prisma.campaignRecipient.groupBy({
        by: ['responseType'],
        where: { 
          campaignId: id,
          responseType: { not: null },
        },
        _count: { responseType: true },
      }),
    ])

    // Build stats object
    const statusMap = new Map(
      statusCounts.map(s => [s.status, s._count.status])
    )

    const stats = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      recipients: {
        total: totalRecipients,
        pending: statusMap.get('PENDING') || 0,
        queued: statusMap.get('QUEUED') || 0,
        sending: statusMap.get('SENDING') || 0,
        sent: statusMap.get('SENT') || 0,
        delivered: statusMap.get('DELIVERED') || 0,
        read: statusMap.get('READ') || 0,
        responded: statusMap.get('RESPONDED') || 0,
        failed: statusMap.get('FAILED') || 0,
        skipped: statusMap.get('SKIPPED') || 0,
        optOut: statusMap.get('OPT_OUT') || 0,
      },
      rates: {
        deliveryRate: totalRecipients > 0 
          ? (((statusMap.get('DELIVERED') || 0) + (statusMap.get('READ') || 0) + (statusMap.get('RESPONDED') || 0)) / totalRecipients * 100).toFixed(2)
          : 0,
        readRate: totalRecipients > 0 
          ? (((statusMap.get('READ') || 0) + (statusMap.get('RESPONDED') || 0)) / totalRecipients * 100).toFixed(2)
          : 0,
        responseRate: totalRecipients > 0 
          ? ((statusMap.get('RESPONDED') || 0) / totalRecipients * 100).toFixed(2)
          : 0,
        failureRate: totalRecipients > 0 
          ? ((statusMap.get('FAILED') || 0) / totalRecipients * 100).toFixed(2)
          : 0,
      },
      responseTypes: responseTypes.map(r => ({
        type: r.responseType,
        count: r._count.responseType,
      })),
      recentActivity: recentRecipients,
      progress: {
        processed: totalRecipients - (statusMap.get('PENDING') || 0) - (statusMap.get('QUEUED') || 0),
        remaining: (statusMap.get('PENDING') || 0) + (statusMap.get('QUEUED') || 0),
        percentage: totalRecipients > 0
          ? ((totalRecipients - (statusMap.get('PENDING') || 0) - (statusMap.get('QUEUED') || 0)) / totalRecipients * 100).toFixed(2)
          : 0,
      },
    }

    return apiResponse({ stats })
  } catch (error) {
    return handleApiError(error)
  }
}
