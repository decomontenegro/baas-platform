import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  checkAllAccessPoints, 
  isEmergencyAccessNeeded,
  getEmergencyInstructions 
} from '@/lib/admin-agent/emergency-access'

/**
 * GET /api/admin/emergency
 * Get emergency access status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    // Check all access points
    const accessPoints = await checkAllAccessPoints(user.tenantId)
    const emergencyStatus = await isEmergencyAccessNeeded(user.tenantId)

    return NextResponse.json({
      accessPoints,
      emergency: emergencyStatus,
      instructions: emergencyStatus.needed 
        ? getEmergencyInstructions(emergencyStatus.availablePoints)
        : null
    })
  } catch (error) {
    console.error('Error checking emergency access:', error)
    return NextResponse.json(
      { error: 'Failed to check emergency access' },
      { status: 500 }
    )
  }
}
