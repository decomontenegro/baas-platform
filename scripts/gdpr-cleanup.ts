#!/usr/bin/env npx ts-node

/**
 * GDPR/LGPD Cleanup Script
 * 
 * Cron job para:
 * 1. Expirar requests não verificados
 * 2. Anonimizar usuários após período de retenção
 * 3. Hard delete de dados anonimizados após período adicional
 * 4. Limpar exports expirados
 * 
 * Uso:
 *   npx ts-node scripts/gdpr-cleanup.ts
 * 
 * Crontab (executar diariamente às 3h):
 *   0 3 * * * cd /path/to/baas-app && npx ts-node scripts/gdpr-cleanup.ts >> /var/log/gdpr-cleanup.log 2>&1
 */

import { PrismaClient, GdprRequestStatus } from '@prisma/client'
import {
  getUsersForAnonymization,
  getUsersForHardDelete,
  anonymizeUser,
  hardDeleteUser,
  cleanupExpiredExports,
  GDPR_CONSTANTS,
} from '../src/lib/gdpr'

const prisma = new PrismaClient()

interface CleanupStats {
  expiredRequests: number
  anonymizedUsers: number
  hardDeletedUsers: number
  cleanedExports: number
  errors: string[]
}

async function runCleanup(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    expiredRequests: 0,
    anonymizedUsers: 0,
    hardDeletedUsers: 0,
    cleanedExports: 0,
    errors: [],
  }

  console.log('='.repeat(60))
  console.log(`GDPR Cleanup Started: ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  try {
    // 1. Expire unverified requests (older than 7 days)
    console.log('\n[1/4] Expiring unverified requests...')
    const expirationCutoff = new Date()
    expirationCutoff.setDate(expirationCutoff.getDate() - GDPR_CONSTANTS.REQUEST_VERIFICATION_EXPIRY)

    const expiredResult = await prisma.gdprRequest.updateMany({
      where: {
        status: GdprRequestStatus.PENDING,
        verifiedAt: null,
        createdAt: {
          lt: expirationCutoff,
        },
      },
      data: {
        status: GdprRequestStatus.EXPIRED,
        notes: 'Expired: not verified within required timeframe',
      },
    })
    stats.expiredRequests = expiredResult.count
    console.log(`   Expired ${stats.expiredRequests} unverified requests`)

    // 2. Anonymize users past soft delete retention
    console.log('\n[2/4] Anonymizing users past retention period...')
    const usersToAnonymize = await getUsersForAnonymization(GDPR_CONSTANTS.SOFT_DELETE_RETENTION)
    console.log(`   Found ${usersToAnonymize.length} users to anonymize`)

    for (const user of usersToAnonymize) {
      try {
        const result = await anonymizeUser(user.id)
        if (result.success) {
          stats.anonymizedUsers++
          console.log(`   ✓ Anonymized user ${user.id}`)
        } else {
          stats.errors.push(`Failed to anonymize ${user.id}: ${result.errors?.join(', ')}`)
          console.log(`   ✗ Failed to anonymize user ${user.id}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Error anonymizing ${user.id}: ${message}`)
        console.log(`   ✗ Error anonymizing user ${user.id}: ${message}`)
      }
    }

    // 3. Hard delete anonymized users past additional retention
    console.log('\n[3/4] Hard deleting anonymized users past retention...')
    const usersToDelete = await getUsersForHardDelete(GDPR_CONSTANTS.ANONYMIZED_RETENTION)
    console.log(`   Found ${usersToDelete.length} users to hard delete`)

    for (const user of usersToDelete) {
      try {
        const result = await hardDeleteUser(user.id)
        if (result.success) {
          stats.hardDeletedUsers++
          console.log(`   ✓ Hard deleted user ${user.id}`)
        } else {
          stats.errors.push(`Failed to hard delete ${user.id}: ${result.errors?.join(', ')}`)
          console.log(`   ✗ Failed to hard delete user ${user.id}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push(`Error hard deleting ${user.id}: ${message}`)
        console.log(`   ✗ Error hard deleting user ${user.id}: ${message}`)
      }
    }

    // 4. Clean up expired exports
    console.log('\n[4/4] Cleaning up expired exports...')
    stats.cleanedExports = await cleanupExpiredExports()
    console.log(`   Cleaned ${stats.cleanedExports} expired exports`)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    stats.errors.push(`Fatal error: ${message}`)
    console.error(`Fatal error: ${message}`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('GDPR Cleanup Summary')
  console.log('='.repeat(60))
  console.log(`Expired Requests:    ${stats.expiredRequests}`)
  console.log(`Anonymized Users:    ${stats.anonymizedUsers}`)
  console.log(`Hard Deleted Users:  ${stats.hardDeletedUsers}`)
  console.log(`Cleaned Exports:     ${stats.cleanedExports}`)
  console.log(`Errors:              ${stats.errors.length}`)
  
  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    stats.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`))
  }
  
  console.log(`\nCompleted: ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  return stats
}

// Log cleanup to audit table
async function logCleanupRun(stats: CleanupStats): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: 'GDPR_CLEANUP_RUN',
      resource: 'System',
      metadata: {
        ...stats,
        runAt: new Date().toISOString(),
      },
    },
  })
}

// Main execution
async function main() {
  try {
    const stats = await runCleanup()
    await logCleanupRun(stats)
    
    // Exit with error code if there were errors
    if (stats.errors.length > 0) {
      process.exit(1)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Fatal error running GDPR cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
