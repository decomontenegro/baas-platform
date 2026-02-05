/**
 * LGPD/GDPR Data Export Module
 * 
 * Exporta todos os dados de um usuário em formato JSON estruturado.
 * Atende ao direito de acesso e portabilidade de dados (LGPD Art. 18, GDPR Art. 15 e 20).
 */

import { PrismaClient, User, GdprRequestType, GdprRequestStatus } from '@prisma/client'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

export interface UserDataExport {
  exportedAt: string
  exportVersion: string
  user: {
    profile: UserProfile
    accounts: AccountData[]
    sessions: SessionData[]
    memberships: MembershipData[]
    auditLogs: AuditLogData[]
    gdprRequests: GdprRequestData[]
  }
  tenants: TenantData[]
  metadata: ExportMetadata
}

interface UserProfile {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  image: string | null
  role: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

interface AccountData {
  id: string
  type: string
  provider: string
  createdAt?: Date
}

interface SessionData {
  id: string
  expires: Date
}

interface MembershipData {
  tenantId: string
  tenantName: string
  role: string
  status: string
  createdAt: Date
}

interface AuditLogData {
  id: string
  action: string
  resource: string
  resourceId: string | null
  createdAt: Date
  ipAddress: string | null
}

interface GdprRequestData {
  id: string
  type: string
  status: string
  createdAt: Date
  processedAt: Date | null
}

interface TenantData {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: Date
  workspaces: WorkspaceData[]
}

interface WorkspaceData {
  id: string
  name: string
  slug: string
  createdAt: Date
  channels: ChannelData[]
  personalities: PersonalityData[]
  features: FeatureData[]
}

interface ChannelData {
  id: string
  name: string
  type: string
  status: string
  createdAt: Date
}

interface PersonalityData {
  id: string
  name: string
  language: string
  model: string
  createdAt: Date
}

interface FeatureData {
  id: string
  name: string
  type: string
  isActive: boolean
}

interface ExportMetadata {
  requestId: string
  requestedAt: string
  userId: string
  includesDeletedData: boolean
  dataCategories: string[]
  legalBasis: string
}

/**
 * Export all user data in a structured JSON format
 */
export async function exportUserData(
  userId: string,
  options: {
    includeDeleted?: boolean
    requestId?: string
  } = {}
): Promise<UserDataExport> {
  const { includeDeleted = false, requestId } = options

  // Fetch user with all related data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      sessions: true,
      memberships: {
        include: {
          tenant: {
            include: {
              workspaces: {
                include: {
                  channels: true,
                  personalities: true,
                  features: true,
                },
              },
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1000, // Limit to last 1000 audit logs
      },
      gdprRequests: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Build export structure
  const dataExport: UserDataExport = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0.0',
    user: {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      accounts: user.accounts.map(account => ({
        id: account.id,
        type: account.type,
        provider: account.provider,
      })),
      sessions: user.sessions.map(session => ({
        id: session.id,
        expires: session.expires,
      })),
      memberships: user.memberships.map(membership => ({
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        role: membership.role,
        status: membership.status,
        createdAt: membership.createdAt,
      })),
      auditLogs: user.auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        createdAt: log.createdAt,
        ipAddress: log.ipAddress,
      })),
      gdprRequests: user.gdprRequests.map(request => ({
        id: request.id,
        type: request.type,
        status: request.status,
        createdAt: request.createdAt,
        processedAt: request.processedAt,
      })),
    },
    tenants: user.memberships.map(membership => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      plan: membership.tenant.plan,
      createdAt: membership.tenant.createdAt,
      workspaces: membership.tenant.workspaces.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
        channels: workspace.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          status: channel.status,
          createdAt: channel.createdAt,
        })),
        personalities: workspace.personalities.map(personality => ({
          id: personality.id,
          name: personality.name,
          language: personality.language,
          model: personality.model,
          createdAt: personality.createdAt,
        })),
        features: workspace.features.map(feature => ({
          id: feature.id,
          name: feature.name,
          type: feature.type,
          isActive: feature.isActive,
        })),
      })),
    })),
    metadata: {
      requestId: requestId || `export_${randomBytes(16).toString('hex')}`,
      requestedAt: new Date().toISOString(),
      userId,
      includesDeletedData: includeDeleted,
      dataCategories: [
        'profile',
        'accounts',
        'sessions',
        'memberships',
        'audit_logs',
        'gdpr_requests',
        'tenants',
        'workspaces',
        'channels',
        'personalities',
        'features',
      ],
      legalBasis: 'LGPD Art. 18 - Direito de acesso / GDPR Art. 15 - Right of access',
    },
  }

  return dataExport
}

/**
 * Create a GDPR export request
 */
export async function createExportRequest(
  userId: string,
  tenantId?: string
): Promise<{ requestId: string; verificationToken: string }> {
  const verificationToken = randomBytes(32).toString('hex')

  const request = await prisma.gdprRequest.create({
    data: {
      userId,
      tenantId,
      type: GdprRequestType.DATA_EXPORT,
      status: GdprRequestStatus.PENDING,
      verificationToken,
      metadata: {
        requestedAt: new Date().toISOString(),
        ipAddress: null, // Should be set from request context
      },
    },
  })

  return {
    requestId: request.id,
    verificationToken,
  }
}

/**
 * Verify and process an export request
 */
export async function processExportRequest(
  requestId: string,
  verificationToken: string
): Promise<{ success: boolean; exportData?: UserDataExport; error?: string }> {
  const request = await prisma.gdprRequest.findFirst({
    where: {
      id: requestId,
      verificationToken,
      type: GdprRequestType.DATA_EXPORT,
    },
  })

  if (!request) {
    return { success: false, error: 'Invalid request or verification token' }
  }

  if (request.status === GdprRequestStatus.COMPLETED) {
    return { success: false, error: 'Request already processed' }
  }

  if (request.status === GdprRequestStatus.EXPIRED) {
    return { success: false, error: 'Request has expired' }
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
    // Export the data
    const exportData = await exportUserData(request.userId, { requestId })

    // Generate export URL (in production, upload to secure storage)
    const exportUrl = `/api/gdpr/export/${requestId}/download`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Update request with completion info
    await prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: GdprRequestStatus.COMPLETED,
        processedAt: new Date(),
        exportUrl,
        exportExpiresAt: expiresAt,
      },
    })

    return { success: true, exportData }
  } catch (error) {
    await prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: GdprRequestStatus.FAILED,
        notes: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return { success: false, error: 'Failed to process export request' }
  }
}

/**
 * Get export request status
 */
export async function getExportRequestStatus(requestId: string): Promise<{
  status: GdprRequestStatus
  exportUrl?: string | null
  exportExpiresAt?: Date | null
  createdAt: Date
  processedAt?: Date | null
} | null> {
  const request = await prisma.gdprRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      exportUrl: true,
      exportExpiresAt: true,
      createdAt: true,
      processedAt: true,
    },
  })

  return request
}

/**
 * Clean up expired export files
 */
export async function cleanupExpiredExports(): Promise<number> {
  const now = new Date()

  const expiredRequests = await prisma.gdprRequest.findMany({
    where: {
      type: GdprRequestType.DATA_EXPORT,
      exportExpiresAt: {
        lt: now,
      },
      exportUrl: {
        not: null,
      },
    },
  })

  // In production: delete files from storage here

  // Clear URLs from expired requests
  await prisma.gdprRequest.updateMany({
    where: {
      id: {
        in: expiredRequests.map(r => r.id),
      },
    },
    data: {
      exportUrl: null,
    },
  })

  return expiredRequests.length
}
