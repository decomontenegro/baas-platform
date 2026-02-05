import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/llm/providers
 *
 * Returns list of LLM providers with their current status
 * Available to all authenticated users (read-only)
 *
 * Response:
 *   - Array of providers with status, priority, and capacity info
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all providers with recent status history
    const providers = await prisma.lLMProvider.findMany({
      orderBy: { priority: 'asc' },
      include: {
        ProviderStatusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            LLMUsage: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
                },
              },
            },
          },
        },
      },
    })

    // Calculate load for each provider (requests in last hour / rate limit)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const loadData = await prisma.lLMUsage.groupBy({
      by: ['providerId'],
      where: {
        createdAt: { gte: oneHourAgo },
      },
      _count: true,
    })
    const loadMap = new Map<string, number>(loadData.map((l) => [l.providerId, l._count]))

    const formattedProviders = providers.map((provider) => {
      const requestsLastHour = loadMap.get(provider.id) || 0
      const loadPercent = provider.rateLimit > 0
        ? Math.min(100, (requestsLastHour / (provider.rateLimit * 60)) * 100)
        : 0

      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        model: provider.model,
        status: provider.status,
        priority: provider.priority,
        rateLimit: provider.rateLimit,
        concurrency: provider.concurrency,
        costPerInputToken: provider.costPerInputToken,
        costPerOutputToken: provider.costPerOutputToken,
        lastCheckedAt: provider.lastCheckedAt,
        lastErrorAt: provider.lastErrorAt,
        errorCount: provider.errorCount,
        // Computed fields
        currentLoad: Math.round(loadPercent * 100) / 100,
        requestsLast24h: provider._count.LLMUsage,
        lastStatusChange: provider.ProviderStatusHistory[0] || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedProviders,
      meta: {
        total: formattedProviders.length,
        active: formattedProviders.filter((p) => p.status === 'ACTIVE').length,
        degraded: formattedProviders.filter((p) => p.status === 'DEGRADED').length,
        unavailable: formattedProviders.filter((p) =>
          ['CIRCUIT_OPEN', 'RATE_LIMITED', 'DISABLED', 'MAINTENANCE'].includes(p.status)
        ).length,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching LLM providers:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch providers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/llm/providers
 *
 * Update provider status (Admin only)
 *
 * Body:
 *   - providerId: string (required)
 *   - status: 'ACTIVE' | 'DISABLED' | 'MAINTENANCE' (required)
 *   - reason: string (optional)
 *
 * Response:
 *   - Updated provider data
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    const userRole = session.user.role
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Parse body
    const body = await request.json()
    const { providerId, status, reason } = body

    // Validate required fields
    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'providerId is required' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'status is required' },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ['ACTIVE', 'DEGRADED', 'RATE_LIMITED', 'CIRCUIT_OPEN', 'MAINTENANCE', 'DISABLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Valid values: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Get current provider
    const currentProvider = await prisma.lLMProvider.findUnique({
      where: { id: providerId },
    })

    if (!currentProvider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Update provider and create status history entry in transaction
    const [updatedProvider] = await prisma.$transaction([
      prisma.lLMProvider.update({
        where: { id: providerId },
        data: {
          status,
          lastCheckedAt: new Date(),
          // Reset error count if activating
          ...(status === 'ACTIVE' && { errorCount: 0, lastErrorAt: null }),
        },
      }),
      prisma.providerStatusHistory.create({
        data: {
          providerId,
          fromStatus: currentProvider.status,
          toStatus: status,
          reason: reason || `Manual status change by admin`,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: updatedProvider,
      message: `Provider ${currentProvider.name} status updated to ${status}`,
    })
  } catch (error) {
    console.error('[API] Error updating LLM provider:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update provider',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
