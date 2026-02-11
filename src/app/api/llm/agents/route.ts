import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/llm/agents
 *
 * Update a tenant agent's settings
 *
 * Body:
 *   - agentId: string (required)
 *   - dailyLimit: number | null (optional)
 *   - active: boolean (optional)
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
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { agentId, dailyLimit, active } = body

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 }
      )
    }

    // Verify agent belongs to tenant
    const agent = await prisma.tenantAgent.findFirst({
      where: {
        id: agentId,
        tenantId: user.TenantId,
      },
    })

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (dailyLimit !== undefined) {
      if (dailyLimit !== null && (typeof dailyLimit !== 'number' || dailyLimit < 0)) {
        return NextResponse.json(
          { success: false, error: 'dailyLimit must be a positive number or null' },
          { status: 400 }
        )
      }
      updateData.dailyLimit = dailyLimit
    }

    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'active must be a boolean' },
          { status: 400 }
        )
      }
      updateData.active = active
    }

    // Update agent
    const updatedAgent = await prisma.tenantAgent.update({
      where: { id: agentId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: updatedAgent,
      message: `Agent "${updatedAgent.name}" updated successfully`,
    })
  } catch (error) {
    console.error('[API] Error updating agent:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
