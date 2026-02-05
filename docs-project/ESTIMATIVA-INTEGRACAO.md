# 📊 Estimativa de Esforço - Integração com Clawdbot

> Documento criado em 2026-02-02
> Autor: Lobo 🐺 (Subagent)

---

## 📋 Resumo Executivo

| Item | Horas | Complexidade | Prioridade |
|------|-------|--------------|------------|
| 1. Múltiplas sessões de agentes | 16-24h | 🟡 Média | Alta |
| 2. Cron jobs escalonados | 8-12h | 🟢 Baixa | Alta |
| 3. Daemon de notificações | 12-18h | 🟡 Média | Média |
| 4. Sync memória (FS ↔ DB) | 20-30h | 🔴 Alta | Alta |
| 5. Daily standup automation | 6-10h | 🟢 Baixa | Média |
| **TOTAL** | **62-94h** | - | - |

**Estimativa realista:** ~80 horas (2 semanas full-time)

---

## 1. 🤖 Configurar Múltiplas Sessões de Agentes

### Descrição
Permitir que o BaaS gerencie múltiplos agentes Clawdbot simultaneamente, cada um com sua configuração, workspace e identidade.

### Tarefas Detalhadas

| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Criar schema multi-agente no Prisma | 2h | 🟢 Baixa |
| API CRUD de agentes (`/api/agents/*`) | 4h | 🟡 Média |
| UI de listagem de agentes | 3h | 🟢 Baixa |
| UI de criação/edição de agente | 4h | 🟡 Média |
| Integração com `clawdbot.json` (agents.list) | 4h | 🟡 Média |
| Bindings visuais (agente ↔ canal) | 4h | 🟡 Média |
| Testes e ajustes | 3h | 🟢 Baixa |

### Dependências
- Schema atual do Clawdbot (`agents.list`, `bindings`)
- API de escrita no clawdbot.json

### Riscos
- ⚠️ Conflito de bindings (dois agentes no mesmo grupo)
- ⚠️ Limite de concorrência (`maxConcurrent: 4`)

### Estimativa Final: **16-24 horas**

---

## 2. ⏰ Setup de Cron Jobs Escalonados

### Descrição
Sistema de tarefas agendadas para automação (health checks, sync, reports, cleanup).

### Tarefas Detalhadas

| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Implementar runner de cron (node-cron) | 2h | 🟢 Baixa |
| Schema de jobs no banco | 1h | 🟢 Baixa |
| UI de gerenciamento de crons | 3h | 🟡 Média |
| Jobs pré-configurados (health, sync, etc) | 2h | 🟢 Baixa |
| Escalonamento inteligente (spread jobs) | 2h | 🟡 Média |
| Logs de execução | 2h | 🟢 Baixa |

### Jobs Sugeridos

```javascript
// Exemplo de escalonamento
{
  "health-check": "*/5 * * * *",      // A cada 5 min
  "memory-sync": "0 */2 * * *",       // A cada 2h
  "daily-report": "0 8 * * *",        // 8h diário
  "weekly-cleanup": "0 3 * * 0",      // 3h domingo
  "cost-alert": "0 * * * *"           // Toda hora
}
```

### Dependências
- Daemon de notificações (para alertas)
- Redis (para distribuição de locks)

### Riscos
- ⚠️ Race conditions em multi-instance
- ⚠️ Jobs acumulados se server cai

### Estimativa Final: **8-12 horas**

---

## 3. 🔔 Daemon de Notificações

### Descrição
Serviço centralizado para envio de alertas multi-canal (WhatsApp, Email, Slack, Discord).

### Tarefas Detalhadas

| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Arquitetura do daemon (fila + workers) | 3h | 🟡 Média |
| Integração WhatsApp (via Clawdbot) | 2h | 🟢 Baixa |
| Integração Email (Resend) | 2h | 🟢 Baixa |
| Integração Slack/Discord (webhooks) | 2h | 🟢 Baixa |
| Sistema de templates de notificação | 3h | 🟡 Média |
| Preferências do usuário (canais ativos) | 2h | 🟢 Baixa |
| Rate limiting e deduplicação | 2h | 🟡 Média |
| UI de histórico de notificações | 2h | 🟢 Baixa |

### Tipos de Notificação

| Evento | Canal Padrão | Urgência |
|--------|--------------|----------|
| Bot offline | WhatsApp + Email | 🔴 Alta |
| Budget 80% | WhatsApp | 🟡 Média |
| Budget 100% | WhatsApp + Email | 🔴 Alta |
| Daily report | Email | 🟢 Baixa |
| Erro crítico | WhatsApp | 🔴 Alta |
| Nova conversa | Silencioso | 🟢 Baixa |

### Dependências
- Clawdbot Gateway (para WhatsApp)
- Resend API (para Email)
- Redis (fila de mensagens)

### Riscos
- ⚠️ Spam de notificações (precisa debounce)
- ⚠️ Latência em picos

### Estimativa Final: **12-18 horas**

---

## 4. 🔄 Sync de Memória (Filesystem ↔ Banco)

### Descrição
Sincronização bidirecional entre arquivos de memória do Clawdbot (`memory/*.md`, `MEMORY.md`) e banco de dados do BaaS.

### Tarefas Detalhadas

| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema de memória no Prisma | 3h | 🟡 Média |
| Parser de Markdown (frontmatter + body) | 4h | 🟡 Média |
| Watcher de filesystem (chokidar) | 3h | 🟡 Média |
| API de sync FS → DB | 4h | 🟡 Média |
| API de sync DB → FS | 4h | 🟡 Média |
| Resolução de conflitos | 5h | 🔴 Alta |
| UI de visualização de memórias | 4h | 🟡 Média |
| UI de edição de memórias | 3h | 🟡 Média |

### Estratégia de Sync

```
┌─────────────┐    watcher    ┌─────────────┐
│ Filesystem  │ ─────────────► │   Queue     │
│ memory/*.md │               │   (Redis)   │
└─────────────┘               └──────┬──────┘
      ▲                              │
      │                              ▼
      │ write             ┌─────────────────┐
      └───────────────────│   PostgreSQL    │
                          │   (memories)    │
                          └─────────────────┘
```

### Resolução de Conflitos

| Cenário | Resolução |
|---------|-----------|
| FS mais recente | FS vence |
| DB mais recente | DB vence |
| Simultâneo | Merge (3-way) ou flag manual |
| Arquivo deletado | Soft delete no DB |

### Dependências
- Chokidar (file watcher)
- Redis (fila de eventos)
- Diff/merge lib (para conflitos)

### Riscos
- ⚠️ **Alta complexidade**: conflitos são difíceis
- ⚠️ Loop infinito (sync trigger sync)
- ⚠️ Performance com muitos arquivos

### Estimativa Final: **20-30 horas**

---

## 5. 📋 Daily Standup Automation

### Descrição
Geração automática de resumo diário com métricas, tarefas e highlights.

### Tarefas Detalhadas

| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Template de standup (Markdown) | 1h | 🟢 Baixa |
| Coletor de métricas (uso, custo, msgs) | 2h | 🟢 Baixa |
| Coletor de tarefas (de memória/tasks) | 2h | 🟡 Média |
| Gerador de highlights (LLM summary) | 2h | 🟡 Média |
| Cron job de geração (8h daily) | 1h | 🟢 Baixa |
| Distribuição (email/WhatsApp) | 1h | 🟢 Baixa |
| UI de histórico de standups | 1h | 🟢 Baixa |

### Formato do Standup

```markdown
# 📋 Daily Standup - 02/02/2026

## 📊 Métricas de Ontem
- Mensagens: 1.234 (↑12%)
- Tokens: 245.000
- Custo: $52.30
- Satisfação: +45 / -12

## ✅ Completado Ontem
- Migração de dados concluída
- Bug de timeout corrigido

## 🎯 Foco de Hoje
- Implementar sync de memória
- Review do PR #42

## ⚠️ Bloqueios
- Aguardando API key do Stripe

## 💡 Highlights
- Grupo "Cultura Builder" teve pico de 200 msgs
- Novo padrão: perguntas sobre pricing aumentaram 30%
```

### Dependências
- Daemon de notificações
- Métricas agregadas (analytics)
- Cron jobs

### Riscos
- ⚠️ Baixo: funcionalidade bem definida

### Estimativa Final: **6-10 horas**

---

## 📈 Cronograma Sugerido

### Semana 1 (40h)
| Dia | Tarefa | Horas |
|-----|--------|-------|
| Seg | Setup inicial + Cron jobs | 8h |
| Ter | Cron jobs (fim) + Daemon notificações (início) | 8h |
| Qua | Daemon notificações | 8h |
| Qui | Daemon notificações (fim) + Daily standup | 8h |
| Sex | Daily standup (fim) + Múltiplas sessões (início) | 8h |

### Semana 2 (40h)
| Dia | Tarefa | Horas |
|-----|--------|-------|
| Seg | Múltiplas sessões de agentes | 8h |
| Ter | Múltiplas sessões (fim) + Sync memória (início) | 8h |
| Qua | Sync memória | 8h |
| Qui | Sync memória | 8h |
| Sex | Sync memória (fim) + Testes + Buffer | 8h |

---

## 💰 Custo Estimado

### Desenvolvimento
| Recurso | Horas | Rate | Total |
|---------|-------|------|-------|
| Dev Senior | 80h | $80/h | $6.400 |
| **Total** | **80h** | - | **$6.400** |

### Infra Adicional (mensal)
| Item | Custo |
|------|-------|
| Redis (cache/queue) | $15/mês |
| Storage (memórias) | $5/mês |
| **Total mensal** | **$20/mês** |

---

## ✅ Recomendações

### Ordem de Implementação

1. **Cron jobs** (baixa complexidade, desbloqueia outros)
2. **Daemon notificações** (necessário para alertas)
3. **Daily standup** (quick win, valor visível)
4. **Múltiplas sessões** (feature importante)
5. **Sync memória** (deixar por último - maior risco)

### Simplificações Possíveis

| Item | Simplificação | Economia |
|------|---------------|----------|
| Sync memória | One-way only (FS → DB) | -10h |
| Notificações | Apenas WhatsApp | -4h |
| Cron jobs | Usar clawdbot native | -4h |

### Com Simplificações
**Estimativa reduzida:** ~55-65 horas

---

## 🔑 Decisões Necessárias

1. **Sync bidirecional é obrigatório?** (maior impacto em horas)
2. **Quais canais de notificação são essenciais?**
3. **Quantos agentes simultâneos no MVP?**
4. **Daily standup: formato fixo ou customizável?**

---

## 📝 Conclusão

| Cenário | Horas | Timeline |
|---------|-------|----------|
| **Completo** | 80h | 2 semanas |
| **MVP (simplificado)** | 55h | 1.5 semanas |
| **Apenas essenciais** | 35h | 1 semana |

**Recomendação:** Começar com MVP simplificado, iterar depois.

---

*Estimativa criada em 2026-02-02 | Lobo 🐺*
