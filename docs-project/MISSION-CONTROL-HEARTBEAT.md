# 💓 Sistema de Heartbeat - Mission Control

> Especificação técnica para monitoramento proativo de agentes
> 
> **Versão:** 1.0 | **Data:** 2026-02-01

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Configuração de Cron Jobs Escalonados](#configuração-de-cron-jobs-escalonados)
4. [O que Cada Heartbeat Verifica](#o-que-cada-heartbeat-verifica)
5. [Protocolo de Resposta](#protocolo-de-resposta)
6. [Integração com Clawdbot](#integração-com-clawdbot)
7. [Dashboard de Monitoramento](#dashboard-de-monitoramento)
8. [Implementação](#implementação)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema de Heartbeat é o mecanismo de monitoramento proativo do Mission Control. Ele garante que todos os agentes estejam:
- **Vivos** - Respondendo a comandos
- **Saudáveis** - Sem erros ou degradação
- **Produtivos** - Executando tarefas quando necessário
- **Econômicos** - Não consumindo tokens desnecessariamente

### Princípios

1. **Escalonamento temporal** - Cada agente em minuto diferente para evitar picos
2. **Economia de tokens** - HEARTBEAT_OK quando não há trabalho (mínimo consumo)
3. **Proatividade** - Agentes fazem trabalho útil, não só "ping-pong"
4. **Observabilidade** - Tudo logado e monitorável no dashboard

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      MISSION CONTROL                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Scheduler  │───▶│  Heartbeat   │───▶│   Reporter   │      │
│  │   (Cron)     │    │   Handler    │    │   (Webhook)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL                             │   │
│  │  • heartbeat_logs  • agent_health  • alert_history       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Agent A    │     │  Agent B    │     │  Agent C    │
   │  (min :00)  │     │  (min :02)  │     │  (min :04)  │
   │             │     │             │     │             │
   │ HEARTBEAT   │     │ HEARTBEAT   │     │ HEARTBEAT   │
   │ .md         │     │ .md         │     │ .md         │
   └─────────────┘     └─────────────┘     └─────────────┘
```

---

## ⏰ Configuração de Cron Jobs Escalonados

### Por que escalonar?

Se todos os agentes tiverem heartbeat no mesmo minuto:
- ❌ Pico de carga no servidor
- ❌ Possível rate limit nas APIs
- ❌ Concorrência por recursos
- ❌ Difícil debugar problemas

### Fórmula de Escalonamento

```
minuto = (agent_index * 2) % 60
```

Para 30 agentes, cada um executa em minuto par diferente:
- Agente 0: minuto 00
- Agente 1: minuto 02
- Agente 2: minuto 04
- ...
- Agente 29: minuto 58

### Configuração por Tenant

```typescript
interface HeartbeatConfig {
  tenantId: string;
  agentId: string;
  
  // Timing
  intervalMinutes: number;     // Padrão: 30
  offsetMinute: number;        // Calculado automaticamente
  
  // Behavior
  quietHoursStart: string;     // "23:00"
  quietHoursEnd: string;       // "08:00"
  timezone: string;            // "America/Sao_Paulo"
  
  // Checks to perform
  checks: HeartbeatCheck[];
  
  // Alerting
  missedHeartbeatThreshold: number;  // Quantos misses antes de alertar
  alertChannels: AlertChannel[];
}

type HeartbeatCheck = 
  | 'inbox'           // Verificar emails/mensagens não lidas
  | 'calendar'        // Próximos eventos
  | 'mentions'        // Menções em redes sociais
  | 'tasks'           // Tarefas pendentes
  | 'memory'          // Manutenção de memória
  | 'health'          // Self-health check
  | 'custom';         // Definido no HEARTBEAT.md
```

### Exemplo de Cron Expression

```bash
# Agente 1 (cliente: Empresa X) - minuto 00, a cada 30 min
0,30 * * * * clawdbot trigger heartbeat --agent=empresa-x-main

# Agente 2 (cliente: Empresa Y) - minuto 02, a cada 30 min
2,32 * * * * clawdbot trigger heartbeat --agent=empresa-y-main

# Agente 3 (cliente: Empresa Z) - minuto 04, a cada 30 min
4,34 * * * * clawdbot trigger heartbeat --agent=empresa-z-main
```

### Auto-geração via Mission Control

```typescript
function generateCronSchedule(agents: Agent[]): CronJob[] {
  return agents.map((agent, index) => {
    const offsetMinute = (index * 2) % 60;
    const intervalMinutes = agent.heartbeatConfig?.intervalMinutes ?? 30;
    
    // Para intervalo de 30 min: minuto X e minuto X+30
    const minutes = Array.from(
      { length: Math.floor(60 / intervalMinutes) },
      (_, i) => (offsetMinute + i * intervalMinutes) % 60
    ).join(',');
    
    return {
      agentId: agent.id,
      expression: `${minutes} * * * *`,
      command: `clawdbot trigger heartbeat --agent=${agent.id}`,
      timezone: agent.heartbeatConfig?.timezone ?? 'UTC'
    };
  });
}
```

---

## 🔍 O que Cada Heartbeat Verifica

### Checks Padrão (Todo Heartbeat)

```typescript
interface HeartbeatResult {
  agentId: string;
  timestamp: Date;
  status: 'ok' | 'working' | 'alert' | 'error';
  
  // Self-health
  health: {
    memoryUsageMb: number;
    lastErrorAt?: Date;
    uptimeSeconds: number;
  };
  
  // Work performed
  workDone: WorkItem[];
  
  // Alerts raised
  alerts: Alert[];
  
  // Response
  response: 'HEARTBEAT_OK' | string;  // OK ou descrição do trabalho
}
```

### Checks Configuráveis

| Check | O que verifica | Frequência sugerida |
|-------|---------------|---------------------|
| `inbox` | Emails/mensagens não lidas | 2-4x/dia |
| `calendar` | Eventos nas próximas 24h | 2x/dia |
| `mentions` | Twitter, Discord, etc. | 2-4x/dia |
| `tasks` | tasks.json, pendências | 1x/dia |
| `memory` | Manutenção de MEMORY.md | 1x/semana |
| `health` | Self-diagnostics | Todo heartbeat |
| `custom` | HEARTBEAT.md do workspace | Todo heartbeat |

### HEARTBEAT.md - Checklist do Agente

Cada agente pode ter um `HEARTBEAT.md` no seu workspace com tarefas específicas:

```markdown
# HEARTBEAT.md

## Checks obrigatórios
- [ ] Verificar pedidos pendentes no sistema
- [ ] Checar estoque de produtos críticos
- [ ] Revisar tickets de suporte abertos >24h

## Se for segunda-feira
- [ ] Gerar relatório semanal
- [ ] Enviar resumo para gestores

## Se encontrar problema
- Alertar via WhatsApp grupo "Alertas"
- Logar em memory/incidents/
```

### Rotação de Checks

Para economizar tokens, nem todos os checks rodam em todo heartbeat:

```typescript
function shouldRunCheck(
  check: HeartbeatCheck, 
  lastRun: Date | null,
  currentTime: Date
): boolean {
  const intervals: Record<HeartbeatCheck, number> = {
    'health': 0,          // Sempre
    'custom': 0,          // Sempre (é leve)
    'inbox': 4 * 60,      // 4 horas
    'calendar': 6 * 60,   // 6 horas
    'mentions': 4 * 60,   // 4 horas
    'tasks': 24 * 60,     // 24 horas
    'memory': 7 * 24 * 60 // 7 dias
  };
  
  if (!lastRun) return true;
  
  const minutesSinceLastRun = 
    (currentTime.getTime() - lastRun.getTime()) / (1000 * 60);
  
  return minutesSinceLastRun >= intervals[check];
}
```

---

## 📤 Protocolo de Resposta

### HEARTBEAT_OK

Quando **nenhum trabalho** foi feito e **nenhum alerta** foi gerado:

```
HEARTBEAT_OK
```

**Características:**
- Mínimo consumo de tokens (~50-100 tokens total)
- Rápido (< 5 segundos)
- Indica que o agente está vivo e não há pendências

### Trabalho Realizado

Quando o agente **fez algo útil**:

```
HEARTBEAT: Trabalho realizado

✅ Verificado 3 emails - nenhum urgente
✅ Próximo evento: Reunião com cliente às 14:00
📊 Gerado relatório semanal (anexo enviado)
```

### Alerta

Quando algo requer **atenção humana**:

```
HEARTBEAT: ⚠️ ALERTA

🔴 Email urgente de [Cliente X] há 2h sem resposta
🔴 Ticket #1234 aberto há 48h (SLA violado)

Ação sugerida: Verificar caixa de suporte
```

### Erro

Quando o agente **não conseguiu completar** o heartbeat:

```
HEARTBEAT: ❌ ERRO

Falha ao verificar emails: Connection refused
Último email check: há 6 horas

Stack: [erro técnico]
```

### Schema de Resposta (JSON)

Para integração programática:

```json
{
  "type": "heartbeat",
  "status": "ok" | "working" | "alert" | "error",
  "timestamp": "2026-02-01T15:30:00Z",
  "agentId": "empresa-x-main",
  "tenantId": "tenant_abc123",
  
  "health": {
    "alive": true,
    "memoryMb": 256,
    "uptimeSeconds": 86400
  },
  
  "checks": {
    "inbox": { "status": "ok", "lastRun": "2026-02-01T12:00:00Z" },
    "calendar": { "status": "ok", "lastRun": "2026-02-01T09:00:00Z" }
  },
  
  "workItems": [
    { "type": "report", "description": "Relatório semanal gerado" }
  ],
  
  "alerts": [],
  
  "tokensUsed": 150,
  "durationMs": 3200,
  
  "humanReadable": "HEARTBEAT_OK"
}
```

---

## 🔌 Integração com Clawdbot

### Trigger via CLI

```bash
# Heartbeat simples
clawdbot trigger heartbeat --agent=main

# Com canal de resposta
clawdbot trigger heartbeat --agent=main --channel=webhook

# Forçar todos os checks
clawdbot trigger heartbeat --agent=main --force-all-checks
```

### Configuração no clawdbot.json

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "heartbeat": {
          "enabled": true,
          "intervalMinutes": 30,
          "prompt": "Read HEARTBEAT.md if it exists. Follow it strictly. If nothing needs attention, reply HEARTBEAT_OK.",
          "checks": ["health", "inbox", "calendar", "custom"],
          "quietHours": {
            "start": "23:00",
            "end": "08:00",
            "timezone": "America/Sao_Paulo"
          },
          "webhook": "https://mission-control.example.com/api/heartbeat"
        }
      }
    ]
  }
}
```

### Webhook de Resposta

Mission Control recebe os resultados via webhook:

```typescript
// POST /api/heartbeat
interface HeartbeatWebhook {
  agentId: string;
  tenantId: string;
  timestamp: string;
  status: 'ok' | 'working' | 'alert' | 'error';
  response: string;
  metrics: {
    tokensUsed: number;
    durationMs: number;
  };
  alerts?: Alert[];
}
```

### Cron Nativo do Clawdbot

O Clawdbot já suporta cron jobs nativos:

```bash
# Criar heartbeat cron
clawdbot cron add \
  --name="heartbeat-empresa-x" \
  --schedule="0,30 * * * *" \
  --agent=empresa-x-main \
  --message="Read HEARTBEAT.md. If nothing needs attention, reply HEARTBEAT_OK." \
  --channel=webhook:https://mission-control.example.com/api/heartbeat
```

### Integração com Sistema Existente de Cron

```bash
# Listar crons atuais
clawdbot cron list

# Output:
# ID         Name                     Schedule      Next      Status
# 427fcc6a   daily-logistics-filipe   0 10 * * *    in 19h    ok
# db6bd6a5   morning-briefing-pablo   0 11 * * *    in 20h    ok
# ...
```

---

## 📊 Dashboard de Monitoramento

### Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│  💓 Heartbeat Monitor                              [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │    15      │  │     2      │  │     1      │            │
│  │  Healthy   │  │  Working   │  │   Alert    │            │
│  │   🟢       │  │    🔵      │  │    🟡      │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Agent             Last Beat    Status    Tokens  Cost   ││
│  │─────────────────────────────────────────────────────────││
│  │ empresa-x-main    2 min ago    🟢 OK     150     $0.01  ││
│  │ empresa-y-main    5 min ago    🔵 Work   1.2k    $0.08  ││
│  │ empresa-z-main    8 min ago    🟡 Alert  200     $0.01  ││
│  │ empresa-w-main    35 min ago   🔴 MISS   -       -      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Métricas Chave

| Métrica | Descrição | Alerta se |
|---------|-----------|-----------|
| `heartbeat_success_rate` | % de heartbeats OK | < 95% |
| `heartbeat_latency_p95` | Tempo de resposta | > 30s |
| `heartbeat_token_avg` | Tokens médios por heartbeat | > 500 |
| `heartbeat_missed_count` | Heartbeats perdidos | > 2 consecutivos |
| `heartbeat_alert_rate` | % de heartbeats com alerta | > 10% |

### Schema do Banco

```sql
-- Tabela de logs de heartbeat
CREATE TABLE heartbeat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  
  -- Timing
  scheduled_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Result
  status VARCHAR(50) NOT NULL, -- 'ok', 'working', 'alert', 'error', 'missed'
  response TEXT,
  
  -- Metrics
  tokens_used INTEGER,
  duration_ms INTEGER,
  cost_usd DECIMAL(10, 6),
  
  -- Checks performed
  checks_performed JSONB,
  
  -- Alerts
  alerts JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_heartbeat_tenant_agent (tenant_id, agent_id),
  INDEX idx_heartbeat_status (status),
  INDEX idx_heartbeat_scheduled (scheduled_at)
);

-- Tabela de estado de saúde do agente (agregado)
CREATE TABLE agent_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Current status
  current_status VARCHAR(50) NOT NULL,
  last_heartbeat_at TIMESTAMP,
  consecutive_misses INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  
  -- Rolling metrics (last 24h)
  success_rate_24h DECIMAL(5, 2),
  avg_tokens_24h INTEGER,
  avg_latency_ms_24h INTEGER,
  
  -- Totals
  total_heartbeats INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de alertas
CREATE TABLE heartbeat_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  heartbeat_log_id UUID REFERENCES heartbeat_logs(id),
  
  severity VARCHAR(50) NOT NULL, -- 'info', 'warning', 'critical'
  type VARCHAR(100) NOT NULL,    -- 'missed_heartbeat', 'high_latency', 'error', 'custom'
  message TEXT NOT NULL,
  
  -- Resolution
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMP,
  resolution_note TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

```typescript
// GET /api/admin/heartbeat/overview
interface HeartbeatOverview {
  totalAgents: number;
  healthy: number;
  working: number;
  alert: number;
  missed: number;
  
  metrics24h: {
    totalHeartbeats: number;
    successRate: number;
    avgTokens: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  };
}

// GET /api/admin/heartbeat/agents
interface AgentHeartbeatStatus {
  agentId: string;
  agentName: string;
  currentStatus: 'healthy' | 'working' | 'alert' | 'missed' | 'error';
  lastHeartbeatAt: string;
  nextScheduledAt: string;
  consecutiveMisses: number;
  metrics: {
    successRate24h: number;
    avgTokens24h: number;
    avgLatencyMs24h: number;
  };
}

// GET /api/admin/heartbeat/logs/:agentId
interface HeartbeatLog {
  id: string;
  scheduledAt: string;
  receivedAt: string;
  status: string;
  response: string;
  tokensUsed: number;
  durationMs: number;
  checksPerformed: string[];
  alerts: Alert[];
}

// POST /api/admin/heartbeat/trigger/:agentId
// Força um heartbeat imediato

// PUT /api/admin/heartbeat/config/:agentId
// Atualiza configuração de heartbeat
```

### Componente React

```tsx
// components/HeartbeatMonitor.tsx
export function HeartbeatMonitor() {
  const { data, isLoading } = useHeartbeatOverview();
  
  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatusCard 
          title="Healthy" 
          value={data?.healthy} 
          icon="🟢" 
        />
        <StatusCard 
          title="Working" 
          value={data?.working} 
          icon="🔵" 
        />
        <StatusCard 
          title="Alert" 
          value={data?.alert} 
          icon="🟡" 
        />
        <StatusCard 
          title="Missed" 
          value={data?.missed} 
          icon="🔴" 
        />
      </div>
      
      {/* Agent Table */}
      <AgentHeartbeatTable />
      
      {/* Timeline */}
      <HeartbeatTimeline />
    </div>
  );
}
```

---

## 🛠️ Implementação

### Fase 1: Básico (Semana 1)

1. **Schema do banco**
   ```bash
   npx prisma migrate dev --name add_heartbeat_tables
   ```

2. **Webhook receiver**
   ```typescript
   // app/api/heartbeat/route.ts
   export async function POST(req: Request) {
     const payload = await req.json();
     
     await db.heartbeatLog.create({
       data: {
         tenantId: payload.tenantId,
         agentId: payload.agentId,
         status: payload.status,
         response: payload.response,
         tokensUsed: payload.metrics?.tokensUsed,
         durationMs: payload.metrics?.durationMs,
       }
     });
     
     // Atualizar status agregado
     await updateAgentHealth(payload.agentId, payload);
     
     // Verificar se precisa alertar
     if (payload.status === 'alert' || payload.alerts?.length) {
       await createAlerts(payload);
     }
     
     return Response.json({ received: true });
   }
   ```

3. **Detector de missed heartbeats**
   ```typescript
   // Cron a cada 5 minutos
   async function checkMissedHeartbeats() {
     const threshold = subMinutes(new Date(), 35); // 30 min + 5 buffer
     
     const agents = await db.agentHealth.findMany({
       where: {
         lastHeartbeatAt: { lt: threshold },
         // Não em quiet hours
       }
     });
     
     for (const agent of agents) {
       await db.agentHealth.update({
         where: { id: agent.id },
         data: { 
           consecutiveMisses: { increment: 1 },
           currentStatus: 'missed'
         }
       });
       
       if (agent.consecutiveMisses >= 2) {
         await sendAlert(agent, 'Heartbeat perdido por 2+ ciclos');
       }
     }
   }
   ```

### Fase 2: Dashboard (Semana 2)

1. **Página de overview**
2. **Lista de agentes com status**
3. **Histórico de heartbeats por agente**
4. **Gráficos de tendência**

### Fase 3: Alertas (Semana 3)

1. **Notificações WhatsApp**
2. **Email alerts**
3. **Webhook para integrações**
4. **Escalation rules**

### Fase 4: Automação (Semana 4)

1. **Auto-restart de agentes problemáticos**
2. **Config rollback se erros persistirem**
3. **Smart scheduling baseado em padrões**

---

## 🔧 Troubleshooting

### Heartbeat não chega

1. **Verificar se cron está rodando:**
   ```bash
   clawdbot cron list
   ```

2. **Verificar webhook URL:**
   ```bash
   curl -X POST https://mission-control.example.com/api/heartbeat \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

3. **Verificar logs do agente:**
   ```bash
   clawdbot logs --agent=empresa-x-main --tail=50
   ```

### Heartbeat muito lento (> 30s)

1. **Reduzir checks:**
   - Remover checks não essenciais
   - Aumentar intervalo entre checks completos

2. **Verificar HEARTBEAT.md:**
   - Simplificar instruções
   - Remover tarefas pesadas

3. **Considerar modelo mais rápido:**
   - Sonnet em vez de Opus para heartbeats

### Muitos tokens consumidos

1. **Verificar prompt:**
   - Deve ser conciso
   - "HEARTBEAT_OK" deve ser o caminho feliz

2. **Verificar HEARTBEAT.md:**
   - Muito longo = muito token
   - Manter < 500 palavras

3. **Ajustar frequência:**
   - 30 min em vez de 15 min
   - Quiet hours mais longos

### Alertas demais

1. **Revisar thresholds:**
   ```typescript
   // Antes
   missedHeartbeatThreshold: 1  // Alerta no primeiro miss
   
   // Depois
   missedHeartbeatThreshold: 2  // Alerta após 2 misses
   ```

2. **Configurar quiet hours:**
   - Evitar alertas noturnos
   - Considerar fuso horário do cliente

3. **Agrupar alertas:**
   - Digest em vez de individual
   - Rate limiting de notificações

---

## 📚 Referências

- [AGENTS.md - Seção Heartbeats](/root/clawd/AGENTS.md)
- [ADMIN-AGENT-ARCHITECTURE.md](./ADMIN-AGENT-ARCHITECTURE.md)
- [PLANO-INTEGRADO-BAAS.md](./PLANO-INTEGRADO-BAAS.md)
- [Clawdbot Cron Documentation](https://docs.clawdbot.com/cron)

---

## ✅ Checklist de Implementação

- [ ] Criar tabelas no Prisma (heartbeat_logs, agent_health, heartbeat_alerts)
- [ ] Implementar webhook receiver `/api/heartbeat`
- [ ] Criar detector de missed heartbeats (cron 5 min)
- [ ] Dashboard de overview com cards de status
- [ ] Lista de agentes com indicadores visuais
- [ ] Histórico de heartbeats por agente
- [ ] Sistema de alertas (WhatsApp/Email)
- [ ] Integração com Clawdbot cron nativo
- [ ] Auto-geração de schedules escalonados
- [ ] Página de configuração por agente

---

*Documento criado em 2026-02-01 | Lobo 🐺*
