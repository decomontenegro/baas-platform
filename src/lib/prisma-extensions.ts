/**
 * Prisma Extensions for LGPD/GDPR Compliance
 * 
 * Implements automatic soft delete for all models with deletedAt field.
 * Override de delete → update deletedAt
 * Override de findMany → where deletedAt: null (by default)
 */

import { Prisma, PrismaClient } from '@prisma/client'

// Models that support soft delete (have deletedAt field)
const SOFT_DELETE_MODELS = [
  'Tenant',
  'Workspace',
  'User',
  'Membership',
  'Account',
  'Session',
  'Channel',
  'Personality',
  'Specialist',
  'Feature',
  'Integration',
  'Webhook',
  'ApiKey',
  'UsageLog',
  'Subscription',
  'Invoice',
  'Credit',
] as const

type SoftDeleteModel = typeof SOFT_DELETE_MODELS[number]

// Check if model supports soft delete
function isSoftDeleteModel(model: string): model is SoftDeleteModel {
  return SOFT_DELETE_MODELS.includes(model as SoftDeleteModel)
}

// Context for tracking who performed the deletion
export interface SoftDeleteContext {
  userId?: string
  skipSoftDelete?: boolean  // For hard delete operations
  includeDeleted?: boolean  // For queries that need deleted records
}

// Extend Prisma with soft delete middleware
export function createSoftDeleteMiddleware(context: SoftDeleteContext = {}) {
  return async function softDeleteMiddleware(
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>
  ) {
    const { model, action, args } = params

    // Skip if model doesn't support soft delete
    if (!model || !isSoftDeleteModel(model)) {
      return next(params)
    }

    // Handle DELETE operations - convert to soft delete
    if (action === 'delete' && !context.skipSoftDelete) {
      params.action = 'update'
      params.args = {
        ...args,
        data: {
          deletedAt: new Date(),
          deletedBy: context.userId || null,
        },
      }
      return next(params)
    }

    // Handle DELETE MANY operations - convert to soft delete
    if (action === 'deleteMany' && !context.skipSoftDelete) {
      params.action = 'updateMany'
      params.args = {
        ...args,
        data: {
          deletedAt: new Date(),
          deletedBy: context.userId || null,
        },
      }
      return next(params)
    }

    // Handle FIND operations - exclude deleted records by default
    if (!context.includeDeleted) {
      if (action === 'findUnique' || action === 'findFirst') {
        // For findUnique/findFirst, we need to use findFirst with the additional filter
        if (action === 'findUnique') {
          params.action = 'findFirst'
        }
        params.args = {
          ...args,
          where: {
            ...args?.where,
            deletedAt: null,
          },
        }
        return next(params)
      }

      if (action === 'findMany') {
        params.args = {
          ...args,
          where: {
            ...args?.where,
            deletedAt: null,
          },
        }
        return next(params)
      }

      // Handle COUNT operations
      if (action === 'count') {
        params.args = {
          ...args,
          where: {
            ...args?.where,
            deletedAt: null,
          },
        }
        return next(params)
      }

      // Handle AGGREGATE operations
      if (action === 'aggregate') {
        params.args = {
          ...args,
          where: {
            ...args?.where,
            deletedAt: null,
          },
        }
        return next(params)
      }

      // Handle GROUP BY operations
      if (action === 'groupBy') {
        params.args = {
          ...args,
          where: {
            ...args?.where,
            deletedAt: null,
          },
        }
        return next(params)
      }
    }

    return next(params)
  }
}

// Extended Prisma Client with soft delete support
export function createPrismaClientWithSoftDelete(userId?: string) {
  const prisma = new PrismaClient()
  
  prisma.$use(createSoftDeleteMiddleware({ userId }))
  
  return prisma
}

// Extended client type with helper methods
export type ExtendedPrismaClient = PrismaClient & {
  $softDelete: <T extends { deletedAt?: Date | null }>(
    model: SoftDeleteModel,
    where: any,
    userId?: string
  ) => Promise<T>
  $hardDelete: <T>(model: SoftDeleteModel, where: any) => Promise<T>
  $findWithDeleted: <T>(model: SoftDeleteModel, args: any) => Promise<T[]>
  $restore: <T extends { deletedAt?: Date | null }>(
    model: SoftDeleteModel,
    where: any
  ) => Promise<T>
}

// Create extended client with helper methods
export function createExtendedPrismaClient(): ExtendedPrismaClient {
  const prisma = new PrismaClient() as ExtendedPrismaClient

  // Soft delete method
  prisma.$softDelete = async function <T extends { deletedAt?: Date | null }>(
    model: SoftDeleteModel,
    where: any,
    userId?: string
  ): Promise<T> {
    const modelClient = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
    return modelClient.update({
      where,
      data: {
        deletedAt: new Date(),
        deletedBy: userId || null,
      },
    })
  }

  // Hard delete method (use with caution!)
  prisma.$hardDelete = async function <T>(
    model: SoftDeleteModel,
    where: any
  ): Promise<T> {
    const modelClient = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
    // Direct delete without middleware
    return modelClient.delete({ where })
  }

  // Find including deleted records
  prisma.$findWithDeleted = async function <T>(
    model: SoftDeleteModel,
    args: any
  ): Promise<T[]> {
    const modelClient = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
    // Don't add deletedAt filter
    return modelClient.findMany(args)
  }

  // Restore soft-deleted record
  prisma.$restore = async function <T extends { deletedAt?: Date | null }>(
    model: SoftDeleteModel,
    where: any
  ): Promise<T> {
    const modelClient = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
    return modelClient.update({
      where,
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    })
  }

  return prisma
}

// Helper to create audit log for deletion
export async function logDeletion(
  prisma: PrismaClient,
  params: {
    userId?: string
    tenantId?: string
    resource: string
    resourceId: string
    oldData?: any
    ipAddress?: string
    userAgent?: string
  }
) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      tenantId: params.tenantId,
      action: 'SOFT_DELETE',
      resource: params.resource,
      resourceId: params.resourceId,
      oldData: params.oldData,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        deletedAt: new Date().toISOString(),
        deletedBy: params.userId,
      },
    },
  })
}

// Utility to check if record is deleted
export function isDeleted(record: { deletedAt?: Date | null }): boolean {
  return record.deletedAt !== null && record.deletedAt !== undefined
}

// Utility to get records due for hard delete (past retention period)
export async function getRecordsDueForHardDelete(
  prisma: PrismaClient,
  model: SoftDeleteModel,
  retentionDays: number = 365
): Promise<any[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const modelClient = (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)]
  
  return modelClient.findMany({
    where: {
      deletedAt: {
        not: null,
        lt: cutoffDate,
      },
    },
  })
}

// Export default extended client
export const prismaWithSoftDelete = createExtendedPrismaClient()
