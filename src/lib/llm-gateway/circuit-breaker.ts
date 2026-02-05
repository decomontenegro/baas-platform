/**
 * LLM Gateway - Circuit Breaker
 * Protege contra falhas cascata, isolando providers problemáticos
 * 
 * Estados:
 * - CLOSED: Funcionando normalmente
 * - OPEN: Bloqueado, não envia requests
 * - HALF_OPEN: Testando recuperação
 */

import { prisma } from '@/lib/prisma';
import type { ProviderStatus } from '@prisma/client';
import { CircuitState, CircuitBreakerConfig, CircuitStatus } from './types';

// ============================================
// Configuration
// ============================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,      // 5 failures to open
  successThreshold: 3,      // 3 successes to close
  halfOpenTimeout: 30000,   // 30s in half-open
  openTimeout: 60000,       // 60s before half-open
  monitoringPeriod: 60000   // 1 minute window
};

// In-memory state (would use Redis for distributed)
const circuitStates = new Map<string, {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  openedAt?: Date;
  config: CircuitBreakerConfig;
}>();

// Timeout handles for state transitions
const transitionTimeouts = new Map<string, NodeJS.Timeout>();

// ============================================
// Core Functions
// ============================================

/**
 * Get current circuit status for a provider
 */
export function getCircuitStatus(providerId: string): CircuitStatus {
  const circuit = circuitStates.get(providerId);
  
  if (!circuit) {
    return {
      providerId,
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0
    };
  }
  
  return {
    providerId,
    state: circuit.state,
    failures: circuit.failures,
    successes: circuit.successes,
    lastFailure: circuit.lastFailure,
    lastSuccess: circuit.lastSuccess,
    openedAt: circuit.openedAt,
    nextRetryAt: circuit.openedAt 
      ? new Date(circuit.openedAt.getTime() + circuit.config.openTimeout)
      : undefined
  };
}

/**
 * Check if circuit is open (blocking requests)
 */
export function isCircuitOpen(providerId: string): boolean {
  const circuit = circuitStates.get(providerId);
  
  if (!circuit) return false;
  
  // If circuit is OPEN, check if it's time to transition to HALF_OPEN
  if (circuit.state === CircuitState.OPEN && circuit.openedAt) {
    const elapsed = Date.now() - circuit.openedAt.getTime();
    if (elapsed >= circuit.config.openTimeout) {
      // Auto-transition to HALF_OPEN
      circuit.state = CircuitState.HALF_OPEN;
      circuit.successes = 0;
      console.log(`[CircuitBreaker] Provider ${providerId} transitioned to HALF_OPEN`);
    }
  }
  
  return circuit.state === CircuitState.OPEN;
}

/**
 * Check if circuit allows a request (CLOSED or HALF_OPEN)
 */
export function canRequest(providerId: string): boolean {
  const circuit = circuitStates.get(providerId);
  
  if (!circuit) return true;
  
  // Update state if needed
  isCircuitOpen(providerId);
  
  return circuit.state !== CircuitState.OPEN;
}

/**
 * Record a successful request
 */
export async function recordSuccess(providerId: string): Promise<void> {
  let circuit = circuitStates.get(providerId);
  
  if (!circuit) {
    circuit = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      config: DEFAULT_CONFIG
    };
    circuitStates.set(providerId, circuit);
  }
  
  circuit.successes++;
  circuit.failures = 0;
  circuit.lastSuccess = new Date();
  
  // If in HALF_OPEN and enough successes, close the circuit
  if (circuit.state === CircuitState.HALF_OPEN) {
    if (circuit.successes >= circuit.config.successThreshold) {
      await transitionToState(providerId, CircuitState.CLOSED, 'Recovered - sufficient successes');
    }
  }
}

/**
 * Record a failed request
 */
export async function recordFailure(providerId: string, error: Error): Promise<void> {
  let circuit = circuitStates.get(providerId);
  
  if (!circuit) {
    circuit = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      config: DEFAULT_CONFIG
    };
    circuitStates.set(providerId, circuit);
  }
  
  circuit.failures++;
  circuit.successes = 0;
  circuit.lastFailure = new Date();
  
  console.log(`[CircuitBreaker] Provider ${providerId} failure #${circuit.failures}: ${error.message}`);
  
  // If in HALF_OPEN, immediately open on failure
  if (circuit.state === CircuitState.HALF_OPEN) {
    await transitionToState(providerId, CircuitState.OPEN, `Failed during recovery test: ${error.message}`);
    scheduleHalfOpenTransition(providerId);
    return;
  }
  
  // If enough failures, open the circuit
  if (circuit.failures >= circuit.config.failureThreshold) {
    await transitionToState(providerId, CircuitState.OPEN, `Too many failures (${circuit.failures}): ${error.message}`);
    scheduleHalfOpenTransition(providerId);
  }
}

/**
 * Manually reset circuit to CLOSED state
 */
export async function resetCircuit(providerId: string): Promise<void> {
  const circuit = circuitStates.get(providerId);
  
  if (!circuit) return;
  
  // Clear any pending transition
  const timeout = transitionTimeouts.get(providerId);
  if (timeout) {
    clearTimeout(timeout);
    transitionTimeouts.delete(providerId);
  }
  
  await transitionToState(providerId, CircuitState.CLOSED, 'Manual reset');
}

/**
 * Configure circuit breaker for a provider
 */
export function configureCircuit(providerId: string, config: Partial<CircuitBreakerConfig>): void {
  let circuit = circuitStates.get(providerId);
  
  if (!circuit) {
    circuit = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      config: { ...DEFAULT_CONFIG, ...config }
    };
    circuitStates.set(providerId, circuit);
  } else {
    circuit.config = { ...circuit.config, ...config };
  }
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Transition circuit to a new state and persist to DB
 */
async function transitionToState(
  providerId: string,
  newState: CircuitState,
  reason: string
): Promise<void> {
  const circuit = circuitStates.get(providerId);
  if (!circuit) return;
  
  const oldState = circuit.state;
  circuit.state = newState;
  
  if (newState === CircuitState.OPEN) {
    circuit.openedAt = new Date();
  } else if (newState === CircuitState.CLOSED) {
    circuit.openedAt = undefined;
    circuit.failures = 0;
    circuit.successes = 0;
  }
  
  console.log(`[CircuitBreaker] Provider ${providerId}: ${oldState} -> ${newState} (${reason})`);
  
  // Map circuit state to provider status
  const statusMap: Record<CircuitState, ProviderStatus> = {
    [CircuitState.CLOSED]: 'ACTIVE',
    [CircuitState.OPEN]: 'CIRCUIT_OPEN',
    [CircuitState.HALF_OPEN]: 'DEGRADED'
  };
  
  try {
    // Update provider status
    await prisma.lLMProvider.update({
      where: { id: providerId },
      data: {
        status: statusMap[newState],
        lastErrorAt: newState === CircuitState.OPEN ? new Date() : undefined,
        errorCount: circuit.failures
      }
    });
    
    // Record status history
    await prisma.providerStatusHistory.create({
      data: {
        providerId,
        fromStatus: statusMap[oldState as CircuitState] || 'ACTIVE',
        toStatus: statusMap[newState],
        reason
      }
    });
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to persist state change:`, error);
  }
}

/**
 * Schedule transition from OPEN to HALF_OPEN
 */
function scheduleHalfOpenTransition(providerId: string): void {
  const circuit = circuitStates.get(providerId);
  if (!circuit) return;
  
  // Clear any existing timeout
  const existing = transitionTimeouts.get(providerId);
  if (existing) {
    clearTimeout(existing);
  }
  
  const timeout = setTimeout(async () => {
    const current = circuitStates.get(providerId);
    if (current?.state === CircuitState.OPEN) {
      current.state = CircuitState.HALF_OPEN;
      current.successes = 0;
      
      console.log(`[CircuitBreaker] Provider ${providerId} transitioned to HALF_OPEN (auto)`);
      
      try {
        await prisma.lLMProvider.update({
          where: { id: providerId },
          data: { status: 'DEGRADED' }
        });
      } catch (error) {
        console.error(`[CircuitBreaker] Failed to update provider status:`, error);
      }
    }
    transitionTimeouts.delete(providerId);
  }, circuit.config.openTimeout);
  
  transitionTimeouts.set(providerId, timeout);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get circuit state (enum) for a provider
 * Alias for getCircuitStatus that returns just the state
 */
export function getCircuitState(providerId: string): CircuitState {
  const circuit = circuitStates.get(providerId);
  
  if (!circuit) {
    return CircuitState.CLOSED;
  }
  
  // Check for auto-transition from OPEN to HALF_OPEN
  if (circuit.state === CircuitState.OPEN && circuit.openedAt) {
    const elapsed = Date.now() - circuit.openedAt.getTime();
    if (elapsed >= circuit.config.openTimeout) {
      circuit.state = CircuitState.HALF_OPEN;
      circuit.successes = 0;
    }
  }
  
  return circuit.state;
}

/**
 * Get all circuit statuses
 */
export function getAllCircuitStatuses(): CircuitStatus[] {
  const statuses: CircuitStatus[] = [];
  
  for (const [providerId] of circuitStates) {
    statuses.push(getCircuitStatus(providerId));
  }
  
  return statuses;
}

/**
 * Load circuit states from database (for recovery after restart)
 */
export async function loadCircuitStates(): Promise<void> {
  try {
    const providers = await prisma.lLMProvider.findMany({
      where: {
        status: { in: ['CIRCUIT_OPEN', 'DEGRADED'] }
      }
    });
    
    for (const provider of providers) {
      const state = provider.status === 'CIRCUIT_OPEN' 
        ? CircuitState.OPEN 
        : CircuitState.HALF_OPEN;
      
      circuitStates.set(provider.id, {
        state,
        failures: provider.errorCount,
        successes: 0,
        lastFailure: provider.lastErrorAt || undefined,
        openedAt: provider.status === 'CIRCUIT_OPEN' ? provider.lastErrorAt || undefined : undefined,
        config: DEFAULT_CONFIG
      });
      
      console.log(`[CircuitBreaker] Loaded state for ${provider.name}: ${state}`);
    }
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to load circuit states:`, error);
  }
}

// ============================================
// Export as Object (per spec)
// ============================================

/**
 * Circuit Breaker object with all functions
 * Use this for a clean import: import { circuitBreaker } from './circuit-breaker'
 */
export const circuitBreaker = {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  getCircuitState,
  getCircuitStatus,
  resetCircuit,
  configureCircuit,
  canRequest,
  getAllCircuitStatuses,
  loadCircuitStates,
  
  // Constants
  DEFAULT_CONFIG,
  CircuitState,
};

export default circuitBreaker;
