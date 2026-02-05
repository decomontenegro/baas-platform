# 🚀 LLM Gateway - Especificação Técnica

> Hub centralizado de roteamento e consumo de LLM para multi-tenancy do BaaS
> 
> **Versão:** 1.0  
> **Data:** 2026-01-31  
> **Status:** Draft

---

## 📑 Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Schema Prisma](#3-schema-prisma)
4. [Lógica de Roteamento](#4-lógica-de-roteamento)
5. [Rate Limiting & Circuit Breaker](#5-rate-limiting--circuit-breaker)
6. [Tracking de Consumo](#6-tracking-de-consumo)
7. [API Endpoints](#7-api-endpoints)
8. [Sistema de Alertas](#8-sistema-de-alertas)
9. [Dashboard de Consumo](#9-dashboard-de-consumo)
10. [Implementação](#10-implementação)

---

## 1. Visão Geral

### 1.1 Problema

O BaaS atende múltiplas empresas parceiras (onde Deco é sócio), cada uma com:
- Login individual
- Múltiplos agentes (alcateia: Lobo, Águia, Coruja, etc.)
- Necessidade de tracking de consumo isolado

Mas todas **compartilham o mesmo pool de LLM**:
- 2 contas Claude Max (Anthropic) - rotação/fallback
- 1 API Key paga - fallback final

### 1.2 Solução

Gateway centralizado que:
1. **Roteia** requests inteligentemente entre providers
2. **Rastreia** consumo por tenant/org
3. **Protege** contra abusos e falhas
4. **Alerta** quando limites estão próximos
5. **Otimiza** custos com fallback automático

### 1.3 Exemplo de Primeiro Tenant

**VM do Deco (atual):**
- Sistema: 2 contas Max + API fallback (já funciona assim no Clawdbot)
- Agentes: Lobo (coordenador), Águia, Coruja, Raposa, Falcão, Golfinho, Pantera, Castor, Cão, Arara
- Consumo médio: ~$110/dia

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        BaaS Dashboard                            │
│               (UI de configuração + analytics)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      🚀 LLM GATEWAY                              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │  Router     │   Tracker   │  Circuit    │    Alerter      │  │
│  │  (routing)  │   (usage)   │  Breaker    │    (notifs)     │  │
│  └──────┬──────┴──────┬──────┴──────┬──────┴────────┬────────┘  │
│         │             │             │               │            │
│  ┌──────▼─────────────▼─────────────▼───────────────▼────────┐  │
│  │                    Provider Pool                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐ │  │
│  │  │ Max #1   │  │ Max #2   │  │ API Key (paga)           │ │  │
│  │  │ Primary  │  │ Fallback │  │ Final Fallback           │ │  │
│  │  │ $20/mês  │  │ $20/mês  │  │ Pay-per-use              │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Tenant: VM  │  │ Tenant:     │  │ Tenant:     │  ...        │
│  │ Deco        │  │ Liqi        │  │ R2          │             │
│  │ (Alcateia)  │  │ (Fintech)   │  │ (Proptech)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Fluxo de Request

```
1. Request chega (tenant_id, agent_id, prompt)
         │
         ▼
2. Rate Limiter verifica limites do tenant
         │ (OK)
         ▼
3. Router seleciona provider (Max1 → Max2 → API)
         │
         ▼
4. Circuit Breaker verifica status do provider
         │ (CLOSED/HALF_OPEN)
         ▼
5. Request executado no provider
         │
         ├─ Sucesso ──► Tracker registra uso ──► Response
         │
         └─ Falha ──► Circuit Breaker marca ──► Retry próximo provider
```

---

## 3. Schema Prisma

```prisma
// ============================================
// TENANT - Organização/Empresa cliente
// ============================================
model Tenant {
  id            String   @id @default(cuid())
  name          String   @unique
  slug          String   @unique // ex: "vm-deco", "liqi", "r2"
  
  // Configurações
  settings      Json?    // Configs específicas do tenant
  
  // Limites
  monthlyBudget Float?   // Budget mensal em USD (opcional)
  dailyLimit    Float?   // Limite diário em USD (opcional)
  
  // Alertas configuráveis
  alertThresholds Json   @default("[0.2, 0.1, 0.05, 0.01]") // 20%, 10%, 5%, 1%
  
  // Status
  active        Boolean  @default(true)
  suspended     Boolean  @default(false) // Se passou do limite
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relações
  agents        TenantAgent[]
  usage         LLMUsage[]
  alerts        UsageAlert[]
  
  @@index([slug])
  @@index([active])
}

// ============================================
// TENANT AGENT - Agente pertencente a um tenant
// ============================================
model TenantAgent {
  id            String   @id @default(cuid())
  name          String   // ex: "Lobo", "Águia"
  role          String?  // ex: "coordinator", "researcher"
  
  // Referência ao tenant
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Preferências de modelo
  preferredModel String? // ex: "claude-sonnet-4-20250514"
  
  // Limites específicos do agente
  dailyLimit    Float?   // Limite diário em USD (opcional)
  
  // Status
  active        Boolean  @default(true)
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relações
  usage         LLMUsage[]
  
  @@unique([tenantId, name])
  @@index([tenantId])
}

// ============================================
// LLM PROVIDER - Providers disponíveis no pool
// ============================================
model LLMProvider {
  id            String   @id @default(cuid())
  name          String   @unique // ex: "max-1", "max-2", "api-paid"
  type          LLMProviderType
  
  // Configuração
  endpoint      String?  // URL do endpoint (se aplicável)
  model         String   // ex: "claude-sonnet-4-20250514"
  
  // Capacidade
  rateLimit     Int      @default(60)  // requests por minuto
  concurrency   Int      @default(5)   // requests simultâneos
  
  // Custo
  costPerInputToken  Float  @default(0.000003)  // $3/1M tokens
  costPerOutputToken Float  @default(0.000015)  // $15/1M tokens
  
  // Prioridade (menor = mais prioritário)
  priority      Int      @default(1)
  
  // Status operacional
  status        ProviderStatus @default(ACTIVE)
  lastCheckedAt DateTime?
  lastErrorAt   DateTime?
  errorCount    Int      @default(0)
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relações
  usage         LLMUsage[]
  statusHistory ProviderStatusHistory[]
  
  @@index([status, priority])
}

enum LLMProviderType {
  CLAUDE_MAX      // Conta Max (subscription)
  CLAUDE_API      // API paga (pay-per-use)
  OPENAI_API      // OpenAI API
  GOOGLE_API      // Google AI (Gemini)
  LOCAL           // Modelo local
}

enum ProviderStatus {
  ACTIVE          // Funcionando normalmente
  DEGRADED        // Funcionando com problemas
  RATE_LIMITED    // Atingiu rate limit
  CIRCUIT_OPEN    // Circuit breaker aberto (não usar)
  MAINTENANCE     // Em manutenção programada
  DISABLED        // Desabilitado manualmente
}

// ============================================
// PROVIDER STATUS HISTORY - Histórico de status
// ============================================
model ProviderStatusHistory {
  id            String         @id @default(cuid())
  providerId    String
  provider      LLMProvider    @relation(fields: [providerId], references: [id], onDelete: Cascade)
  
  fromStatus    ProviderStatus
  toStatus      ProviderStatus
  reason        String?        // Motivo da mudança
  
  createdAt     DateTime       @default(now())
  
  @@index([providerId])
  @@index([createdAt])
}

// ============================================
// LLM USAGE - Registro de cada request
// ============================================
model LLMUsage {
  id            String   @id @default(cuid())
  
  // Quem usou
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  agentId       String?
  agent         TenantAgent? @relation(fields: [agentId], references: [id], onDelete: SetNull)
  
  // Provider usado
  providerId    String
  provider      LLMProvider @relation(fields: [providerId], references: [id])
  
  // Modelo e tipo
  model         String   // ex: "claude-sonnet-4-20250514"
  requestType   LLMRequestType @default(CHAT)
  
  // Tokens
  inputTokens   Int
  outputTokens  Int
  totalTokens   Int
  
  // Custo calculado
  cost          Float    // Em USD
  
  // Contexto
  channel       String?  // ex: "whatsapp", "discord"
  groupId       String?  // ID do grupo/canal
  sessionId     String?  // ID da sessão
  
  // Performance
  latencyMs     Int?     // Tempo de resposta
  
  // Status
  success       Boolean  @default(true)
  errorMessage  String?  @db.Text
  
  // Metadata
  metadata      Json?    // Dados adicionais
  
  // Timestamp
  createdAt     DateTime @default(now())
  
  @@index([tenantId])
  @@index([agentId])
  @@index([providerId])
  @@index([createdAt])
  @@index([tenantId, createdAt])
  @@index([model])
}

enum LLMRequestType {
  CHAT          // Conversa normal
  COMPLETION    // Completions
  EMBEDDING     // Embeddings
  FUNCTION_CALL // Tool/function calls
  VISION        // Análise de imagem
  AUDIO         // Transcrição/TTS
}

// ============================================
// USAGE ALERT - Alertas de consumo
// ============================================
model UsageAlert {
  id            String   @id @default(cuid())
  
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  type          AlertType
  threshold     Float    // Threshold que disparou (ex: 0.20 = 20%)
  message       String
  
  // Valores no momento do alerta
  currentUsage  Float    // Uso atual em USD
  limitValue    Float    // Limite configurado em USD
  percentUsed   Float    // Porcentagem usada
  
  // Status
  acknowledged  Boolean  @default(false)
  acknowledgedBy String?
  acknowledgedAt DateTime?
  
  // Notificações enviadas
  emailSent     Boolean  @default(false)
  whatsappSent  Boolean  @default(false)
  slackSent     Boolean  @default(false)
  
  // Timestamp
  createdAt     DateTime @default(now())
  
  @@index([tenantId])
  @@index([type])
  @@index([createdAt])
  @@index([acknowledged])
}

enum AlertType {
  BUDGET_WARNING    // Approaching budget limit
  BUDGET_CRITICAL   // Critical budget level
  BUDGET_EXCEEDED   // Budget exceeded
  DAILY_WARNING     // Approaching daily limit
  DAILY_EXCEEDED    // Daily limit exceeded
  PROVIDER_ERROR    // Provider having issues
  RATE_LIMIT        // Rate limit hit
}

// ============================================
// RATE LIMIT - Controle de rate limiting
// ============================================
model RateLimitEntry {
  id            String   @id @default(cuid())
  
  // Identificador (tenant, agent, ou IP)
  key           String   @unique // ex: "tenant:abc123", "agent:xyz789"
  
  // Contadores
  requestCount  Int      @default(0)
  tokenCount    Int      @default(0)
  
  // Janela de tempo
  windowStart   DateTime
  windowEnd     DateTime
  
  // Status
  blocked       Boolean  @default(false)
  blockedUntil  DateTime?
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([key])
  @@index([windowEnd])
}
```

---

## 4. Lógica de Roteamento

### 4.1 Estratégia de Fallback

```typescript
// router.ts

export interface RouteResult {
  provider: LLMProvider;
  reason: string;
}

export async function selectProvider(
  tenantId: string,
  requestedModel?: string
): Promise<RouteResult> {
  
  // 1. Buscar providers disponíveis, ordenados por prioridade
  const providers = await prisma.lLMProvider.findMany({
    where: {
      status: { in: ['ACTIVE', 'DEGRADED'] },
      model: requestedModel || undefined
    },
    orderBy: { priority: 'asc' }
  });
  
  if (providers.length === 0) {
    throw new Error('No available providers');
  }
  
  // 2. Verificar cada provider na ordem
  for (const provider of providers) {
    
    // 2a. Verificar circuit breaker
    if (await isCircuitOpen(provider.id)) {
      continue;
    }
    
    // 2b. Verificar rate limit do provider
    if (await isProviderRateLimited(provider.id)) {
      continue;
    }
    
    // 2c. Verificar capacidade de concorrência
    if (await isAtMaxConcurrency(provider.id)) {
      continue;
    }
    
    return {
      provider,
      reason: `Selected ${provider.name} (priority ${provider.priority})`
    };
  }
  
  throw new Error('All providers unavailable');
}
```

### 4.2 Ordem de Prioridade

| Prioridade | Provider | Tipo | Custo | Uso |
|------------|----------|------|-------|-----|
| 1 | max-1 | CLAUDE_MAX | $20/mês (fixo) | Primary - uso normal |
| 2 | max-2 | CLAUDE_MAX | $20/mês (fixo) | Fallback - quando max-1 ocupado/falha |
| 3 | api-paid | CLAUDE_API | Pay-per-use | Final fallback - emergência |

### 4.3 Critérios de Seleção

```typescript
// Regras de roteamento

const routingRules = {
  // Sempre tentar Max primeiro (custo fixo)
  preferMaxAccounts: true,
  
  // Distribuir entre Max accounts (round-robin ou least-loaded)
  maxDistribution: 'least-loaded', // ou 'round-robin'
  
  // Só usar API paga se:
  apiPaidConditions: {
    // Ambos Max estão indisponíveis
    maxUnavailable: true,
    // OU request é urgente/crítico
    urgentRequest: true,
    // OU modelo específico não disponível em Max
    modelNotInMax: true
  },
  
  // Timeout antes de fallback
  providerTimeout: 30000, // 30s
  
  // Retry antes de fallback
  maxRetries: 2
};
```

---

## 5. Rate Limiting & Circuit Breaker

### 5.1 Rate Limiting

```typescript
// rate-limiter.ts

interface RateLimitConfig {
  // Por tenant
  tenant: {
    requestsPerMinute: 100,
    tokensPerMinute: 100000,
    requestsPerDay: 5000,
    tokensPerDay: 1000000
  },
  
  // Por agente
  agent: {
    requestsPerMinute: 20,
    tokensPerMinute: 50000
  },
  
  // Por provider
  provider: {
    maxConcurrency: 5,
    requestsPerMinute: 60
  }
}

export async function checkRateLimit(
  tenantId: string,
  agentId?: string
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60000);
  const dayStart = new Date(now.setHours(0, 0, 0, 0));
  
  // 1. Check tenant limits
  const tenantUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: minuteAgo }
    },
    _count: true,
    _sum: { totalTokens: true }
  });
  
  if (tenantUsage._count >= config.tenant.requestsPerMinute) {
    return {
      allowed: false,
      reason: 'Tenant rate limit exceeded (requests/min)',
      retryAfter: 60
    };
  }
  
  if ((tenantUsage._sum.totalTokens || 0) >= config.tenant.tokensPerMinute) {
    return {
      allowed: false,
      reason: 'Tenant rate limit exceeded (tokens/min)',
      retryAfter: 60
    };
  }
  
  // 2. Check daily limits
  const dailyUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: dayStart }
    },
    _sum: { cost: true }
  });
  
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  
  if (tenant?.dailyLimit && (dailyUsage._sum.cost || 0) >= tenant.dailyLimit) {
    return {
      allowed: false,
      reason: 'Daily budget limit exceeded',
      retryAfter: getSecondsUntilMidnight()
    };
  }
  
  return { allowed: true };
}
```

### 5.2 Circuit Breaker

```typescript
// circuit-breaker.ts

interface CircuitBreakerConfig {
  failureThreshold: 5,      // Falhas para abrir
  successThreshold: 3,      // Sucessos para fechar
  halfOpenTimeout: 30000,   // 30s em half-open
  openTimeout: 60000,       // 60s antes de half-open
  monitoringPeriod: 60000   // Janela de monitoramento
}

enum CircuitState {
  CLOSED,    // Funcionando normalmente
  OPEN,      // Bloqueado, não enviar requests
  HALF_OPEN  // Testando recuperação
}

// Estado em memória (ou Redis para distribuído)
const circuitStates = new Map<string, {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  openedAt?: Date;
}>();

export async function recordSuccess(providerId: string): Promise<void> {
  const circuit = circuitStates.get(providerId) || { 
    state: CircuitState.CLOSED, 
    failures: 0, 
    successes: 0 
  };
  
  circuit.successes++;
  circuit.failures = 0;
  
  if (circuit.state === CircuitState.HALF_OPEN) {
    if (circuit.successes >= config.successThreshold) {
      // Recuperou! Fechar circuit
      circuit.state = CircuitState.CLOSED;
      await updateProviderStatus(providerId, 'ACTIVE', 'Circuit closed - recovered');
    }
  }
  
  circuitStates.set(providerId, circuit);
}

export async function recordFailure(providerId: string, error: Error): Promise<void> {
  const circuit = circuitStates.get(providerId) || { 
    state: CircuitState.CLOSED, 
    failures: 0, 
    successes: 0 
  };
  
  circuit.failures++;
  circuit.successes = 0;
  circuit.lastFailure = new Date();
  
  if (circuit.failures >= config.failureThreshold) {
    // Abrir circuit
    circuit.state = CircuitState.OPEN;
    circuit.openedAt = new Date();
    await updateProviderStatus(providerId, 'CIRCUIT_OPEN', `Too many failures: ${error.message}`);
  }
  
  circuitStates.set(providerId, circuit);
  
  // Agendar transição para HALF_OPEN
  setTimeout(async () => {
    const current = circuitStates.get(providerId);
    if (current?.state === CircuitState.OPEN) {
      current.state = CircuitState.HALF_OPEN;
      await updateProviderStatus(providerId, 'DEGRADED', 'Circuit half-open - testing');
    }
  }, config.openTimeout);
}

export async function isCircuitOpen(providerId: string): Promise<boolean> {
  const circuit = circuitStates.get(providerId);
  return circuit?.state === CircuitState.OPEN;
}
```

---

## 6. Tracking de Consumo

### 6.1 Registro de Uso

```typescript
// tracker.ts

export interface UsageRecord {
  tenantId: string;
  agentId?: string;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  channel?: string;
  groupId?: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export async function trackUsage(record: UsageRecord): Promise<LLMUsage> {
  // 1. Calcular custo
  const provider = await prisma.lLMProvider.findUnique({
    where: { id: record.providerId }
  });
  
  const cost = 
    (record.inputTokens * (provider?.costPerInputToken || 0)) +
    (record.outputTokens * (provider?.costPerOutputToken || 0));
  
  // 2. Criar registro
  const usage = await prisma.lLMUsage.create({
    data: {
      tenantId: record.tenantId,
      agentId: record.agentId,
      providerId: record.providerId,
      model: record.model,
      requestType: 'CHAT',
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.inputTokens + record.outputTokens,
      cost,
      channel: record.channel,
      groupId: record.groupId,
      sessionId: record.sessionId,
      latencyMs: record.latencyMs,
      success: record.success,
      errorMessage: record.errorMessage,
      metadata: record.metadata
    }
  });
  
  // 3. Verificar alertas
  await checkAndTriggerAlerts(record.tenantId);
  
  return usage;
}
```

### 6.2 Agregações

```typescript
// aggregations.ts

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byAgent: Record<string, { requests: number; tokens: number; cost: number }>;
  byChannel: Record<string, { requests: number; tokens: number; cost: number }>;
  byDay: Array<{ date: string; requests: number; tokens: number; cost: number }>;
}

export async function getTenantStats(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageStats> {
  
  // Agregação principal
  const totals = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: {
      totalTokens: true,
      cost: true,
      latencyMs: true
    },
    _avg: {
      latencyMs: true
    }
  });
  
  // Contagem de sucessos
  const successCount = await prisma.lLMUsage.count({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
      success: true
    }
  });
  
  // Por modelo
  const byModel = await prisma.lLMUsage.groupBy({
    by: ['model'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: { totalTokens: true, cost: true }
  });
  
  // Por agente
  const byAgent = await prisma.lLMUsage.groupBy({
    by: ['agentId'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    },
    _count: true,
    _sum: { totalTokens: true, cost: true }
  });
  
  // Por dia
  const byDay = await prisma.$queryRaw`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(total_tokens) as tokens,
      SUM(cost) as cost
    FROM llm_usage
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date
  `;
  
  return {
    totalRequests: totals._count,
    totalTokens: totals._sum.totalTokens || 0,
    totalCost: totals._sum.cost || 0,
    avgLatency: totals._avg.latencyMs || 0,
    successRate: totals._count > 0 ? successCount / totals._count : 1,
    byModel: Object.fromEntries(
      byModel.map(m => [m.model, { 
        requests: m._count, 
        tokens: m._sum.totalTokens || 0, 
        cost: m._sum.cost || 0 
      }])
    ),
    byAgent: Object.fromEntries(
      byAgent.map(a => [a.agentId || 'unknown', { 
        requests: a._count, 
        tokens: a._sum.totalTokens || 0, 
        cost: a._sum.cost || 0 
      }])
    ),
    byChannel: {}, // Similar implementation
    byDay: byDay as any
  };
}
```

---

## 7. API Endpoints

### 7.1 Gateway API

```typescript
// Endpoints do LLM Gateway

// POST /api/v1/llm/completions
// Request principal - proxy para LLM providers
interface CompletionRequest {
  tenant_id: string;
  agent_id?: string;
  model?: string;              // Opcional, usa default se não especificado
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  // ... outros params do Anthropic API
  
  // Metadata para tracking
  channel?: string;
  group_id?: string;
  session_id?: string;
}

interface CompletionResponse {
  id: string;
  model: string;
  provider: string;            // Qual provider foi usado
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;              // Custo em USD
  };
  latency_ms: number;
}

// GET /api/v1/llm/providers
// Lista providers e status
interface ProvidersResponse {
  providers: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    priority: number;
    rate_limit: number;
    current_load: number;      // % do rate limit usado
  }>;
}

// GET /api/v1/llm/health
// Health check do gateway
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: {
    active: number;
    degraded: number;
    unavailable: number;
  };
  uptime: number;
}
```

### 7.2 Usage API

```typescript
// GET /api/v1/usage/summary
// Resumo de uso do tenant
interface UsageSummaryRequest {
  tenant_id: string;
  period: 'today' | 'week' | 'month' | 'custom';
  start_date?: string;
  end_date?: string;
}

interface UsageSummaryResponse {
  period: { start: string; end: string };
  totals: {
    requests: number;
    tokens: number;
    cost: number;
    avg_latency_ms: number;
    success_rate: number;
  };
  budget?: {
    monthly_limit: number;
    current_usage: number;
    percent_used: number;
    projected_end_of_month: number;
  };
  by_model: Record<string, UsageBreakdown>;
  by_agent: Record<string, UsageBreakdown>;
  by_day: Array<DailyUsage>;
}

// GET /api/v1/usage/details
// Detalhes de requests individuais
interface UsageDetailsRequest {
  tenant_id: string;
  agent_id?: string;
  start_date: string;
  end_date: string;
  limit?: number;
  offset?: number;
}

// GET /api/v1/usage/export
// Exportar dados de uso
interface UsageExportRequest {
  tenant_id: string;
  format: 'csv' | 'json';
  period: 'month' | 'custom';
  start_date?: string;
  end_date?: string;
}
```

### 7.3 Admin API

```typescript
// POST /api/v1/admin/providers
// Adicionar/configurar provider
interface CreateProviderRequest {
  name: string;
  type: 'CLAUDE_MAX' | 'CLAUDE_API' | 'OPENAI_API';
  model: string;
  priority: number;
  rate_limit: number;
  cost_per_input_token: number;
  cost_per_output_token: number;
  // Credentials (encrypted)
  credentials: {
    api_key?: string;
    session_cookie?: string;
  };
}

// PATCH /api/v1/admin/providers/:id/status
// Alterar status do provider
interface UpdateProviderStatusRequest {
  status: 'ACTIVE' | 'DISABLED' | 'MAINTENANCE';
  reason?: string;
}

// POST /api/v1/admin/tenants
// Criar tenant
interface CreateTenantRequest {
  name: string;
  slug: string;
  monthly_budget?: number;
  daily_limit?: number;
  alert_thresholds?: number[];
}

// PATCH /api/v1/admin/tenants/:id/limits
// Atualizar limites do tenant
interface UpdateTenantLimitsRequest {
  monthly_budget?: number;
  daily_limit?: number;
  alert_thresholds?: number[];
}
```

---

## 8. Sistema de Alertas

### 8.1 Thresholds Configuráveis

```typescript
// alerts.ts

// Thresholds padrão (podem ser customizados por tenant)
const defaultThresholds = {
  budget: [
    { percent: 0.50, type: 'info', action: 'log' },
    { percent: 0.70, type: 'warning', action: 'email' },
    { percent: 0.80, type: 'warning', action: 'email+whatsapp' },
    { percent: 0.90, type: 'critical', action: 'email+whatsapp+slack' },
    { percent: 0.95, type: 'critical', action: 'all+downgrade' },
    { percent: 1.00, type: 'critical', action: 'all+suspend' }
  ],
  remaining: [
    { percent: 0.20, type: 'warning', message: '20% do orçamento restante' },
    { percent: 0.10, type: 'critical', message: '10% do orçamento restante' },
    { percent: 0.05, type: 'critical', message: '5% do orçamento restante!' },
    { percent: 0.01, type: 'critical', message: 'URGENTE: 1% do orçamento!' }
  ]
};
```

### 8.2 Verificação e Disparo

```typescript
// alert-checker.ts

export async function checkAndTriggerAlerts(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });
  
  if (!tenant?.monthlyBudget) return;
  
  // Calcular uso do mês atual
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  const monthlyUsage = await prisma.lLMUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: monthStart }
    },
    _sum: { cost: true }
  });
  
  const currentUsage = monthlyUsage._sum.cost || 0;
  const percentUsed = currentUsage / tenant.monthlyBudget;
  const percentRemaining = 1 - percentUsed;
  
  // Thresholds customizados ou padrão
  const thresholds = tenant.alertThresholds as number[] || [0.20, 0.10, 0.05, 0.01];
  
  // Verificar cada threshold de "restante"
  for (const threshold of thresholds) {
    if (percentRemaining <= threshold) {
      // Verificar se já alertamos neste threshold este mês
      const existingAlert = await prisma.usageAlert.findFirst({
        where: {
          tenantId,
          threshold,
          createdAt: { gte: monthStart }
        }
      });
      
      if (!existingAlert) {
        await createAndSendAlert(tenant, {
          type: threshold <= 0.05 ? 'BUDGET_CRITICAL' : 'BUDGET_WARNING',
          threshold,
          currentUsage,
          limitValue: tenant.monthlyBudget,
          percentUsed,
          message: `${(percentRemaining * 100).toFixed(0)}% do orçamento mensal restante ($${(tenant.monthlyBudget - currentUsage).toFixed(2)})`
        });
      }
    }
  }
  
  // Verificar se excedeu
  if (percentUsed >= 1.0) {
    await createAndSendAlert(tenant, {
      type: 'BUDGET_EXCEEDED',
      threshold: 1.0,
      currentUsage,
      limitValue: tenant.monthlyBudget,
      percentUsed,
      message: `Orçamento mensal EXCEDIDO! Uso: $${currentUsage.toFixed(2)} / Limite: $${tenant.monthlyBudget.toFixed(2)}`
    });
    
    // Suspender tenant se configurado
    if (tenant.settings?.suspendOnExceed) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { suspended: true }
      });
    }
  }
}

async function createAndSendAlert(
  tenant: Tenant,
  alertData: CreateAlertData
): Promise<void> {
  // 1. Criar registro
  const alert = await prisma.usageAlert.create({
    data: {
      tenantId: tenant.id,
      type: alertData.type,
      threshold: alertData.threshold,
      message: alertData.message,
      currentUsage: alertData.currentUsage,
      limitValue: alertData.limitValue,
      percentUsed: alertData.percentUsed
    }
  });
  
  // 2. Enviar notificações
  const contacts = await getTenantContacts(tenant.id);
  
  // Email
  if (contacts.emails?.length) {
    await sendAlertEmail(contacts.emails, alert);
    await prisma.usageAlert.update({
      where: { id: alert.id },
      data: { emailSent: true }
    });
  }
  
  // WhatsApp (para alertas críticos)
  if (alertData.type.includes('CRITICAL') && contacts.whatsapp) {
    await sendAlertWhatsApp(contacts.whatsapp, alert);
    await prisma.usageAlert.update({
      where: { id: alert.id },
      data: { whatsappSent: true }
    });
  }
  
  // Slack webhook
  if (contacts.slackWebhook) {
    await sendAlertSlack(contacts.slackWebhook, alert);
    await prisma.usageAlert.update({
      where: { id: alert.id },
      data: { slackSent: true }
    });
  }
}
```

### 8.3 Formato das Notificações

```typescript
// Mensagem de alerta padrão

const alertTemplates = {
  BUDGET_WARNING: {
    title: '⚠️ Alerta de Orçamento - ${tenantName}',
    body: `
Olá!

O consumo de LLM está se aproximando do limite mensal.

📊 Status Atual:
• Uso: $${currentUsage} / $${limit}
• Restante: ${percentRemaining}% ($${remaining})
• Projeção fim do mês: $${projected}

💡 Recomendações:
• Revise os agentes com maior consumo
• Considere usar modelos mais econômicos
• Ajuste o limite se necessário

Dashboard: ${dashboardUrl}
    `
  },
  
  BUDGET_CRITICAL: {
    title: '🚨 CRÍTICO: Orçamento Quase Esgotado - ${tenantName}',
    body: `
⚠️ ATENÇÃO: Apenas ${percentRemaining}% do orçamento restante!

📊 Situação:
• Uso atual: $${currentUsage}
• Limite: $${limit}
• Restante: $${remaining}

🔴 O sistema pode ser suspenso automaticamente ao atingir 100%.

Ação imediata necessária!
Dashboard: ${dashboardUrl}
    `
  },
  
  BUDGET_EXCEEDED: {
    title: '🛑 ORÇAMENTO EXCEDIDO - ${tenantName}',
    body: `
O orçamento mensal foi EXCEDIDO.

📊 Status:
• Uso: $${currentUsage}
• Limite: $${limit}
• Excedente: $${overage}

${suspended ? '⛔ O serviço foi SUSPENSO automaticamente.' : ''}

Contate o administrador para aumentar o limite.
    `
  }
};
```

---

## 9. Dashboard de Consumo

### 9.1 Componentes do Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 LLM Usage Dashboard                     [Tenant: VM Deco]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ 💰 Custo Mês    │ │ 📨 Requests     │ │ 🎯 Tokens       │   │
│  │ $847.32        │ │ 12,458          │ │ 2.4M            │   │
│  │ ▲ 12% vs mês   │ │ ▲ 8% vs mês     │ │ ▲ 15% vs mês    │   │
│  │ 85% do budget  │ │                 │ │                 │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  Budget Progress                                                │
│  ═════════════════════════════════════════════░░░░░░░░░░░░░░░  │
│  $847.32 / $1,000.00 (85%)              ⚠️ 15% restante        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📈 Custo Diário (últimos 30 dias)                         │ │
│  │                                                           │ │
│  │  $50 │                              ╭─╮                   │ │
│  │      │                    ╭─╮  ╭───╯  │                   │ │
│  │  $30 │          ╭────────╯  ╰──╯      ╰───╮               │ │
│  │      │     ╭────╯                         ╰───            │ │
│  │  $10 │ ────╯                                              │ │
│  │      └────────────────────────────────────────────────    │ │
│  │        Jan 1                                    Jan 31    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────┐ ┌────────────────────────────┐ │
│  │ 🤖 Por Agente              │ │ 🧠 Por Modelo              │ │
│  │                            │ │                            │ │
│  │ Lobo      █████████ $312  │ │ Opus    █████████████ $520 │ │
│  │ Águia     ██████    $187  │ │ Sonnet  ████████      $245 │ │
│  │ Coruja    █████     $156  │ │ Haiku   ███           $82  │ │
│  │ Raposa    ████      $98   │ │                            │ │
│  │ Outros    ███       $94   │ │                            │ │
│  └────────────────────────────┘ └────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ⚠️ Alertas Recentes                                       │ │
│  │                                                           │ │
│  │ 🟡 Jan 28 14:32 - 20% do orçamento restante        [ACK] │ │
│  │ 🟢 Jan 25 09:15 - Provider max-1 recuperado        [ACK] │ │
│  │ 🔴 Jan 25 09:00 - Provider max-1 com falhas              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Componentes React

```typescript
// components/LLMUsageDashboard.tsx

interface LLMUsageDashboardProps {
  tenantId: string;
  period?: 'day' | 'week' | 'month';
}

export function LLMUsageDashboard({ tenantId, period = 'month' }: LLMUsageDashboardProps) {
  const { data: stats, isLoading } = useSWR(
    `/api/v1/usage/summary?tenant_id=${tenantId}&period=${period}`,
    fetcher
  );
  
  if (isLoading) return <LoadingSkeleton />;
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Custo do Mês"
          value={formatCurrency(stats.totals.cost)}
          trend={stats.trends?.cost}
          icon={<DollarSign />}
        />
        <StatCard
          title="Requests"
          value={formatNumber(stats.totals.requests)}
          trend={stats.trends?.requests}
          icon={<Activity />}
        />
        <StatCard
          title="Tokens"
          value={formatNumber(stats.totals.tokens)}
          trend={stats.trends?.tokens}
          icon={<Cpu />}
        />
      </div>
      
      {/* Budget Progress */}
      {stats.budget && (
        <BudgetProgress
          current={stats.budget.current_usage}
          limit={stats.budget.monthly_limit}
          projected={stats.budget.projected_end_of_month}
        />
      )}
      
      {/* Daily Chart */}
      <DailyUsageChart data={stats.by_day} />
      
      {/* Breakdowns */}
      <div className="grid grid-cols-2 gap-4">
        <UsageByAgent data={stats.by_agent} />
        <UsageByModel data={stats.by_model} />
      </div>
      
      {/* Alerts */}
      <RecentAlerts tenantId={tenantId} />
    </div>
  );
}
```

---

## 10. Implementação

### 10.1 Fases

| Fase | Escopo | Prazo | Status |
|------|--------|-------|--------|
| **1. Core** | Schema, Router, Basic Tracking | 1 semana | 🔲 |
| **2. Protection** | Rate Limiting, Circuit Breaker | 1 semana | 🔲 |
| **3. Alerting** | Sistema de alertas, notificações | 1 semana | 🔲 |
| **4. Dashboard** | UI de consumo, relatórios | 1 semana | 🔲 |
| **5. Polish** | Otimizações, testes, docs | 1 semana | 🔲 |

### 10.2 Estrutura de Diretórios

```
src/
├── llm-gateway/
│   ├── index.ts              # Entry point
│   ├── router.ts             # Provider selection logic
│   ├── tracker.ts            # Usage tracking
│   ├── rate-limiter.ts       # Rate limiting
│   ├── circuit-breaker.ts    # Circuit breaker
│   ├── alerter.ts            # Alert system
│   ├── providers/
│   │   ├── base.ts           # Base provider interface
│   │   ├── claude-max.ts     # Claude Max implementation
│   │   ├── claude-api.ts     # Claude API implementation
│   │   └── index.ts          # Provider registry
│   ├── api/
│   │   ├── completions.ts    # POST /api/v1/llm/completions
│   │   ├── usage.ts          # Usage endpoints
│   │   ├── providers.ts      # Provider management
│   │   └── admin.ts          # Admin endpoints
│   └── utils/
│       ├── cost-calculator.ts
│       ├── token-counter.ts
│       └── notifications.ts
├── components/
│   └── llm-dashboard/
│       ├── LLMUsageDashboard.tsx
│       ├── BudgetProgress.tsx
│       ├── UsageChart.tsx
│       └── AlertsList.tsx
└── prisma/
    └── schema.prisma         # Models adicionados
```

### 10.3 Configuração Inicial (Seed)

```typescript
// prisma/seed-llm-gateway.ts

async function seedLLMGateway() {
  // 1. Criar providers
  await prisma.lLMProvider.createMany({
    data: [
      {
        name: 'max-1',
        type: 'CLAUDE_MAX',
        model: 'claude-sonnet-4-20250514',
        priority: 1,
        rateLimit: 60,
        concurrency: 5,
        costPerInputToken: 0,  // Max é custo fixo
        costPerOutputToken: 0,
        status: 'ACTIVE'
      },
      {
        name: 'max-2',
        type: 'CLAUDE_MAX',
        model: 'claude-sonnet-4-20250514',
        priority: 2,
        rateLimit: 60,
        concurrency: 5,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        status: 'ACTIVE'
      },
      {
        name: 'api-paid',
        type: 'CLAUDE_API',
        model: 'claude-sonnet-4-20250514',
        priority: 3,
        rateLimit: 1000,
        concurrency: 50,
        costPerInputToken: 0.000003,   // $3/1M
        costPerOutputToken: 0.000015,  // $15/1M
        status: 'ACTIVE'
      }
    ]
  });
  
  // 2. Criar tenant inicial (VM Deco)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'VM Deco',
      slug: 'vm-deco',
      monthlyBudget: 1000,  // $1000/mês
      dailyLimit: 150,       // $150/dia
      alertThresholds: [0.20, 0.10, 0.05, 0.01]
    }
  });
  
  // 3. Criar agentes da alcateia
  const agentes = [
    { name: 'Lobo', role: 'coordinator' },
    { name: 'Águia', role: 'monitor' },
    { name: 'Coruja', role: 'researcher' },
    { name: 'Raposa', role: 'strategist' },
    { name: 'Falcão', role: 'executor' },
    { name: 'Golfinho', role: 'communicator' },
    { name: 'Pantera', role: 'security' },
    { name: 'Castor', role: 'builder' },
    { name: 'Cão', role: 'assistant' },
    { name: 'Arara', role: 'creative' }
  ];
  
  await prisma.tenantAgent.createMany({
    data: agentes.map(a => ({
      ...a,
      tenantId: tenant.id,
      preferredModel: 'claude-sonnet-4-20250514'
    }))
  });
  
  console.log('✅ LLM Gateway seeded successfully');
}
```

---

## 📚 Referências

- [Clawdbot atual] - Sistema de 2 Max + API fallback já implementado
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

*Especificação criada em 2026-01-31 | Lobo 🐺*
