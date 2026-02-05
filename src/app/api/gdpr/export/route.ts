/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * GDPR/LGPD Data Export API
 * 
 * POST /api/gdpr/export - Request data export
 * GET /api/gdpr/export?requestId=xxx - Get export status/download
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { 
  createExportRequest, 
  processExportRequest, 
  getExportRequestStatus,
  exportUserData,
} from '@/lib/gdpr'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3 // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (entry.count >= RATE_LIMIT) {
    return false
  }
  
  entry.count++
  return true
}

/**
 * POST /api/gdpr/export
 * Request a data export
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to request data export' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'You can only request 3 exports per hour' },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { tenantId, immediate } = body

    // If immediate export requested (for authenticated user viewing their own data)
    if (immediate) {
      const exportData = await exportUserData(userId)
      
      // Log the export
      await prisma.auditLog.create({
        data: {
          userId,
          tenantId,
          action: 'GDPR_DATA_EXPORT_IMMEDIATE',
          resource: 'User',
          resourceId: userId,
          ipAddress: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent'),
        },
      })

      return NextResponse.json({
        success: true,
        data: exportData,
      })
    }

    // Create export request (requires email verification)
    const { requestId, verificationToken } = await createExportRequest(userId, tenantId)

    // In production: send verification email with link containing token
    // For now, return the token (in production, only send via email)
    
    // Log the request
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId,
        action: 'GDPR_DATA_EXPORT_REQUEST',
        resource: 'GdprRequest',
        resourceId: requestId,
        ipAddress: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Export request created. Check your email for verification link.',
      requestId,
      // Remove in production - only for testing
      _debug: process.env.NODE_ENV === 'development' ? { verificationToken } : undefined,
    })
  } catch (error) {
    console.error('GDPR Export Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process export request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/export?requestId=xxx
 * Get export status or download
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to check export status' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')
    const verificationToken = searchParams.get('token')
    const download = searchParams.get('download') === 'true'

    if (!requestId) {
      // Return all user's export requests
      const requests = await prisma.gdprRequest.findMany({
        where: {
          userId,
          type: 'DATA_EXPORT',
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          processedAt: true,
          exportExpiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      return NextResponse.json({ requests })
    }

    // Verify the request belongs to the user
    const gdprRequest = await prisma.gdprRequest.findFirst({
      where: {
        id: requestId,
        userId,
        type: 'DATA_EXPORT',
      },
    })

    if (!gdprRequest) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Export request not found' },
        { status: 404 }
      )
    }

    // If verification token provided, process the request
    if (verificationToken && gdprRequest.status === 'PENDING') {
      const result = await processExportRequest(requestId, verificationToken)
      
      if (!result.success) {
        return NextResponse.json(
          { error: 'Verification Failed', message: result.error },
          { status: 400 }
        )
      }

      // Return the export data
      return NextResponse.json({
        success: true,
        message: 'Export completed',
        data: result.exportData,
      })
    }

    // If download requested and export is ready
    if (download && gdprRequest.status === 'COMPLETED') {
      // Check if export has expired
      if (gdprRequest.exportExpiresAt && gdprRequest.exportExpiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Expired', message: 'Export link has expired. Please request a new export.' },
          { status: 410 }
        )
      }

      // Generate fresh export
      const exportData = await exportUserData(userId, { requestId })

      // Return as downloadable JSON
      const jsonString = JSON.stringify(exportData, null, 2)
      
      return new NextResponse(jsonString, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="data-export-${userId}-${Date.now()}.json"`,
        },
      })
    }

    // Return status
    const status = await getExportRequestStatus(requestId)
    
    return NextResponse.json({
      requestId,
      ...status,
    })
  } catch (error) {
    console.error('GDPR Export Status Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get export status' },
      { status: 500 }
    )
  }
}
