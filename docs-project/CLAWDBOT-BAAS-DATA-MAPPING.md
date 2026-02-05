# Mapeamento Clawdbot → BaaS

## 📊 Resumo dos Dados Disponíveis

| Fonte Clawdbot | Quantidade | Pode usar no BaaS? |
|----------------|------------|-------------------|
| Session Transcripts | 75 arquivos | ✅ Sim |
| Mensagens | 11.345 | ✅ Sim |
| Tool Calls | 3.077 | ✅ Sim |
| WhatsApp Groups | 33 grupos | ✅ Sim |
| Media Files | 1.318 arquivos | ✅ Sim |
| Cron Jobs | N jobs | ✅ Sim |
| Memory DB | 15MB | ⚠️ Parcial |
| Credentials | 6 arquivos | 🔒 Sensível |

---

## 🔄 DE/PARA Completo

### 1. MENSAGENS (Session Transcripts)

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `message.role=user` | messagesIn | DailyStats | ✅ Importado |
| `message.role=assistant` | messagesOut | DailyStats | ✅ Importado |
| `message.timestamp` | date, hour | DailyStats, HourlyStats | ✅ Importado |
| `message.usage.input` | tokensIn | DailyStats | ✅ Importado |
| `message.usage.output` | tokensOut | DailyStats | ✅ Importado |
| `message.usage.cost.total` | cost | DailyStats | ✅ Importado |
| `message.usage.cacheRead` | cacheTokens | - | 🔲 Criar campo |
| `message.usage.cacheWrite` | cacheTokens | - | 🔲 Criar campo |
| `message.content` | messageContent | Message | 🔲 Importar |
| `message.model` | model | UsageLog | 🔲 Importar |

### 2. CANAIS (WhatsApp Groups)

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `channels.whatsapp.groups[id]` | externalId | Channel.config | ✅ Importado |
| `groups[id].name` | name | Channel | ✅ Importado |
| `groups[id].requireMention` | config.requireMention | Channel.config | ✅ Importado |
| `groups[id].enabled` | isActive | Channel | ✅ Importado |

**33 grupos importados em 2026-02-01:**
- Script: `scripts/import-whatsapp-channels.ts`
- API: `/api/channels/whatsapp` (GET/PATCH)
- Página: `/channels/whatsapp` (lê do banco)

```
Advisors - Dashboard, Sócios Mentes, Cultura Builder Team,
BI Performance, Administração Casa, R2 Admin, Iazis,
Alunos Builders CB, Podcast, Primos, Primos Black Hill,
Degens, Monte Dourado, Familia, Jazz, Kite, Gotas, Miami,
Liqi, CB Encontros/Mentoria/Projetos/Networking/Geral/Anúncios/Premium/Founders,
G.I. Joe Collectors, Safeway, Energia GD, Investimentos, Holding, Villagio
```

### 3. USAGE/CUSTOS

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `usage.cost.total` | cost | DailyStats | ✅ Importado |
| `usage.cost.input` | costInput | - | 🔲 Criar campo |
| `usage.cost.output` | costOutput | - | 🔲 Criar campo |
| `usage.cost.cacheRead` | costCache | - | 🔲 Criar campo |
| Por modelo (claude-opus-4-5) | costByModel | - | 🔲 Criar |

**Total gasto: $549.92**

### 4. SATISFAÇÃO (extraído do conteúdo)

| Padrão Clawdbot | BaaS | Status |
|-----------------|------|--------|
| "obrigado", "valeu", "👍" | feedbackPositive | ✅ Importado |
| "erro", "não funcionou", "👎" | feedbackNegative | ✅ Importado |

**Resultado: +136 / -115**

### 5. HORÁRIOS

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `message.timestamp` hora | hour | HourlyStats | ✅ Importado |
| Pico calculado | peakHour | DailyStats | ✅ Importado |

**Picos: 21h (1.275), 12h (1.107), 23h (957)**

### 6. TOOL CALLS (Ações do Agente)

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `toolResult` entries | toolCalls | - | 🔲 Criar tabela |
| Tool name | toolName | - | 🔲 Criar |
| Tool duration | toolDuration | - | 🔲 Criar |
| Tool success/error | toolStatus | - | 🔲 Criar |

**3.077 tool calls registrados**

### 7. MEDIA

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `~/.clawdbot/media/inbound/*` | mediaUrl | Message | 🔲 Importar |
| `~/.clawdbot/media/outbound/*` | mediaUrl | Message | 🔲 Importar |

**1.318 arquivos de mídia**

### 8. CRON JOBS

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| `cron/jobs.json` | scheduledTasks | - | 🔲 Criar tabela |
| Job schedule | cronExpression | - | 🔲 Criar |
| Job last run | lastRunAt | - | 🔲 Criar |

### 9. CONVERSAS (derivado)

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| Session ID | conversationId | Conversation | 🔲 Criar |
| Primeiro msg timestamp | startedAt | Conversation | 🔲 Criar |
| Último msg timestamp | endedAt | Conversation | 🔲 Criar |
| Mensagens por sessão | messageCount | Conversation | 🔲 Criar |

**75 sessões = ~75 conversas**

### 10. CONTATOS (derivado)

| Clawdbot | BaaS | Tabela | Status |
|----------|------|--------|--------|
| Número no message | phoneNumber | Contact | 🔲 Extrair |
| Nome (se disponível) | name | Contact | 🔲 Extrair |
| Grupo participante | groupId | Contact | 🔲 Extrair |

---

## 📋 Prioridade de Implementação

### Alta (Analytics principais)
1. ✅ DailyStats - mensagens, tokens, custo
2. ✅ HourlyStats - distribuição por hora
3. ✅ Satisfação - feedback positivo/negativo
4. ✅ Channels - 33 canais WhatsApp importados

### Média (Detalhamento)
5. 🔲 Conversations - 75 conversas
6. 🔲 Messages - 11.345 mensagens completas
7. 🔲 UsageLog - custo por modelo
8. 🔲 ToolCalls - 3.077 chamadas de ferramentas

### Baixa (Extras)
9. 🔲 Media - 1.318 arquivos
10. 🔲 Contacts - extrair números únicos
11. 🔲 CronJobs - jobs agendados

---

## 🛠️ Scripts Criados

| Script | Função |
|--------|--------|
| `scripts/sync-clawdbot-data.js` | Sync básico (DailyStats) |
| `scripts/sync-clawdbot-full.js` | Sync completo (Daily + Hourly + Satisfação) |

---

## 📊 Totais Importados

```
Mensagens entrada:  2.616
Mensagens saída:    5.638
Tokens usados:      1.607.255
Custo total:        $549.92
Dias com dados:     5 (27-31 Jan)
Horários mapeados:  83 registros
Satisfação:         +136 / -115
```

---

*Mapeamento criado em 31/01/2026 | Lobo 🐺*
