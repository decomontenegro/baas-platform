/**
 * LLM Gateway - Router
 * Seleciona o melhor provider disponível baseado em prioridade e saúde
 * 
 * Ordem de prioridade:
 * 1. max-1 (Claude Max #1)
 * 2. max-2 (Claude Max #2)
 * 3. api-paid (Claude API)
 */

import { prisma } from '@/lib/prisma';
import type { LLMProvider } from '@prisma/client';
import { isCircuitOpen, canRequest as circuitCanRequest } from './circuit-breaker';
import { checkProviderCapacity } from './rate-limiter';
import { RouteResult, GatewayOptions } from './types';

// ============================================
// Configuration
// ============================================

interface RoutingConfig {
  // Prefer Max accounts (fixed cost)
  preferMaxAccounts: boolean;
  // Distribution strategy: 'priority' | 'round-robin' | 'least-loaded'
  distribution: 'priority' | 'round-robin' | 'least-loaded';
  // Provider timeout before fallback
  providerTimeout: number;
  // Max retries before fallback
  maxRetries: number;
}

const DEFAULT_CONFIG: RoutingConfig = {
  preferMaxAccounts: true,
  distribution: 'priority',
  providerTimeout: 30000,
  maxRetries: 2
};

// Round-robin state
let roundRobinIndex = 0;

// ============================================
// Core Functions
// ============================================

/**
 * Select the best available provider for a request
 */
export async function selectProvider(
  tenantId: string,
  options: GatewayOptions = {}
): Promise<RouteResult> {
  const { model, preferProvider } = options;
  
  // 0. Get tenant's allowed providers (if restricted)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { allowedProviders: true }
  });
  
  const allowedProviders = tenant?.allowedProviders ?? [];
  
  // 1. Get all providers, ordered by priority
  let providers = await prisma.lLMProvider.findMany({
    where: {
      status: { in: ['ACTIVE', 'DEGRADED'] },
      ...(model ? { model } : {})
    },
    orderBy: { priority: 'asc' }
  });
  
  // 1.1 Filter by tenant's allowed providers (if specified)
  if (allowedProviders.length > 0) {
    providers = providers.filter(p => 
      allowedProviders.includes(p.name) || allowedProviders.includes(p.id)
    );
  }
  
  if (providers.length === 0) {
    throw new ProviderUnavailableError('No available providers found for this tenant');
  }
  
  // 2. If preferProvider specified, try it first
  if (preferProvider) {
    const preferred = providers.find(p => p.name === preferProvider || p.id === preferProvider);
    if (preferred) {
      const available = await isProviderAvailable(preferred);
      if (available) {
        return {
          provider: preferred,
          reason: `Selected preferred provider: ${preferred.name}`
        };
      }
    }
  }
  
  // 3. Try each provider in order
  const errors: string[] = [];
  
  for (const provider of providers) {
    const result = await tryProvider(provider, errors);
    if (result) {
      return result;
    }
  }
  
  // 4. All providers failed
  throw new ProviderUnavailableError(
    `All providers unavailable. Errors: ${errors.join('; ')}`
  );
}

/**
 * Try to select a specific provider
 */
async function tryProvider(
  provider: LLMProvider,
  errors: string[]
): Promise<RouteResult | null> {
  // Check circuit breaker
  if (isCircuitOpen(provider.id)) {
    errors.push(`${provider.name}: circuit breaker open`);
    return null;
  }
  
  // Check if circuit allows requests (CLOSED or HALF_OPEN)
  if (!circuitCanRequest(provider.id)) {
    errors.push(`${provider.name}: circuit not accepting requests`);
    return null;
  }
  
  // Check provider capacity
  const capacityResult = await checkProviderCapacity(provider.id, {
    maxConcurrency: provider.concurrency,
    requestsPerMinute: provider.rateLimit
  });
  
  if (!capacityResult.allowed) {
    errors.push(`${provider.name}: ${capacityResult.reason}`);
    return null;
  }
  
  // Provider is available
  return {
    provider,
    reason: `Selected ${provider.name} (priority ${provider.priority}, status ${provider.status})`
  };
}

/**
 * Check if a provider is available for requests
 */
async function isProviderAvailable(provider: LLMProvider): Promise<boolean> {
  // Check status
  if (!['ACTIVE', 'DEGRADED'].includes(provider.status)) {
    return false;
  }
  
  // Check circuit breaker
  if (isCircuitOpen(provider.id)) {
    return false;
  }
  
  // Check capacity
  const capacityResult = await checkProviderCapacity(provider.id);
  return capacityResult.allowed;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all providers with their current status
 */
export async function getProviders(): Promise<LLMProvider[]> {
  return prisma.lLMProvider.findMany({
    orderBy: { priority: 'asc' }
  });
}

/**
 * Get providers that are currently available
 */
export async function getAvailableProviders(model?: string): Promise<LLMProvider[]> {
  const providers = await prisma.lLMProvider.findMany({
    where: {
      status: { in: ['ACTIVE', 'DEGRADED'] },
      ...(model ? { model } : {})
    },
    orderBy: { priority: 'asc' }
  });
  
  const available: LLMProvider[] = [];
  
  for (const provider of providers) {
    if (await isProviderAvailable(provider)) {
      available.push(provider);
    }
  }
  
  return available;
}

/**
 * Get provider by ID
 */
export async function getProvider(providerId: string): Promise<LLMProvider | null> {
  return prisma.lLMProvider.findUnique({
    where: { id: providerId }
  });
}

/**
 * Get provider by name
 */
export async function getProviderByName(name: string): Promise<LLMProvider | null> {
  return prisma.lLMProvider.findUnique({
    where: { name }
  });
}

/**
 * Get provider health summary
 */
export async function getProviderHealth(): Promise<{
  total: number;
  active: number;
  degraded: number;
  unavailable: number;
  providers: Array<{
    id: string;
    name: string;
    status: string;
    priority: number;
    currentLoad: number;
  }>;
}> {
  const providers = await prisma.lLMProvider.findMany({
    orderBy: { priority: 'asc' }
  });
  
  const minuteAgo = new Date(Date.now() - 60000);
  
  const providerDetails = await Promise.all(
    providers.map(async (p) => {
      // Get current request count
      const requestCount = await prisma.lLMUsage.count({
        where: {
          providerId: p.id,
          createdAt: { gte: minuteAgo }
        }
      });
      
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        currentLoad: Math.round((requestCount / p.rateLimit) * 100)
      };
    })
  );
  
  return {
    total: providers.length,
    active: providers.filter(p => p.status === 'ACTIVE').length,
    degraded: providers.filter(p => p.status === 'DEGRADED').length,
    unavailable: providers.filter(p => !['ACTIVE', 'DEGRADED'].includes(p.status)).length,
    providers: providerDetails
  };
}

// ============================================
// Error Classes
// ============================================

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export class RateLimitError extends Error {
  retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
