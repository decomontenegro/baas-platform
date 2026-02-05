/**
 * LLM Gateway
 * Hub centralizado de roteamento e consumo de LLM para multi-tenancy
 * 
 * Fluxo:
 * 1. Request chega com tenant_id, agent_id, messages
 * 2. Rate limiter verifica limites
 * 3. Router seleciona o melhor provider disponível
 * 4. Circuit breaker verifica saúde do provider
 * 5. Request executado no provider
 * 6. Tracker registra uso
 * 7. Response retornado
 */

import { selectProvider, getProviderHealth, ProviderUnavailableError, RateLimitError } from './router';
import { trackUsage, getCurrentMonthUsage, getTodayUsage, getTenantStats } from './tracker';
import { checkRateLimit, incrementActiveRequests, decrementActiveRequests, checkProviderCapacity } from './rate-limiter';
import { recordSuccess, recordFailure, isCircuitOpen, loadCircuitStates, canRequest } from './circuit-breaker';
import type { CompletionRequest, CompletionResponse, GatewayOptions, Message } from './types';

// ============================================
// RE-EXPORTS: Types
// ============================================

export * from './types';

// ============================================
// RE-EXPORTS: Router
// ============================================

export { 
  selectProvider, 
  getProviderHealth, 
  getProviders,
  getAvailableProviders,
  getProvider,
  getProviderByName,
  ProviderUnavailableError, 
  RateLimitError 
} from './router';

// ============================================
// RE-EXPORTS: Tracker
// ============================================

export { 
  trackUsage, 
  getCurrentMonthUsage, 
  getTodayUsage, 
  getTenantStats,
  calculateCost,
  getRecentUsage,
  getAgentUsage
} from './tracker';

// ============================================
// RE-EXPORTS: Rate Limiter
// ============================================

export { 
  checkRateLimit, 
  checkProviderCapacity,
  incrementActiveRequests, 
  decrementActiveRequests,
  getActiveRequestCount,
  checkRateLimitPersistent,
  updateTokenCount,
  cleanupExpiredEntries,
  getTenantRateLimitConfig
} from './rate-limiter';

// ============================================
// RE-EXPORTS: Circuit Breaker
// ============================================

export { 
  recordSuccess, 
  recordFailure, 
  isCircuitOpen, 
  canRequest,
  loadCircuitStates,
  resetCircuit,
  getCircuitStatus,
  getAllCircuitStatuses,
  configureCircuit
} from './circuit-breaker';

// ============================================
// RE-EXPORTS: Alerter
// ============================================

export {
  checkAndCreateAlerts,
  getActiveAlerts,
  getAllAlerts,
  acknowledgeAlert,
  acknowledgeAlerts,
  sendAlertNotifications,
  getUsageContext,
  cleanupExpiredAlerts,
  DEFAULT_THRESHOLDS,
  type AlertThreshold,
  type CreateAlertData,
  type NotificationResult,
} from './alerter';

// ============================================
// RE-EXPORTS: Usage Analytics
// ============================================

export {
  getUsageSummary,
  getUsageByAgent,
  getUsageByModel,
  getUsageByProvider,
  getUsageHistory,
  getHourlyUsageToday,
  getCurrentMonthUsage as getMonthUsage,
  getRealTimeStats,
  type UsagePeriod,
  type UsageSummary,
  type AgentUsage,
  type ModelUsage,
  type ProviderUsage,
  type DailyUsage,
  type HourlyUsage,
} from './usage';

// ============================================
// MAIN GATEWAY
// ============================================

/**
 * Process a completion request through the gateway
 */
export async function complete(
  request: CompletionRequest,
  options: GatewayOptions = {}
): Promise<CompletionResponse> {
  const startTime = Date.now();
  const { tenantId, agentId, messages, channel, groupId, sessionId, metadata } = request;
  
  // 1. Check rate limits
  const rateLimitResult = await checkRateLimit(tenantId, agentId);
  if (!rateLimitResult.allowed) {
    throw new RateLimitError(
      rateLimitResult.reason || 'Rate limit exceeded',
      rateLimitResult.retryAfter || 60
    );
  }
  
  // 2. Select provider
  const { provider, reason } = await selectProvider(tenantId, {
    model: options.model || request.model,
    preferProvider: options.preferProvider
  });
  
  console.log(`[Gateway] ${reason}`);
  
  // 3. Track active request
  incrementActiveRequests(provider.id);
  
  try {
    // 4. Execute request
    const response = await executeCompletion(provider, messages, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      timeout: options.timeout
    });
    
    const latencyMs = Date.now() - startTime;
    
    // 5. Record success
    await recordSuccess(provider.id);
    
    // 6. Track usage
    await trackUsage({
      tenantId,
      agentId,
      providerId: provider.id,
      model: provider.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs,
      channel,
      groupId,
      sessionId,
      success: true,
      metadata
    });
    
    return {
      id: response.id,
      model: provider.model,
      provider: provider.name,
      content: response.content,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.inputTokens + response.usage.outputTokens,
        cost: response.usage.cost
      },
      latencyMs
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    // Record failure for circuit breaker
    await recordFailure(provider.id, error as Error);
    
    // Track failed usage
    await trackUsage({
      tenantId,
      agentId,
      providerId: provider.id,
      model: provider.model,
      inputTokens: estimateInputTokens(messages),
      outputTokens: 0,
      latencyMs,
      channel,
      groupId,
      sessionId,
      success: false,
      errorMessage: (error as Error).message,
      metadata
    });
    
    // Re-throw for caller to handle
    throw error;
  } finally {
    decrementActiveRequests(provider.id);
  }
}

// ============================================
// PROVIDER EXECUTION
// ============================================

interface ProviderResponse {
  id: string;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
}

/**
 * Execute completion against a provider
 */
async function executeCompletion(
  provider: { id: string; name: string; type: string; model: string; costPerInputToken: number; costPerOutputToken: number },
  messages: Message[],
  options: { maxTokens?: number; temperature?: number; timeout?: number }
): Promise<ProviderResponse> {
  const { type } = provider;
  
  switch (type) {
    case 'CLAUDE_API':
      return executeClaudeAPI(provider, messages, options);
    
    case 'CLAUDE_MAX':
      return executeClaudeMax(provider, messages, options);
    
    case 'OPENAI_API':
      return executeOpenAI(provider, messages, options);
    
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Execute via Claude API (direct)
 */
async function executeClaudeAPI(
  provider: { id: string; model: string; costPerInputToken: number; costPerOutputToken: number },
  messages: Message[],
  options: { maxTokens?: number; temperature?: number; timeout?: number }
): Promise<ProviderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
        system: messages.find(m => m.role === 'system')?.content
      }),
      signal: controller.signal
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API error');
    }
    
    const data = await response.json();
    
    const inputTokens = data.usage?.input_tokens || estimateInputTokens(messages);
    const outputTokens = data.usage?.output_tokens || estimateOutputTokens(data.content?.[0]?.text || '');
    
    return {
      id: data.id,
      content: data.content?.[0]?.text || '',
      usage: {
        inputTokens,
        outputTokens,
        cost: (inputTokens * provider.costPerInputToken) + (outputTokens * provider.costPerOutputToken)
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute via Claude Max (session-based)
 */
async function executeClaudeMax(
  provider: { id: string; model: string; costPerInputToken: number; costPerOutputToken: number },
  messages: Message[],
  options: { maxTokens?: number; temperature?: number; timeout?: number }
): Promise<ProviderResponse> {
  // TODO: Implement actual Claude Max integration via browser session
  console.warn('[Gateway] Claude Max not implemented, using simulation');
  
  const inputTokens = estimateInputTokens(messages);
  const outputTokens = 500;
  
  return {
    id: `max-${Date.now()}`,
    content: '[Simulated response from Claude Max]',
    usage: {
      inputTokens,
      outputTokens,
      cost: 0 // Max has fixed monthly cost
    }
  };
}

/**
 * Execute via OpenAI API
 */
async function executeOpenAI(
  provider: { id: string; model: string; costPerInputToken: number; costPerOutputToken: number },
  messages: Message[],
  options: { maxTokens?: number; temperature?: number; timeout?: number }
): Promise<ProviderResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      }),
      signal: controller.signal
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }
    
    const data = await response.json();
    
    const inputTokens = data.usage?.prompt_tokens || estimateInputTokens(messages);
    const outputTokens = data.usage?.completion_tokens || estimateOutputTokens(data.choices?.[0]?.message?.content || '');
    
    return {
      id: data.id,
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens,
        outputTokens,
        cost: (inputTokens * provider.costPerInputToken) + (outputTokens * provider.costPerOutputToken)
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function estimateInputTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}

function estimateOutputTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

// ============================================
// GATEWAY STATUS
// ============================================

/**
 * Get overall gateway health status
 */
export async function getGatewayHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: {
    active: number;
    degraded: number;
    unavailable: number;
  };
  uptime: number;
}> {
  const health = await getProviderHealth();
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  
  if (health.active > 0 && health.unavailable === 0) {
    status = 'healthy';
  } else if (health.active > 0 || health.degraded > 0) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    providers: {
      active: health.active,
      degraded: health.degraded,
      unavailable: health.unavailable
    },
    uptime: process.uptime()
  };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the gateway (load circuit states, etc.)
 */
export async function initializeGateway(): Promise<void> {
  console.log('[Gateway] Initializing...');
  await loadCircuitStates();
  console.log('[Gateway] Initialized');
}

// Initialize on module load (server-side only)
if (typeof window === 'undefined') {
  initializeGateway().catch(console.error);
}
