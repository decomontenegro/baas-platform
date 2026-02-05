/**
 * Config Validator Service
 * 
 * Validates configurations BEFORE applying them
 * Prevents invalid configs from breaking the system
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// Schema for bot configuration validation
const botConfigSchema = z.object({
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(10).max(10000),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(100).max(128000),
  personality: z.object({
    creativity: z.number().min(0).max(100),
    formality: z.number().min(0).max(100),
    verbosity: z.number().min(0).max(100),
    empathy: z.number().min(0).max(100),
    humor: z.number().min(0).max(100),
  }).optional(),
})

// Schema for admin agent configuration
const adminAgentConfigSchema = z.object({
  healthCheckEnabled: z.boolean().optional(),
  healthCheckIntervalMs: z.number().min(60000).max(3600000).optional(),
  healthCheckTimeoutMs: z.number().min(5000).max(60000).optional(),
  maxRestartAttempts: z.number().min(1).max(10).optional(),
  alertOnLatencyMs: z.number().min(1000).max(60000).optional(),
  alertOnErrorRate: z.number().min(0).max(1).optional(),
  autoRestartEnabled: z.boolean().optional(),
  autoRollbackEnabled: z.boolean().optional(),
})

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate bot configuration
 */
export function validateBotConfig(config: unknown): ValidationResult {
  const result = botConfigSchema.safeParse(config)
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      warnings: []
    }
  }
  
  const warnings: string[] = []
  const data = result.data
  
  // Add warnings for potentially problematic configs
  if (data.temperature > 1.5) {
    warnings.push('Temperature > 1.5 pode gerar respostas muito aleatórias')
  }
  
  if (data.maxTokens > 8000) {
    warnings.push('maxTokens > 8000 pode aumentar custos significativamente')
  }
  
  if (data.systemPrompt.length < 50) {
    warnings.push('System prompt muito curto pode resultar em comportamento inconsistente')
  }
  
  return { valid: true, errors: [], warnings }
}

/**
 * Validate admin agent configuration
 */
export function validateAdminAgentConfig(config: unknown): ValidationResult {
  const result = adminAgentConfigSchema.safeParse(config)
  
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      warnings: []
    }
  }
  
  return { valid: true, errors: [], warnings: [] }
}

/**
 * Validate JSON config before applying
 */
export function validateJsonConfig(jsonString: string): ValidationResult {
  try {
    JSON.parse(jsonString)
    return { valid: true, errors: [], warnings: [] }
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON inválido: ${e instanceof Error ? e.message : 'erro desconhecido'}`],
      warnings: []
    }
  }
}

/**
 * Save last known good config for rollback
 */
export async function saveGoodConfig(
  adminAgentId: string,
  config: object
): Promise<void> {
  await prisma.adminAgent.update({
    where: { id: adminAgentId },
    data: {
      lastGoodConfig: config,
      lastGoodConfigAt: new Date()
    }
  })
}

/**
 * Get last known good config for rollback
 */
export async function getLastGoodConfig(
  adminAgentId: string
): Promise<object | null> {
  const agent = await prisma.adminAgent.findUnique({
    where: { id: adminAgentId },
    select: { lastGoodConfig: true }
  })
  
  return agent?.lastGoodConfig as object | null
}

/**
 * Apply config with validation and rollback capability
 */
export async function applyConfigWithValidation<T>(
  adminAgentId: string,
  newConfig: T,
  validator: (config: unknown) => ValidationResult,
  applier: (config: T) => Promise<void>
): Promise<{ success: boolean; result: ValidationResult }> {
  // Validate first
  const validation = validator(newConfig)
  
  if (!validation.valid) {
    return { success: false, result: validation }
  }
  
  try {
    // Apply the config
    await applier(newConfig)
    
    // Save as last good config
    await saveGoodConfig(adminAgentId, newConfig as object)
    
    return { success: true, result: validation }
  } catch (error) {
    // Try to rollback
    const lastGood = await getLastGoodConfig(adminAgentId)
    
    if (lastGood) {
      try {
        await applier(lastGood as T)
        console.log('Config rolled back to last good state')
      } catch (rollbackError) {
        console.error('Rollback also failed:', rollbackError)
      }
    }
    
    return {
      success: false,
      result: {
        valid: false,
        errors: [`Falha ao aplicar config: ${error instanceof Error ? error.message : 'erro'}`],
        warnings: validation.warnings
      }
    }
  }
}
