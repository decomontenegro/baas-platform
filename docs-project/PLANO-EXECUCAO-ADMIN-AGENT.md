# Plano de Execução - Admin Agent BaaS

## Visão Geral

O **Admin Agent** é o supervisor central que gerencia todos os bots de um cliente/empresa. Ele monitora, corrige automaticamente, e escala problemas quando necessário.

```
┌─────────────────────────────────────────────────────┐
│                    EMPRESA X                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────┐                                  │
│   │ ADMIN AGENT  │ ◄── Supervisiona tudo            │
│   │     🛡️       │                                  │
│   └──────┬───────┘                                  │
│          │                                          │
│    ┌─────┴─────┬─────────┬─────────┐               │
│    ▼           ▼         ▼         ▼               │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │
│ │ Bot  │  │ Bot  │  │ Bot  │  │ Bot  │            │
│ │Vendas│  │Suport│  │ RH   │  │Custom│            │
│ └──────┘  └──────┘  └──────┘  └──────┘            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Fase 1: Fundação (CONCLUÍDA)

### 1.1 Database Schema
- [x] Modelo `AdminAgent` - configuração por tenant
- [x] Modelo `BotHealthLog` - histórico de health checks
- [x] Modelo `AdminAlert` - sistema de alertas
- [x] Enums de status e severidade
- [x] Relações com Tenant e Bot

### 1.2 Core Services
- [x] `health-checker.ts` - Verifica saúde dos bots
- [x] `config-validator.ts` - Valida configs antes de aplicar
- [x] `emergency-access.ts` - Gerencia acessos de emergência
- [x] `system-health.ts` - Health check do sistema

### 1.3 APIs Básicas
- [x] `GET/POST /api/admin/health` - Status e check manual
- [x] `GET/PATCH /api/admin/alerts` - Gerenciar alertas
- [x] `GET/POST/DELETE /api/admin/setup` - Configurar admin agent
- [x] `GET /api/admin/emergency` - Status de acessos
- [x] `GET /api/health` - Health check público

### 1.4 UI Dashboard
- [x] Página `/admin` com cards de status
- [x] Configuração de alertas (email, WhatsApp)
- [x] Lista de alertas recentes
- [x] Link no sidebar

---

## 🔄 Fase 2: Automação (PRÓXIMA)

### 2.1 Cron Jobs
- [ ] Health check automático a cada 5 min
- [ ] Limpeza de logs antigos (>30 dias)
- [ ] Relatório diário de saúde

**Implementação:**
```typescript
// src/lib/admin-agent/cron.ts
import cron from 'node-cron'

// Health check a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  const tenants = await getAllActiveTenants()
  for (const tenant of tenants) {
    await runHealthCheckCycle(tenant.id)
  }
})

// Relatório diário às 9h
cron.schedule('0 9 * * *', async () => {
  await sendDailyHealthReport()
})
```

### 2.2 Auto-Restart Real
- [ ] Integrar com Clawdbot API para restart real
- [ ] Cooldown entre restarts (1 min)
- [ ] Limite de 3 tentativas

### 2.3 Config Rollback
- [ ] Detectar config inválida automaticamente
- [ ] Rollback para última config funcional
- [ ] Notificar admin sobre rollback

---

## 📢 Fase 3: Notificações (SEMANA 2)

### 3.1 Canais de Alerta
- [ ] Email via Resend/SendGrid
- [ ] WhatsApp via Clawdbot
- [ ] Webhook genérico
- [ ] Slack (opcional)

**Implementação:**
```typescript
// src/lib/admin-agent/notifier.ts
async function sendAlert(alert: AdminAlert, channels: string[]) {
  if (channels.includes('email')) {
    await sendEmail(alert)
  }
  if (channels.includes('whatsapp')) {
    await sendWhatsApp(alert)
  }
  if (channels.includes('webhook')) {
    await sendWebhook(alert)
  }
}
```

### 3.2 Níveis de Notificação
- INFO: Log apenas
- WARNING: Email
- ERROR: Email + Dashboard
- CRITICAL: Email + WhatsApp + Dashboard

### 3.3 Throttling
- [ ] Não enviar mesmo alerta 2x em 5 min
- [ ] Agrupar alertas similares
- [ ] Resumo se muitos alertas

---

## 📊 Fase 4: Métricas & Analytics (SEMANA 3)

### 4.1 Dashboard de Métricas
- [ ] Uptime por bot (últimos 7/30 dias)
- [ ] Tempo médio de resposta
- [ ] Taxa de erro
- [ ] Custo estimado (tokens)

### 4.2 Gráficos
- [ ] Linha: saúde ao longo do tempo
- [ ] Pizza: distribuição de status
- [ ] Barras: alertas por tipo

### 4.3 Relatórios
- [ ] Exportar PDF/CSV
- [ ] Envio automático semanal
- [ ] Comparativo período anterior

---

## 🔐 Fase 5: Segurança & Compliance (SEMANA 4)

### 5.1 Audit Log
- [ ] Registrar todas as ações do admin agent
- [ ] Quem fez o quê e quando
- [ ] Retenção configurável

### 5.2 Emergency Access
- [ ] UI para ver pontos de acesso
- [ ] Testar conectividade
- [ ] Alertar se backup offline

### 5.3 Compliance
- [ ] LGPD: retenção de dados
- [ ] Logs de acesso
- [ ] Anonimização quando necessário

---

## 🔄 Fase 6: Redundância de Contas (SEMANA 4)

### 6.1 Pool de Credenciais
O Admin Agent gerencia múltiplas contas de API para garantir disponibilidade.

```
┌─────────────────────────────────────────────────────┐
│              POOL DE CREDENCIAIS                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Plano MAX: até N contas OAuth + 1 API emergência   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ OAuth 1  │  │ OAuth 2  │  │ OAuth N  │          │
│  │  85% ✅  │  │  40% ✅  │  │ 100% ✅  │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │                 │
│       └──────┬──────┴─────────────┘                 │
│              ▼                                      │
│       ┌──────────────┐                              │
│       │ LOAD BALANCER│ ◄── Escolhe conta com       │
│       │   INTELIGENTE│     mais crédito disponível │
│       └──────┬───────┘                              │
│              │                                      │
│              ▼                                      │
│       ┌──────────────┐                              │
│       │  API KEY 💰  │ ◄── Emergência (paga)       │
│       │  (fallback)  │     Ativa quando todas      │
│       └──────────────┘     OAuth < 5%              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 6.2 Lógica de Seleção
```typescript
// src/lib/admin-agent/credential-pool.ts

interface Credential {
  id: string
  type: 'oauth' | 'api_key'
  usagePercent: number  // 0-100 (100 = cheio disponível)
  isEmergency: boolean
  lastUsed: Date
  dailyLimit: number
  dailyUsed: number
}

async function selectCredential(tenantId: string): Promise<Credential> {
  const pool = await getCredentialPool(tenantId)
  
  // 1. Filtrar OAuth com crédito disponível (>5%)
  const available = pool
    .filter(c => c.type === 'oauth' && c.usagePercent > 5)
    .sort((a, b) => b.usagePercent - a.usagePercent)
  
  if (available.length > 0) {
    // Usar a com mais crédito
    return available[0]
  }
  
  // 2. Todas OAuth esgotadas → Ativar API Key
  const emergency = pool.find(c => c.isEmergency)
  if (emergency) {
    await alertAdmin('OAUTH_EXHAUSTED', 'Usando API Key de emergência')
    return emergency
  }
  
  // 3. Sem fallback → Erro
  throw new Error('Sem credenciais disponíveis')
}
```

### 6.3 Configuração por Plano

| Plano | Contas OAuth | API Emergência | Rotação |
|-------|--------------|----------------|---------|
| Free | 0 | Não | - |
| Starter | 1 | Não | Manual |
| Pro | 3 | Sim | Auto |
| Max | 10+ | Sim | Auto + IA |

### 6.4 Features

- [ ] **Adicionar conta OAuth:** UI para vincular nova conta
- [ ] **Monitorar uso:** Dashboard mostra % restante de cada
- [ ] **Rotação automática:** Troca antes de esgotar
- [ ] **Alerta de threshold:** Avisa quando pool < 20%
- [ ] **API Key fallback:** Ativa automaticamente quando OAuth < 5%
- [ ] **Relatório de custos:** Quanto gastou na API paga

### 6.5 Alertas de Crédito

```
Pool em 50% → Log apenas
Pool em 20% → Email admin
Pool em 10% → Email + WhatsApp ⚠️
Pool em 5%  → Ativa API Key 🔄
Pool em 1%  → Alerta CRÍTICO 🚨
```

### 6.6 Database Schema Adicional

```prisma
model CredentialPool {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  type        CredentialType  // OAUTH, API_KEY
  provider    String          // anthropic, openai, etc
  
  // OAuth specific
  accessToken String?
  refreshToken String?
  expiresAt   DateTime?
  
  // API Key specific
  apiKey      String?
  
  // Usage tracking
  dailyLimit  Int       @default(1000000) // tokens or requests
  dailyUsed   Int       @default(0)
  usagePercent Float    @default(100)
  
  // Status
  isEmergency Boolean   @default(false)
  isActive    Boolean   @default(true)
  priority    Int       @default(0)  // Higher = preferred
  
  lastUsedAt  DateTime?
  lastCheckAt DateTime?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum CredentialType {
  OAUTH
  API_KEY
}
```

---

## 🏗️ Fase 7: DevOps & CI/CD (SEMANA 5)

### 7.1 Build em CI/CD (não no servidor)
- [ ] GitHub Actions para build
- [ ] Deploy automático no push para main
- [ ] Build em ambiente com mais RAM (evita OOM)
- [ ] Cache de node_modules e .next

**Workflow exemplo:**
```yaml
# .github/workflows/deploy.yml
name: Deploy BaaS
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: rsync -avz .next/standalone/ server:/app/
      - run: ssh server "pm2 restart baas"
```

### 7.2 Infraestrutura
- [ ] Configurar swap no servidor (evita OOM)
- [ ] PM2 com cluster mode
- [ ] Nginx como reverse proxy (opcional)
- [ ] SSL automático via Cloudflare

### 7.3 Logs Estruturados
- [ ] Formato JSON para logs
- [ ] Níveis: debug, info, warn, error
- [ ] Correlation ID por request
- [ ] Integração com serviço de logs (opcional: Axiom, Logtail)

**Implementação:**
```typescript
// src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
})

// Uso: logger.info({ tenantId, botId }, 'Health check completed')
```

---

## 🎨 Fase 8: Personalização do Admin Agent (SEMANA 5)

### 8.1 Personalidade Configurável
O Admin Agent pode ter diferentes "vozes" dependendo da preferência do cliente.

- [ ] Tom: Formal / Casual / Técnico
- [ ] Frequência de alertas: Alta / Média / Baixa
- [ ] Idioma: PT-BR / EN / ES
- [ ] Emoji: Sim / Não

**Configuração:**
```typescript
interface AdminAgentPersonality {
  tone: 'formal' | 'casual' | 'technical'
  alertFrequency: 'high' | 'medium' | 'low'
  language: 'pt-BR' | 'en' | 'es'
  useEmoji: boolean
  greeting?: string  // "Olá!" / "Hey!" / custom
}
```

### 8.2 Templates de Mensagem
- [ ] Alertas customizáveis
- [ ] Relatórios com branding do cliente
- [ ] Assinatura personalizada

### 8.3 Horários de Notificação
- [ ] Horário comercial (não perturbar à noite)
- [ ] Timezone do cliente
- [ ] Exceções para CRITICAL (sempre notifica)

---

## 🚀 Fase 9: Escalabilidade (SEMANA 6+)

### 9.1 Multi-Tenant
- [ ] Isolamento completo entre tenants
- [ ] Limites por plano
- [ ] Queue de health checks

### 6.2 Performance
- [ ] Cache de status (Redis)
- [ ] Health checks em paralelo
- [ ] Rate limiting

### 6.3 Integração Clawdbot
- [ ] API bidirecional
- [ ] Eventos em tempo real (WebSocket)
- [ ] Sync de configurações

---

## 📋 Checklist de Entrega

### MVP (Semana 1) ✅
- [x] Schema e migrations
- [x] APIs básicas
- [x] UI de configuração
- [x] Health check manual

### Beta (Semana 2)
- [ ] Health check automático
- [ ] Alertas por email
- [ ] Auto-restart básico

### v1.0 (Semana 3)
- [ ] Alertas WhatsApp
- [ ] Dashboard de métricas
- [ ] Relatórios

### v1.1 (Semana 4)
- [ ] Audit log
- [ ] Emergency access UI
- [ ] Config rollback automático
- [ ] Pool de credenciais (múltiplas OAuth)
- [ ] API Key de emergência (fallback pago)
- [ ] Rotação automática de contas

### v1.2 (Semana 5)
- [ ] CI/CD com GitHub Actions
- [ ] Logs estruturados (JSON)
- [ ] Personalidade configurável
- [ ] Horários de notificação

---

## 🎯 KPIs de Sucesso

| Métrica | Meta |
|---------|------|
| Tempo de detecção de problema | < 5 min |
| Taxa de auto-recovery | > 80% |
| Alertas falsos positivos | < 5% |
| Uptime dos bots | > 99.5% |
| Satisfação do admin | > 4.5/5 |

---

## 📁 Estrutura de Arquivos

```
src/
├── app/
│   ├── api/
│   │   └── admin/
│   │       ├── health/route.ts      ✅
│   │       ├── alerts/route.ts      ✅
│   │       ├── setup/route.ts       ✅
│   │       ├── emergency/route.ts   ✅
│   │       ├── metrics/route.ts     🔲
│   │       └── audit/route.ts       🔲
│   └── (dashboard)/
│       └── admin/
│           ├── page.tsx             ✅
│           ├── metrics/page.tsx     🔲
│           └── audit/page.tsx       🔲
├── lib/
│   └── admin-agent/
│       ├── index.ts                 ✅
│       ├── health-checker.ts        ✅
│       ├── config-validator.ts      ✅
│       ├── emergency-access.ts      ✅
│       ├── system-health.ts         ✅
│       ├── cron.ts                  ✅ (teste multi-agente)
│       ├── notifiers/
│       │   ├── index.ts             🔄 (em progresso)
│       │   ├── email.ts             🔄
│       │   ├── whatsapp.ts          🔄
│       │   └── webhook.ts           🔄
│       ├── credential-pool.ts       🔲
│       ├── personality.ts           🔲
│       ├── logger.ts                🔲
│       └── metrics.ts               🔲
├── .github/
│   └── workflows/
│       └── deploy.yml               🔲
└── prisma/
    └── schema.prisma                ✅ (AdminAgent models)
```

---

## 💰 Diferencial Competitivo

**Concorrentes vendem:** "Crie chatbots"

**BaaS vende:** "Infraestrutura de agentes autônomos com supervisão inteligente"

O Admin Agent transforma o BaaS de uma ferramenta em uma **plataforma gerenciada** onde:
1. Problemas são detectados antes do cliente perceber
2. Recuperação é automática na maioria dos casos
3. Admin é notificado só quando precisa intervir
4. Tudo é auditado e documentado
5. **Créditos nunca acabam** - pool de contas com fallback automático
6. **Zero downtime** - rotação transparente entre credenciais

---

*Plano criado em 31/01/2026 | Lobo 🐺*
