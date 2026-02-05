# 🎯 Plano Integrado BaaS - Bot-as-a-Service

> Consolidação de todas as sessões de discussão (27-31 Jan 2026)
> 
> **Visão:** Dashboard de gestão para Clawdbot com UX excepcional + controle de custos

---

## 📐 Arquitetura Central

```
┌─────────────────────────────────────────────────────────────┐
│                    BaaS Dashboard                            │
│         (UI de configuração + analytics + billing)           │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Config   │  │ Analytics│  │ Billing  │
        │ Editor   │  │ Reader   │  │ Control  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                   🚀 LLM GATEWAY                             │
│        (Hub centralizado de consumo multi-tenant)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Router     │  Tracker    │  Alerter   │  Rate Limit │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌─────────────┬─────────────┬─────────────────────────┐    │
│  │   Max #1    │   Max #2    │     API Paga            │    │
│  │  (Primary)  │ (Fallback)  │  (Final Fallback)       │    │
│  └─────────────┴─────────────┴─────────────────────────┘    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Clawdbot Gateway                          │
│              (Engine real - já faz tudo)                     │
│  • Mensagens  • Skills  • Multi-agente  • WhatsApp/Telegram │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Tenant:  │  │ Tenant:  │  │ Tenant:  │
        │ VM Deco  │  │ Liqi     │  │ R2       │ ...
        │(Alcateia)│  │(Fintech) │  │(Proptech)│
        └──────────┘  └──────────┘  └──────────┘
```

**Princípios:**
- BaaS é GUI do Clawdbot, não substituto. Foco em UX e controle, não em reimplementar.
- **LLM Gateway** centraliza todo consumo de LLM com tracking por tenant
- Todos os tenants compartilham o mesmo pool de providers (2 Max + API)

---

## 🎯 Objetivos do Produto

### 1. UX Melhorada
Transformar edição de JSON em interfaces intuitivas com toggles, dropdowns e wizards.

### 2. Controle de Custos
Visibilidade total de gastos + ferramentas para otimizar consumo de créditos.

### 3. Multi-tenancy
Permitir múltiplos clientes, cada um com seus bots e configs.

### 4. Monitoramento
Health checks, alertas, auto-recovery via Admin Agent.

---

## 📋 Backlog Consolidado

### Épico 1: Dashboard Core ✅ (80% completo)

| Feature | Status | Descrição |
|---------|--------|-----------|
| Login/Auth | ✅ | Magic link via Resend |
| Sidebar navegação | ✅ | Links para todas as seções |
| Dashboard overview | 🔧 | Cards de resumo (falta dados reais) |
| Analytics | ✅ | Gráficos de uso, custo, performance |
| Conversations | ✅ | Lista de conversas do Clawdbot |
| Knowledge Base | ✅ | Upload de docs (estrutura pronta) |
| Team management | ✅ | Convites, roles |
| Settings | 🔧 | Mockado, falta conectar |
| Billing | 🔧 | Falta integrar Stripe |

### Épico 2: Config Visual (PRIORIDADE)

| Feature | Prioridade | Descrição |
|---------|------------|-----------|
| **Grupos WhatsApp** | 🔴 Alta | Lista de grupos + toggle requireMention |
| **Identidade do bot** | 🔴 Alta | Nome, emoji, avatar |
| **Modelo padrão** | 🔴 Alta | Dropdown Opus/Sonnet/Haiku |
| **Mention patterns** | 🔴 Alta | Tags input @lobo, @bot |
| **Bindings** | 🔴 Alta | Rotear grupo → agente específico |
| **Skills toggle** | 🟡 Média | TTS, STT, Image gen, Search |
| **System prompt** | 🟡 Média | Editor de personalidade |
| **DM/Group policies** | 🟡 Média | Allowlist, open, block |

### Épico 3: Controle de Custos (PRIORIDADE)

| Feature | Prioridade | Descrição |
|---------|------------|-----------|
| **Custo por canal** | 🔴 Alta | "Grupo X gastou $50" |
| **Custo por modelo** | 🔴 Alta | Opus vs Sonnet breakdown |
| **Projeção mensal** | 🔴 Alta | Estimar gasto baseado em tendência |
| **Alertas de budget** | 🔴 Alta | Notificar em 50%, 80%, 95% |
| **Limite diário** | 🟡 Média | Pausar bot se passar de $X |
| **Auto-downgrade** | 🟡 Média | Opus → Sonnet se budget baixo |
| **Model picker por grupo** | 🟡 Média | Grupos VIP = Opus |

### Épico 4: Admin Agent (Fase 1 ✅)

| Feature | Status | Descrição |
|---------|--------|-----------|
| Health checker | ✅ | Verifica saúde dos bots |
| Config validator | ✅ | Valida antes de aplicar |
| Emergency access | ✅ | Tailscale + ttyd |
| Alerts básicos | ✅ | Lista de alertas |
| **Cron automático** | 🔲 | Health check a cada 5min |
| **Auto-restart** | 🔲 | Restart real via Clawdbot API |
| **Config rollback** | 🔲 | Reverter config inválida |
| **Notificações** | 🔲 | WhatsApp/Email/Slack |

### Épico 5: Multi-agente

| Feature | Prioridade | Descrição |
|---------|------------|-----------|
| Lista de bots | 🟡 Média | Cards com status online/offline |
| Criar novo bot | 🟡 Média | Wizard de criação |
| Duplicar bot | 🟢 Baixa | Clone de config |
| Bot templates | 🟢 Baixa | Vendas, Suporte, RH |

### Épico 6: Data Sync

| Feature | Status | Descrição |
|---------|--------|-----------|
| Importar transcripts | ✅ | Script sync-clawdbot-full.js |
| Importar grupos | 🔲 | 33 grupos → Channels table |
| Sync automático | 🔲 | Cron de sync Clawdbot→BaaS |
| Webhook real-time | 🔧 | Parcialmente implementado |

### Épico 7: LLM Gateway (CRÍTICO - Multi-tenancy)

> **Documentação completa:** `LLM-GATEWAY.md`

| Feature | Prioridade | Descrição |
|---------|------------|-----------|
| **Schema Prisma** | 🔴 Alta | Tenant, TenantAgent, LLMProvider, LLMUsage, UsageAlert |
| **Router Core** | 🔴 Alta | Lógica Max1 → Max2 → API paga |
| **Tracker** | 🔴 Alta | Registro de uso por tenant/agente |
| **Rate Limiting** | 🔴 Alta | Limites por tenant, agente, provider |
| **Circuit Breaker** | 🔴 Alta | Proteção contra falhas de provider |
| **Sistema de Alertas** | 🔴 Alta | Alertas em 20%, 10%, 5%, 1% restante |
| **API Gateway** | 🟡 Média | POST /api/v1/llm/completions |
| **Dashboard de Consumo** | 🟡 Média | UI de tracking por tenant/agente |
| **Projeção de Custos** | 🟡 Média | Estimar fim do mês |
| **Export de Dados** | 🟢 Baixa | CSV/JSON de uso |

**Pool de Providers:**
- 2 contas Claude Max ($20/mês cada) - rotação/fallback
- 1 API Key paga - fallback final (pay-per-use)

**Primeiro Tenant:** VM do Deco
- Agentes: Lobo, Águia, Coruja, Raposa, Falcão, Golfinho, Pantera, Castor, Cão, Arara
- Budget inicial: $1000/mês

---

## 💰 Modelo de Negócio (Tiers)

### Proposta de Tiers por Modelo

```
┌─────────────────────────────────────────┐
│ 🆓 STARTER (Grátis)                     │
│ • Claude Haiku apenas                   │
│ • 500 msgs/mês                          │
│ • 1 grupo WhatsApp                      │
│ • Branding BaaS                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 💼 PRO (R$ 197/mês)                     │
│ • Claude Sonnet (padrão)                │
│ • 5.000 msgs/mês                        │
│ • 10 grupos WhatsApp                    │
│ • Sem branding                          │
│ • Suporte prioritário                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🚀 BUSINESS (R$ 497/mês)                │
│ • Claude Sonnet (padrão)                │
│ • Opus sob demanda (créditos)           │
│ • 20.000 msgs/mês                       │
│ • Grupos ilimitados                     │
│ • Multi-agente (até 5 bots)             │
│ • API access                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🏢 ENTERPRISE (R$ 1.997/mês)            │
│ • Claude Opus (padrão)                  │
│ • Ilimitado                             │
│ • Bots ilimitados                       │
│ • SLA 99.9%                             │
│ • Dedicated instance                    │
│ • Custom integrations                   │
└─────────────────────────────────────────┘
```

### Economia Estimada

| Cenário | Custo atual | Com Sonnet | Economia |
|---------|-------------|------------|----------|
| 100% Opus | $110/dia | - | - |
| 80% Sonnet / 20% Opus | - | $35/dia | 68% |
| 100% Sonnet | - | $22/dia | 80% |

---

## 🔧 Stack Técnica

### Atual
- **Frontend:** Next.js 14 + React + TailwindCSS + shadcn/ui
- **Backend:** Next.js API Routes + Prisma
- **Database:** PostgreSQL
- **Cache:** Redis
- **Auth:** NextAuth (magic link)
- **Deploy:** PM2 + Cloudflare Tunnel

### A integrar
- **Payments:** Stripe
- **Email:** Resend
- **Monitoring:** Axiom/Sentry
- **Analytics:** PostHog

---

## 📅 Roadmap

### Sprint 0 (Jan 31 - Fev 7): 🚀 LLM Gateway Core (PRIORIDADE)
> **Fundação para multi-tenancy** - Sem isso, não tem como escalar

- [ ] Schema Prisma (Tenant, TenantAgent, LLMProvider, LLMUsage, UsageAlert)
- [ ] Migração do banco
- [ ] Router básico (Max1 → Max2 → API)
- [ ] Tracker de uso por tenant/agente
- [ ] Rate Limiting por tenant
- [ ] Seed inicial (VM Deco + Alcateia como primeiro tenant)

### Sprint 1 (Fev 8-14): LLM Gateway Protection + Config Visual
- [ ] Circuit Breaker para providers
- [ ] Sistema de alertas (20%, 10%, 5%, 1%)
- [ ] Notificações (email + WhatsApp para críticos)
- [ ] Página `/bots/[id]/groups` - Gerenciar grupos WhatsApp
- [ ] Toggle requireMention por grupo
- [ ] Dropdown de modelo por grupo

### Sprint 2 (Fev 15-21): Dashboard de Consumo LLM
- [ ] UI de consumo por tenant (custo, tokens, requests)
- [ ] Gráficos de uso diário/semanal
- [ ] Breakdown por agente e modelo
- [ ] Projeção de fim de mês
- [ ] Lista de alertas com acknowledge

### Sprint 3 (Fev 22-28): Admin Agent Fase 2 + Billing
- [ ] Cron jobs automáticos
- [ ] Auto-restart real
- [ ] Config rollback
- [ ] Integrar Stripe
- [ ] Criar planos (Starter/Pro/Business/Enterprise)

### Sprint 4 (Mar 1-7): Multi-agente + Polish
- [ ] Criar/editar múltiplos bots
- [ ] Bindings visuais
- [ ] Bot templates
- [ ] Checkout flow
- [ ] Upgrade/downgrade

---

## 📊 Dados Atuais (Clawdbot)

```
Período: 27-31 Jan 2026 (5 dias)

Mensagens:
  Entrada:    2.616
  Saída:      5.638
  Total:      8.254

Tokens:       1.607.255
Custo:        $549.92
Média/dia:    $110

Canais:
  WhatsApp DM:         6.393 msgs ($550)
  Outros Grupos:       1.377 msgs
  Cultura Builder:       281 msgs
  Sócios Mentes:         120 msgs
  Advisors Dashboard:     93 msgs

Pico horário: 21:00 (1.275 msgs)
Satisfação:   +136 / -115

Grupos configurados: 33
Sessões:            75
Media files:        1.318
Tool calls:         3.077
```

---

## 🔑 Credenciais Disponíveis

| Serviço | Status | Onde |
|---------|--------|------|
| Anthropic API | ✅ | .env |
| Anthropic OAuth | ✅ | .env |
| OpenAI | ✅ | .env |
| Google AI (Gemini) | ✅ | .env |
| Brave Search | ✅ | .env |
| ElevenLabs (TTS) | ✅ | .env |
| Google Places | ✅ | .env |
| Google Service Account | ✅ | credentials/ |
| Resend (email) | ✅ | .env |
| Clawdbot Gateway | ✅ | .env |

---

## 📝 Decisões Pendentes

1. **Modelo padrão:** Trocar Lobo de Opus para Sonnet agora ou depois?
2. **Pricing final:** Valores dos tiers confirmados?
3. **Smart routing:** Implementar auto-detect de complexidade?
4. **Comando /opus:** Permitir forçar modelo por mensagem?
5. **Limites hard:** Pausar bot ou só alertar quando passar budget?

---

## 📚 Documentos Relacionados

| Doc | Conteúdo |
|-----|----------|
| `PRD.md` | Visão do produto, personas, user stories |
| `BUSINESS-MODEL.md` | Pricing, custos, break-even |
| `SECURITY-COMPLIANCE.md` | LGPD, segurança |
| `ADMIN-AGENT-ARCHITECTURE.md` | Arquitetura do supervisor |
| `PLANO-EXECUCAO-ADMIN-AGENT.md` | Fases de implementação |
| `CLAWDBOT-BAAS-DATA-MAPPING.md` | DE/PARA de dados |
| `CLAWDBOT-FEATURES-TO-BAAS.md` | Features a expor na UI |
| `LLM-GATEWAY.md` | 🆕 Hub centralizado de LLM para multi-tenancy |

---

## ✅ Próximas Ações Imediatas

1. **🚀 Implementar LLM Gateway** - Fundação para multi-tenancy
   - Schema Prisma (Tenant, LLMProvider, LLMUsage)
   - Router (Max1 → Max2 → API)
   - Tracker de consumo por tenant
2. **Seed primeiro tenant** - VM Deco + Alcateia (10 agentes)
3. **Sistema de alertas** - Notificar em 20%, 10%, 5%, 1%
4. **Dashboard de consumo LLM** - Visualizar gastos por tenant/agente
5. **Criar página de grupos** - UI para gerenciar os 33 grupos

---

*Plano consolidado em 31/01/2026 | Lobo 🐺*
