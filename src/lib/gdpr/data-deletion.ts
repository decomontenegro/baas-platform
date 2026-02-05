/**
 * LGPD/GDPR Data Deletion Module
 * 
 * Implementa soft delete, anonimização e exclusão permanente de dados.
 * Atende ao direito de exclusão (LGPD Art. 18, GDPR Art. 17).
 */

import { PrismaClient, GdprRequestType, GdprRequestStatus, User } from '@prisma/client'
import { randomBytes, createHash } from 'crypto'
import { logDeletion } from '../prisma-extensions'

const prisma = new PrismaClient()

export interface DeletionResult {
  success: boolean
  requestId?: string
  deletedRecords: {
    model: string
    count: number
  }[]
  errors?: string[]
}

export interface AnonymizationResult {
  success: boolean
  anonymizedRecords: {
    model: string
    count: number
  }[]
  errors?: string[]
}

/**
 * Create a deletion request (requires verification)
 */
export async function createDeletionRequest(
  userId: string,
  options: {
    tenantId?: string
    reason?: string
    ipAddress?: string
  } = {}
): Promise<{ requestId: string; verificationToken: string }> {
  const verificationToken = randomBytes(32).toString('hex')

  const request = await prisma.gdprRequest.create({
    data: {
      userId,
      tenantId: options.tenantId,
      type: GdprRequestType.DATA_DELETION,
      status: GdprRequestStatus.PENDING,
      verificationToken,
      metadata: {
        reason: options.reason,
        requestedAt: new Date().toISOString(),
        ipAddress: options.ipAddress,
      },
    },
  })

  // Log the deletion request in audit log
  await prisma.auditLog.create({
    data: {
      userId,
      tenantId: options.tenantId,
      action: 'GDPR_DELETION_REQUEST',
      resource: 'User',
      resourceId: userId,
      metadata: {
        requestId: request.id,
        requestedAt: new Date().toISOString(),
      },
      ipAddress: options.ipAddress,
    },
  })

  return {
    requestId: request.id,
    verificationToken,
  }
}

/**
 * Verify and process a deletion request
 */
export async function processDeletionRequest(
  requestId: string,
  verificationToken: string,
  processedBy?: string
): Promise<DeletionResult> {
  const request = await prisma.gdprRequest.findFirst({
    where: {
      id: requestId,
      verificationToken,
      type: GdprRequestType.DATA_DELETION,
    },
    include: {
      user: true,
    },
  })

  if (!request) {
    return { success: false, deletedRecords: [], errors: ['Invalid request or verification token'] }
  }

  if (request.status === GdprRequestStatus.COMPLETED) {
    return { success: false, deletedRecords: [], errors: ['Request already processed'] }
  }

  if (request.status === GdprRequestStatus.EXPIRED) {
    return { success: false, deletedRecords: [], errors: ['Request has expired'] }
  }

  // Update status to processing
  await prisma.gdprRequest.update({
    where: { id: requestId },
    data: {
      status: GdprRequestStatus.PROCESSING,
      verifiedAt: new Date(),
    },
  })

  try {
    const result = await softDeleteUserData(request.userId, {
      deletedBy: processedBy || request.userId,
      requestId,
    })

    // Update request with completion info
    await prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: GdprRequestStatus.COMPLETED,
        processedAt: new Date(),
        processedBy,
        metadata: {
          ...(request.metadata as object || {}),
          deletedRecords: result.deletedRecords,
        },
      },
    })

    return result
  } catch (error) {
    await prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: GdprRequestStatus.FAILED,
        notes: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return { success: false, deletedRecords: [], errors: ['Failed to process deletion request'] }
  }
}

/**
 * Soft delete all user data
 */
export async function softDeleteUserData(
  userId: string,
  options: {
    deletedBy: string
    requestId?: string
  }
): Promise<DeletionResult> {
  const { deletedBy, requestId } = options
  const now = new Date()
  const deletedRecords: { model: string; count: number }[] = []
  const errors: string[] = []

  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      // 1. Soft delete Sessions
      const sessions = await tx.session.updateMany({
        where: { userId },
        data: { deletedAt: now, deletedBy },
      })
      deletedRecords.push({ model: 'Session', count: sessions.count })

      // 2. Soft delete Accounts
      const accounts = await tx.account.updateMany({
        where: { userId },
        data: { deletedAt: now, deletedBy },
      })
      deletedRecords.push({ model: 'Account', count: accounts.count })

      // 3. Soft delete Memberships
      const memberships = await tx.membership.updateMany({
        where: { userId },
        data: { deletedAt: now, deletedBy },
      })
      deletedRecords.push({ model: 'Membership', count: memberships.count })

      // 4. Soft delete User (but keep for audit)
      await tx.user.update({
        where: { id: userId },
        data: { 
          deletedAt: now, 
          deletedBy,
          // Don't anonymize yet - wait for retention period
        },
      })
      deletedRecords.push({ model: 'User', count: 1 })

      // 5. Log the deletion
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SOFT_DELETE_USER_DATA',
          resource: 'User',
          resourceId: userId,
          metadata: {
            requestId,
            deletedBy,
            deletedAt: now.toISOString(),
            deletedRecords,
          },
        },
      })
    })

    return { success: true, deletedRecords, requestId }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return { success: false, deletedRecords, errors }
  }
}

/**
 * Anonymize user data (after retention period)
 */
export async function anonymizeUser(userId: string): Promise<AnonymizationResult> {
  const anonymizedRecords: { model: string; count: number }[] = []
  const errors: string[] = []

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return { success: false, anonymizedRecords, errors: ['User not found'] }
    }

    if (user.isAnonymized) {
      return { success: false, anonymizedRecords, errors: ['User already anonymized'] }
    }

    // Generate anonymous values
    const anonymousHash = createHash('sha256').update(userId + Date.now()).digest('hex').slice(0, 12)
    const anonymousEmail = `deleted_${anonymousHash}@anonymized.local`
    const anonymousName = `Deleted User ${anonymousHash}`

    await prisma.$transaction(async (tx) => {
      // 1. Anonymize user profile
      await tx.user.update({
        where: { id: userId },
        data: {
          name: anonymousName,
          email: anonymousEmail,
          image: null,
          isAnonymized: true,
          anonymizedAt: new Date(),
        },
      })
      anonymizedRecords.push({ model: 'User', count: 1 })

      // 2. Remove all accounts (hard delete - no PII to keep)
      const accounts = await tx.account.deleteMany({
        where: { userId },
      })
      anonymizedRecords.push({ model: 'Account', count: accounts.count })

      // 3. Remove all sessions (hard delete)
      const sessions = await tx.session.deleteMany({
        where: { userId },
      })
      anonymizedRecords.push({ model: 'Session', count: sessions.count })

      // 4. Update audit logs to reference anonymous user (keep for compliance)
      // Audit logs are kept but user reference will show anonymized data

      // 5. Log the anonymization
      await tx.auditLog.create({
        data: {
          userId, // Still linked to user ID for traceability
          action: 'ANONYMIZE_USER',
          resource: 'User',
          resourceId: userId,
          metadata: {
            anonymizedAt: new Date().toISOString(),
            anonymousEmail,
            anonymousName,
          },
        },
      })
    })

    return { success: true, anonymizedRecords }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return { success: false, anonymizedRecords, errors }
  }
}

/**
 * Hard delete user data (use with extreme caution - only after anonymization)
 */
export async function hardDeleteUser(
  userId: string,
  options: {
    force?: boolean // Skip anonymization check
  } = {}
): Promise<DeletionResult> {
  const deletedRecords: { model: string; count: number }[] = []
  const errors: string[] = []

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return { success: false, deletedRecords, errors: ['User not found'] }
    }

    // Safety check: only allow hard delete of anonymized users (unless forced)
    if (!options.force && !user.isAnonymized) {
      return { 
        success: false, 
        deletedRecords, 
        errors: ['User must be anonymized before hard delete. Use force=true to override.'] 
      }
    }

    await prisma.$transaction(async (tx) => {
      // Delete in order of dependencies

      // 1. Delete accounts
      const accounts = await tx.account.deleteMany({ where: { userId } })
      deletedRecords.push({ model: 'Account', count: accounts.count })

      // 2. Delete sessions
      const sessions = await tx.session.deleteMany({ where: { userId } })
      deletedRecords.push({ model: 'Session', count: sessions.count })

      // 3. Delete memberships
      const memberships = await tx.membership.deleteMany({ where: { userId } })
      deletedRecords.push({ model: 'Membership', count: memberships.count })

      // 4. Delete GDPR requests
      const gdprRequests = await tx.gdprRequest.deleteMany({ where: { userId } })
      deletedRecords.push({ model: 'GdprRequest', count: gdprRequests.count })

      // 5. Nullify audit log references (keep logs for compliance)
      const auditLogs = await tx.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      })
      deletedRecords.push({ model: 'AuditLog (nullified)', count: auditLogs.count })

      // 6. Finally, delete user
      await tx.user.delete({ where: { id: userId } })
      deletedRecords.push({ model: 'User', count: 1 })
    })

    return { success: true, deletedRecords }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return { success: false, deletedRecords, errors }
  }
}

/**
 * Get users eligible for anonymization (soft deleted + past retention)
 */
export async function getUsersForAnonymization(
  retentionDays: number = 30
): Promise<User[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  return prisma.user.findMany({
    where: {
      deletedAt: {
        not: null,
        lt: cutoffDate,
      },
      isAnonymized: false,
    },
  })
}

/**
 * Get users eligible for hard delete (anonymized + past additional retention)
 */
export async function getUsersForHardDelete(
  additionalRetentionDays: number = 365
): Promise<User[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - additionalRetentionDays)

  return prisma.user.findMany({
    where: {
      isAnonymized: true,
      anonymizedAt: {
        lt: cutoffDate,
      },
    },
  })
}

/**
 * Cancel a pending deletion request
 */
export async function cancelDeletionRequest(
  requestId: string,
  userId: string
): Promise<boolean> {
  const request = await prisma.gdprRequest.findFirst({
    where: {
      id: requestId,
      userId,
      type: GdprRequestType.DATA_DELETION,
      status: {
        in: [GdprRequestStatus.PENDING, GdprRequestStatus.VERIFIED],
      },
    },
  })

  if (!request) {
    return false
  }

  await prisma.gdprRequest.update({
    where: { id: requestId },
    data: {
      status: GdprRequestStatus.CANCELLED,
      notes: 'Cancelled by user',
    },
  })

  return true
}

/**
 * Restore soft-deleted user (if within retention period and not anonymized)
 */
export async function restoreUser(
  userId: string,
  restoredBy: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { success: false, error: 'User not found' }
  }

  if (!user.deletedAt) {
    return { success: false, error: 'User is not deleted' }
  }

  if (user.isAnonymized) {
    return { success: false, error: 'Cannot restore anonymized user' }
  }

  await prisma.$transaction(async (tx) => {
    // Restore user
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    })

    // Restore related records
    await tx.account.updateMany({
      where: { userId },
      data: { deletedAt: null, deletedBy: null },
    })

    await tx.session.updateMany({
      where: { userId },
      data: { deletedAt: null, deletedBy: null },
    })

    await tx.membership.updateMany({
      where: { userId },
      data: { deletedAt: null, deletedBy: null },
    })

    // Log restoration
    await tx.auditLog.create({
      data: {
        userId,
        action: 'RESTORE_USER',
        resource: 'User',
        resourceId: userId,
        metadata: {
          restoredAt: new Date().toISOString(),
          restoredBy,
        },
      },
    })
  })

  return { success: true }
}
