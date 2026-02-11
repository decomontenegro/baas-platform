import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/llm/settings
 *
 * Returns tenant's LLM settings including:
 * - Budget and limits
 * - Alert thresholds
 * - Allowed providers
 * - Agents with individual limits
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true },
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    const tenant = user.Tenant!

    // Get all providers
    const providers = await prisma.lLMProvider.findMany({
      orderBy: { priority: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        model: true,
        priority: true,
        status: true,
        costPerInputToken: true,
        costPerOutputToken: true,
      },
    })

    // Get tenant's agents
    const agents = await prisma.tenantAgent.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        avatar: true,
        dailyLimit: true,
        active: true,
        preferredModel: true,
      },
    })

    // Parse alert thresholds
    let alertThresholds: number[] = [0.2, 0.1, 0.05, 0.01]
    if (tenant.alertThresholds) {
      try {
        const parsed = typeof tenant.alertThresholds === 'string'
          ? JSON.parse(tenant.alertThresholds)
          : tenant.alertThresholds
        if (Array.isArray(parsed)) {
          alertThresholds = parsed.map(Number).filter((n) => !isNaN(n))
        }
      } catch {
        // Keep defaults
      }
    }

    // Calculate current usage for context
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [monthlyUsage, dailyUsage] = await Promise.all([
      prisma.lLMUsage.aggregate({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: startOfMonth },
        },
        _sum: { cost: true },
      }),
      prisma.lLMUsage.aggregate({
        where: {
          tenantId: user.tenantId,
          createdAt: { gte: startOfDay },
        },
        _sum: { cost: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        // Budget & Limits
        monthlyBudget: tenant.monthlyBudget,
        dailyLimit: tenant.dailyLimit,
        llmSuspended: tenant.llmSuspended,
        
        // Alert thresholds (as percentages: 0.2 = 20%)
        alertThresholds,
        
        // Allowed providers (empty = all allowed)
        allowedProviders: tenant.allowedProviders || [],
        
        // All available providers
        providers: providers.map((p) => ({
          ...p,
          isFree: p.type === 'MAX_SUBSCRIPTION', // MAX providers are "free" (included in subscription)
          isPaid: p.type === 'API_PAID',
        })),
        
        // Tenant's agents
        agents,
        
        // Current usage context
        usage: {
          monthly: monthlyUsage._sum.cost || 0,
          daily: dailyUsage._sum.cost || 0,
          monthlyPercentUsed: tenant.monthlyBudget
            ? ((monthlyUsage._sum.cost || 0) / tenant.monthlyBudget) * 100
            : 0,
          dailyPercentUsed: tenant.dailyLimit
            ? ((dailyUsage._sum.cost || 0) / tenant.dailyLimit) * 100
            : 0,
        },
      },
    })
  } catch (error) {
    console.error('[API] Error fetching LLM settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch LLM settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/llm/settings
 *
 * Update tenant's LLM settings
 *
 * Body (all optional):
 *   - monthlyBudget: number | null
 *   - dailyLimit: number | null
 *   - llmSuspended: boolean
 *   - alertThresholds: number[] (values between 0-1)
 *   - allowedProviders: string[] (provider IDs)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin/owner role
    const userRole = session.user.role
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true },
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      monthlyBudget,
      dailyLimit,
      llmSuspended,
      alertThresholds,
      allowedProviders,
    } = body

    // Validate inputs
    const updateData: Record<string, unknown> = {}

    // Budget validation
    if (monthlyBudget !== undefined) {
      if (monthlyBudget !== null && (typeof monthlyBudget !== 'number' || monthlyBudget < 0)) {
        return NextResponse.json(
          { success: false, error: 'monthlyBudget must be a positive number or null' },
          { status: 400 }
        )
      }
      updateData.monthlyBudget = monthlyBudget
    }

    // Daily limit validation
    if (dailyLimit !== undefined) {
      if (dailyLimit !== null && (typeof dailyLimit !== 'number' || dailyLimit < 0)) {
        return NextResponse.json(
          { success: false, error: 'dailyLimit must be a positive number or null' },
          { status: 400 }
        )
      }
      updateData.dailyLimit = dailyLimit
    }

    // Suspended flag
    if (llmSuspended !== undefined) {
      if (typeof llmSuspended !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'llmSuspended must be a boolean' },
          { status: 400 }
        )
      }
      updateData.llmSuspended = llmSuspended
    }

    // Alert thresholds validation
    if (alertThresholds !== undefined) {
      if (!Array.isArray(alertThresholds)) {
        return NextResponse.json(
          { success: false, error: 'alertThresholds must be an array' },
          { status: 400 }
        )
      }
      
      const validThresholds = alertThresholds.every(
        (t) => typeof t === 'number' && t >= 0 && t <= 1
      )
      if (!validThresholds) {
        return NextResponse.json(
          { success: false, error: 'alertThresholds values must be between 0 and 1' },
          { status: 400 }
        )
      }
      
      updateData.alertThresholds = alertThresholds
    }

    // Allowed providers validation
    if (allowedProviders !== undefined) {
      if (!Array.isArray(allowedProviders)) {
        return NextResponse.json(
          { success: false, error: 'allowedProviders must be an array' },
          { status: 400 }
        )
      }
      
      // Validate provider IDs exist
      if (allowedProviders.length > 0) {
        const existingProviders = await prisma.lLMProvider.findMany({
          where: { id: { in: allowedProviders } },
          select: { id: true },
        })
        
        if (existingProviders.length !== allowedProviders.length) {
          return NextResponse.json(
            { success: false, error: 'One or more provider IDs are invalid' },
            { status: 400 }
          )
        }
      }
      
      updateData.allowedProviders = allowedProviders
    }

    // Update tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: user.tenantId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        monthlyBudget: updatedTenant.monthlyBudget,
        dailyLimit: updatedTenant.dailyLimit,
        llmSuspended: updatedTenant.llmSuspended,
        alertThresholds: updatedTenant.alertThresholds,
        allowedProviders: updatedTenant.allowedProviders,
      },
      message: 'LLM settings updated successfully',
    })
  } catch (error) {
    console.error('[API] Error updating LLM settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update LLM settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
