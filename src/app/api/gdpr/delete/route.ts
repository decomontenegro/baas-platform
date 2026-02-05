/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * GDPR/LGPD Data Deletion API
 * 
 * POST /api/gdpr/delete - Request account deletion
 * GET /api/gdpr/delete?requestId=xxx - Get deletion request status
 * DELETE /api/gdpr/delete?requestId=xxx - Cancel deletion request
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { 
  createDeletionRequest, 
  processDeletionRequest,
  cancelDeletionRequest,
} from '@/lib/gdpr'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Confirmation cooldown (prevent accidental rapid deletions)
const confirmationCooldown = new Map<string, number>()
const COOLDOWN_MS = 30 * 1000 // 30 seconds

/**
 * POST /api/gdpr/delete
 * Request account deletion (soft delete)
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to request account deletion' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      reason, 
      confirmEmail, 
      confirmPassword,
      verificationToken,
      requestId: existingRequestId,
    } = body

    // If verifying an existing request
    if (existingRequestId && verificationToken) {
      // Cooldown check
      const lastConfirm = confirmationCooldown.get(userId)
      if (lastConfirm && Date.now() - lastConfirm < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - (Date.now() - lastConfirm)) / 1000)
        return NextResponse.json(
          { error: 'Too Fast', message: `Please wait ${remainingSeconds} seconds before confirming` },
          { status: 429 }
        )
      }

      // Process the deletion
      const result = await processDeletionRequest(
        existingRequestId,
        verificationToken,
        userId
      )

      if (!result.success) {
        return NextResponse.json(
          { error: 'Verification Failed', message: result.errors?.join(', ') || 'Failed to verify request' },
          { status: 400 }
        )
      }

      confirmationCooldown.set(userId, Date.now())

      // Log the deletion execution
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'GDPR_DATA_DELETION_EXECUTED',
          resource: 'User',
          resourceId: userId,
          metadata: {
            requestId: existingRequestId,
            deletedRecords: result.deletedRecords,
          },
          ipAddress: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent'),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Account deletion initiated. Your data will be permanently removed after the retention period.',
        deletedRecords: result.deletedRecords,
        retentionInfo: {
          anonymizationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          hardDeleteDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        },
      })
    }

    // Verify email matches
    if (confirmEmail && confirmEmail !== session.user.email) {
      return NextResponse.json(
        { error: 'Verification Failed', message: 'Email does not match your account' },
        { status: 400 }
      )
    }

    // Check for pending deletion requests
    const pendingRequest = await prisma.gdprRequest.findFirst({
      where: {
        userId,
        type: 'DATA_DELETION',
        status: { in: ['PENDING', 'VERIFIED', 'PROCESSING'] },
      },
    })

    if (pendingRequest) {
      return NextResponse.json(
        { 
          error: 'Request Exists', 
          message: 'You already have a pending deletion request',
          requestId: pendingRequest.id,
          status: pendingRequest.status,
          createdAt: pendingRequest.createdAt,
        },
        { status: 409 }
      )
    }

    // Create new deletion request
    const { requestId, verificationToken: token } = await createDeletionRequest(userId, {
      reason,
      ipAddress: request.headers.get('x-forwarded-for') || request.ip || undefined,
    })

    // Log the request
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GDPR_DATA_DELETION_REQUEST',
        resource: 'GdprRequest',
        resourceId: requestId,
        metadata: { reason },
        ipAddress: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent'),
      },
    })

    // In production: send verification email
    // For development: return token

    return NextResponse.json({
      success: true,
      message: 'Deletion request created. Please verify to confirm.',
      requestId,
      requiresVerification: true,
      // Remove in production
      _debug: process.env.NODE_ENV === 'development' ? { verificationToken: token } : undefined,
    })
  } catch (error) {
    console.error('GDPR Delete Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process deletion request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/delete?requestId=xxx
 * Get deletion request status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      // Return all user's deletion requests
      const requests = await prisma.gdprRequest.findMany({
        where: {
          userId,
          type: 'DATA_DELETION',
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          processedAt: true,
          notes: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      return NextResponse.json({ requests })
    }

    // Get specific request
    const gdprRequest = await prisma.gdprRequest.findFirst({
      where: {
        id: requestId,
        userId,
        type: 'DATA_DELETION',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        processedAt: true,
        notes: true,
        metadata: true,
      },
    })

    if (!gdprRequest) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Deletion request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      request: gdprRequest,
      canCancel: ['PENDING', 'VERIFIED'].includes(gdprRequest.status),
    })
  } catch (error) {
    console.error('GDPR Delete Status Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gdpr/delete?requestId=xxx
 * Cancel a pending deletion request
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'requestId is required' },
        { status: 400 }
      )
    }

    const cancelled = await cancelDeletionRequest(requestId, userId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Deletion request not found or cannot be cancelled' },
        { status: 404 }
      )
    }

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GDPR_DATA_DELETION_CANCELLED',
        resource: 'GdprRequest',
        resourceId: requestId,
        ipAddress: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Deletion request cancelled',
    })
  } catch (error) {
    console.error('GDPR Delete Cancel Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
