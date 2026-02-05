/**
 * Credential Pool Module
 * 
 * Manages OAuth tokens and API keys across tenants
 * Provides intelligent selection based on quota/credits remaining
 * Supports emergency fallback activation
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// Types
// ============================================================================

export type CredentialType = 'oauth' | 'api_key'
export type CredentialStatus = 'active' | 'exhausted' | 'expired' | 'revoked' | 'emergency'
export type CredentialProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom'

export interface Credential {
  id: string
  tenantId: string
  type: CredentialType
  provider: CredentialProvider
  name: string
  
  // Status & Health
  status: CredentialStatus
  isEmergency: boolean
  priority: number // Lower = higher priority
  
  // Usage tracking
  quotaLimit: number | null // null = unlimited
  quotaUsed: number
  quotaResetAt: Date | null
  
  // For selection algorithm
  creditsRemaining: number | null // Calculated: quotaLimit - quotaUsed
  usagePercentage: number // 0-100
  
  // Metadata
  lastUsedAt: Date | null
  lastErrorAt: Date | null
  lastError: string | null
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
}

export interface CredentialPoolStats {
  total: number
  active: number
  exhausted: number
  expired: number
  emergency: number
  totalCreditsRemaining: number | null
  averageUsagePercentage: number
}

export interface EmergencyActivationResult {
  success: boolean
  credential: Credential | null
  message: string
  previousActiveCount: number
}

// ============================================================================
// In-Memory Cache (for credential metadata not in DB)
// ============================================================================

interface CredentialCache {
  [credentialId: string]: {
    quotaUsed: number
    lastUsedAt: Date | null
    lastErrorAt: Date | null
    lastError: string | null
    status: CredentialStatus
  }
}

const credentialCache: CredentialCache = {}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get all credentials in the pool for a tenant
 */
export async function getCredentialPool(tenantId: string): Promise<Credential[]> {
  // Get API keys from database
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Transform to Credential format
  const credentials: Credential[] = apiKeys.map((key, index) => {
    const cached = credentialCache[key.id] || {
      quotaUsed: 0,
      lastUsedAt: key.lastUsedAt,
      lastErrorAt: null,
      lastError: null,
      status: 'active' as CredentialStatus
    }
    
    const quotaLimit = key.rateLimit || null
    const quotaUsed = cached.quotaUsed
    const creditsRemaining = quotaLimit ? Math.max(0, quotaLimit - quotaUsed) : null
    const usagePercentage = quotaLimit ? (quotaUsed / quotaLimit) * 100 : 0
    
    // Determine status
    let status: CredentialStatus = cached.status
    if (key.expiresAt && key.expiresAt < new Date()) {
      status = 'expired'
    } else if (creditsRemaining !== null && creditsRemaining <= 0) {
      status = 'exhausted'
    }
    
    // Check if this is an emergency key (by naming convention)
    const isEmergency = key.name.toLowerCase().includes('emergency') || 
                        key.name.toLowerCase().includes('fallback') ||
                        key.name.toLowerCase().includes('backup')
    
    return {
      id: key.id,
      tenantId: key.tenantId,
      type: 'api_key' as CredentialType,
      provider: detectProvider(key.keyPrefix),
      name: key.name,
      status,
      isEmergency,
      priority: isEmergency ? 999 : index, // Emergency keys have lowest priority
      quotaLimit,
      quotaUsed,
      quotaResetAt: null, // Would need additional tracking
      creditsRemaining,
      usagePercentage,
      lastUsedAt: cached.lastUsedAt,
      lastErrorAt: cached.lastErrorAt,
      lastError: cached.lastError,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      expiresAt: key.expiresAt
    }
  })
  
  // Also check for OAuth tokens in Account model (for integrations)
  const accounts = await prisma.account.findMany({
    where: {
      user: {
        memberships: {
          some: {
            tenant: { id: tenantId }
          }
        }
      },
      access_token: { not: null }
    }
  })
  
  // Add OAuth credentials
  for (const account of accounts) {
    const id = `oauth_${account.id}`
    const cached = credentialCache[id] || {
      quotaUsed: 0,
      lastUsedAt: null,
      lastErrorAt: null,
      lastError: null,
      status: 'active' as CredentialStatus
    }
    
    credentials.push({
      id,
      tenantId,
      type: 'oauth',
      provider: account.provider as CredentialProvider,
      name: `OAuth: ${account.provider}`,
      status: cached.status,
      isEmergency: false,
      priority: 100, // OAuth tokens get medium priority
      quotaLimit: null,
      quotaUsed: cached.quotaUsed,
      quotaResetAt: null,
      creditsRemaining: null,
      usagePercentage: 0,
      lastUsedAt: cached.lastUsedAt,
      lastErrorAt: cached.lastErrorAt,
      lastError: cached.lastError,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null
    })
  }
  
  // Sort by priority (lower = better)
  return credentials.sort((a, b) => a.priority - b.priority)
}

/**
 * Select the best credential based on available credits
 * Strategy: Pick active credential with most remaining credits
 */
export async function selectBestCredential(
  tenantId: string,
  options?: {
    provider?: CredentialProvider
    excludeEmergency?: boolean
    excludeIds?: string[]
  }
): Promise<Credential | null> {
  const pool = await getCredentialPool(tenantId)
  
  // Filter candidates
  let candidates = pool.filter(cred => {
    // Must be active
    if (cred.status !== 'active') return false
    
    // Filter by provider if specified
    if (options?.provider && cred.provider !== options.provider) return false
    
    // Exclude emergency keys unless explicitly needed
    if (options?.excludeEmergency !== false && cred.isEmergency) return false
    
    // Exclude specific IDs
    if (options?.excludeIds?.includes(cred.id)) return false
    
    return true
  })
  
  if (candidates.length === 0) {
    // No regular credentials available, try emergency if allowed
    if (options?.excludeEmergency === false) {
      return null
    }
    
    // Auto-fallback to emergency
    const emergencyResult = await activateEmergencyKey(tenantId, options?.provider)
    return emergencyResult.credential
  }
  
  // Sort by best option:
  // 1. Most credits remaining (if quota exists)
  // 2. Lowest usage percentage
  // 3. Most recently successful (no recent errors)
  // 4. Priority
  candidates.sort((a, b) => {
    // Prefer credentials with known quota and more remaining
    if (a.creditsRemaining !== null && b.creditsRemaining !== null) {
      if (a.creditsRemaining !== b.creditsRemaining) {
        return b.creditsRemaining - a.creditsRemaining // Higher remaining first
      }
    }
    
    // Prefer lower usage percentage
    if (a.usagePercentage !== b.usagePercentage) {
      return a.usagePercentage - b.usagePercentage
    }
    
    // Prefer credentials without recent errors
    if (a.lastErrorAt && !b.lastErrorAt) return 1
    if (!a.lastErrorAt && b.lastErrorAt) return -1
    
    // Finally, use priority
    return a.priority - b.priority
  })
  
  return candidates[0] || null
}

/**
 * Update credential usage after an API call
 */
export async function updateCredentialUsage(
  credentialId: string,
  tokensUsed: number,
  options?: {
    success?: boolean
    error?: string
  }
): Promise<void> {
  const now = new Date()
  
  // Initialize cache entry if needed
  if (!credentialCache[credentialId]) {
    credentialCache[credentialId] = {
      quotaUsed: 0,
      lastUsedAt: null,
      lastErrorAt: null,
      lastError: null,
      status: 'active'
    }
  }
  
  const cache = credentialCache[credentialId]
  
  // Update usage
  cache.quotaUsed += tokensUsed
  cache.lastUsedAt = now
  
  // Track errors
  if (options?.success === false) {
    cache.lastErrorAt = now
    cache.lastError = options.error || 'Unknown error'
    
    // Check for exhaustion signals
    if (options.error?.includes('quota') || 
        options.error?.includes('rate limit') ||
        options.error?.includes('429')) {
      cache.status = 'exhausted'
    } else if (options.error?.includes('invalid') ||
               options.error?.includes('revoked') ||
               options.error?.includes('401')) {
      cache.status = 'revoked'
    }
  }
  
  // Update lastUsedAt in database for API keys
  if (!credentialId.startsWith('oauth_')) {
    await prisma.apiKey.update({
      where: { id: credentialId },
      data: { lastUsedAt: now }
    }).catch(() => {
      // Key might not exist or be deleted
    })
  }
}

/**
 * Activate an emergency/fallback API key
 * Used when all regular credentials are exhausted
 */
export async function activateEmergencyKey(
  tenantId: string,
  provider?: CredentialProvider
): Promise<EmergencyActivationResult> {
  const pool = await getCredentialPool(tenantId)
  
  // Count currently active (non-emergency)
  const previousActiveCount = pool.filter(c => 
    c.status === 'active' && !c.isEmergency
  ).length
  
  // Find available emergency keys
  let emergencyKeys = pool.filter(c => 
    c.isEmergency && 
    c.status !== 'expired' && 
    c.status !== 'revoked'
  )
  
  // Filter by provider if specified
  if (provider) {
    emergencyKeys = emergencyKeys.filter(c => c.provider === provider)
  }
  
  if (emergencyKeys.length === 0) {
    // Log the emergency activation attempt
    await logEmergencyActivation(tenantId, null, false, 'No emergency keys available')
    
    return {
      success: false,
      credential: null,
      message: 'Nenhuma chave de emergência disponível. Configure uma API key com "emergency" ou "fallback" no nome.',
      previousActiveCount
    }
  }
  
  // Pick the best emergency key (least used)
  const bestEmergency = emergencyKeys.sort((a, b) => 
    a.usagePercentage - b.usagePercentage
  )[0]
  
  // Activate it by updating cache status
  if (credentialCache[bestEmergency.id]) {
    credentialCache[bestEmergency.id].status = 'active'
  } else {
    credentialCache[bestEmergency.id] = {
      quotaUsed: bestEmergency.quotaUsed,
      lastUsedAt: bestEmergency.lastUsedAt,
      lastErrorAt: null,
      lastError: null,
      status: 'active'
    }
  }
  
  // Update the credential object
  bestEmergency.status = 'active'
  
  // Log the activation
  await logEmergencyActivation(tenantId, bestEmergency.id, true, 
    `Emergency key activated: ${bestEmergency.name}`)
  
  return {
    success: true,
    credential: bestEmergency,
    message: `Chave de emergência ativada: ${bestEmergency.name}`,
    previousActiveCount
  }
}

// ============================================================================
// Stats & Monitoring
// ============================================================================

/**
 * Get pool statistics for monitoring
 */
export async function getCredentialPoolStats(tenantId: string): Promise<CredentialPoolStats> {
  const pool = await getCredentialPool(tenantId)
  
  const stats: CredentialPoolStats = {
    total: pool.length,
    active: pool.filter(c => c.status === 'active').length,
    exhausted: pool.filter(c => c.status === 'exhausted').length,
    expired: pool.filter(c => c.status === 'expired').length,
    emergency: pool.filter(c => c.isEmergency).length,
    totalCreditsRemaining: null,
    averageUsagePercentage: 0
  }
  
  // Calculate credits remaining (only for credentials with quotas)
  const withQuota = pool.filter(c => c.creditsRemaining !== null)
  if (withQuota.length > 0) {
    stats.totalCreditsRemaining = withQuota.reduce((sum, c) => 
      sum + (c.creditsRemaining || 0), 0
    )
  }
  
  // Calculate average usage
  if (pool.length > 0) {
    stats.averageUsagePercentage = pool.reduce((sum, c) => 
      sum + c.usagePercentage, 0
    ) / pool.length
  }
  
  return stats
}

/**
 * Reset quota usage (typically called on quota reset period)
 */
export async function resetCredentialQuota(credentialId: string): Promise<void> {
  if (credentialCache[credentialId]) {
    credentialCache[credentialId].quotaUsed = 0
    credentialCache[credentialId].lastErrorAt = null
    credentialCache[credentialId].lastError = null
    
    // If was exhausted, reactivate
    if (credentialCache[credentialId].status === 'exhausted') {
      credentialCache[credentialId].status = 'active'
    }
  }
}

/**
 * Mark a credential as revoked (invalid, should not be used)
 */
export async function revokeCredential(credentialId: string): Promise<void> {
  if (!credentialCache[credentialId]) {
    credentialCache[credentialId] = {
      quotaUsed: 0,
      lastUsedAt: null,
      lastErrorAt: new Date(),
      lastError: 'Credential revoked',
      status: 'revoked'
    }
  } else {
    credentialCache[credentialId].status = 'revoked'
  }
  
  // Also deactivate in database if it's an API key
  if (!credentialId.startsWith('oauth_')) {
    await prisma.apiKey.update({
      where: { id: credentialId },
      data: { isActive: false }
    }).catch(() => {})
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect provider from key prefix
 */
function detectProvider(keyPrefix: string): CredentialProvider {
  const prefix = keyPrefix.toLowerCase()
  
  if (prefix.includes('sk-') || prefix.includes('openai')) return 'openai'
  if (prefix.includes('anthropic') || prefix.includes('claude')) return 'anthropic'
  if (prefix.includes('google') || prefix.includes('gemini')) return 'google'
  if (prefix.includes('azure')) return 'azure'
  
  return 'custom'
}

/**
 * Log emergency activation for auditing
 */
async function logEmergencyActivation(
  tenantId: string,
  credentialId: string | null,
  success: boolean,
  message: string
): Promise<void> {
  console.log(`[CREDENTIAL POOL] Emergency activation: tenant=${tenantId} cred=${credentialId} success=${success} msg="${message}"`)
  
  // Create admin alert for visibility
  const adminAgent = await prisma.adminAgent.findUnique({
    where: { tenantId }
  })
  
  if (adminAgent) {
    await prisma.adminAlert.create({
      data: {
        adminAgentId: adminAgent.id,
        type: 'RESOURCE_ALERT',
        severity: success ? 'WARNING' : 'CRITICAL',
        title: success ? 'Chave de emergência ativada' : 'Falha ao ativar chave de emergência',
        message,
        metadata: {
          credentialId,
          success,
          timestamp: new Date().toISOString()
        }
      }
    })
  }
}
