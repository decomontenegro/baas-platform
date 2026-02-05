# BaaS Dashboard - Análise de Tabelas Existentes

**Data:** 2025-01-28  
**Objetivo:** Mapear estrutura atual para Mission Control

---

## 📊 Resumo Executivo

| Categoria | Quantidade |
|-----------|------------|
| **Total de Modelos** | 54 |
| **Total de Enums** | 52 |
| **Reaproveitáveis (direto)** | ~20 |
| **Reaproveitáveis (com adaptação)** | ~15 |
| **Específicos do BaaS** | ~19 |

---

## 🏗️ Estrutura Multi-Tenant Core

### ✅ **Totalmente Reaproveitáveis**

| Modelo | Campos Chave | Uso no Mission Control |
|--------|--------------|------------------------|
| `Tenant` | id, name, slug, plan, status, settings | ✅ Organização/Empresa base |
| `User` | id, name, email, role, tenantId | ✅ Usuários do sistema |
| `Membership` | userId, tenantId, role, status | ✅ Relação User ↔ Tenant |
| `Workspace` | id, name, slug, tenantId, settings | ✅ Espaços de trabalho/projetos |
| `Session` | id, sessionToken, userId, expires | ✅ Auth (NextAuth) |
| `Account` | OAuth providers (Google, etc) | ✅ Auth (NextAuth) |
| `VerificationToken` | Email verification | ✅ Auth (NextAuth) |

### 📝 Detalhes das Tabelas Core

```prisma
model Tenant {
  id                String       @id
  name              String
  slug              String       @unique
  domain            String?      @unique
  logoUrl           String?
  plan              TenantPlan   @default(FREE)
  settings          Json         @default("{}")
  dataRetentionDays Int?         @default(365)
  status            TenantStatus @default(ACTIVE)
  // ... timestamps, soft delete
}

model User {
  id            String    @id
  name          String?
  email         String    @unique
  image         String?
  tenantId      String?
  role          UserRole  @default(MEMBER)
  isActive      Boolean   @default(true)
  password      String?   // Permite login email/senha
  // ... timestamps, GDPR fields
}

model Membership {
  id       String       @id
  userId   String
  tenantId String
  role     MemberRole   @default(OPERATOR) // OWNER, ADMIN, MANAGER, OPERATOR, VIEWER
  status   MemberStatus @default(ACTIVE)   // ACTIVE, INVITED, SUSPENDED
}
```

---

## 🤖 Sistema de Bots (Adaptar para Agentes)

### ⚡ **Alta Relevância para Mission Control**

| Modelo | Campos Chave | Adaptação para Agentes |
|--------|--------------|------------------------|
| `Bot` | personality, systemPrompt, model, temperature | → `Agent` (perfil do agente) |
| `AdminAgent` | healthCheck, alerts, autoRestart | → Monitoramento de agentes |
| `BotHealthLog` | status, latency, errors | → Logs de saúde do agente |
| `AdminAlert` | type, severity, status | → Sistema de alertas |
| `BotAssignment` | botId, channelId, config | → Onde agente atua |

### 📝 Bot → Agent Mapping

```prisma
// ATUAL: Bot
model Bot {
  id             String @id
  tenantId       String
  name           String
  personality    Json   @default("{\"humor\": 30, \"empathy\": 70, ...}")
  systemPrompt   String
  model          String @default("gpt-4o-mini")
  temperature    Float  @default(0.7)
  maxTokens      Int    @default(2048)
  knowledgeBaseId String?
  welcomeMessage String?
  handoffEnabled Boolean @default(true)
  // ...
}

// PROPOSTA: Agent (expandir Bot)
model Agent {
  // Campos do Bot existentes +
  type           AgentType // CHATBOT, TASK_RUNNER, BACKGROUND, TOOL
  capabilities   String[]  // ["chat", "code", "browse", "files"]
  tools          Json      // Ferramentas disponíveis
  mcpServers     String[]  // MCPs conectados
  maxConcurrent  Int       // Tasks simultâneas
  costPerRun     Decimal?  // Custo por execução
}
```

### AdminAgent → AgentSupervisor

Já existe um sistema de monitoramento!

```prisma
model AdminAgent {
  healthCheckEnabled     Boolean @default(true)
  healthCheckIntervalMs  Int     @default(300000)
  maxRestartAttempts     Int     @default(3)
  alertOnLatencyMs       Int     @default(5000)
  alertOnErrorRate       Float   @default(0.1)
  autoRestartEnabled     Boolean @default(true)
  autoRollbackEnabled    Boolean @default(true)
  lastGoodConfig         Json?   // Rollback automático!
}
```

---

## 💬 Sistema de Mensagens/Conversas

### ✅ **Reaproveitáveis**

| Modelo | Uso Atual | Uso no Mission Control |
|--------|-----------|------------------------|
| `Channel` | WhatsApp, Telegram, etc | → Canais de comunicação |
| `Conversation` | Thread de mensagens | → Sessões de chat com agentes |
| `Message` | Mensagens individuais | → Histórico de interações |
| `ConversationEvent` | Eventos na conversa | → Eventos de sessão |
| `ConversationNote` | Notas internas | → Anotações em tasks |

```prisma
model Channel {
  id     String      @id
  name   String
  type   ChannelType // WHATSAPP, TELEGRAM, DISCORD, SLACK, WEBCHAT...
  status ChannelStatus // CONNECTED, DISCONNECTED, ERROR...
  config Json
}

model Message {
  id          String             @id
  content     String
  contentType MessageContentType // TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT...
  role        MessageRole        // USER, BOT, OPERATOR, SYSTEM
  status      MessageStatus      // PENDING, SENT, DELIVERED, READ, FAILED
  aiMetadata  Json?              // Tokens, custo, modelo usado
}
```

---

## 📋 Sistema de Tarefas (Bases Existentes)

### ⚡ **Modelos Adaptáveis para Tasks**

| Modelo Atual | Campos Úteis | Nova Função |
|--------------|--------------|-------------|
| `ActionExecution` | status, input, output, durationMs | → `TaskExecution` |
| `QuickAction` | trigger, type, config | → `TaskDefinition` |
| `ScheduledMessage` | scheduleType, recurrence | → `ScheduledTask` |
| `Campaign` | status, audienceFilter, config | → `BatchTask` |
| `CampaignRecipient` | status, sentAt, failedAt | → `TaskTarget` |

### ActionExecution → TaskExecution

```prisma
// ATUAL
model ActionExecution {
  id          String                @id
  actionId    String
  input       String
  parsedArgs  Json
  output      String?
  error       String?
  status      ActionExecutionStatus // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  durationMs  Int?
  executedAt  DateTime
}

// Já tem status perfeito para tasks:
enum ActionExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

### ScheduledMessage → Scheduler

```prisma
model ScheduledMessage {
  scheduleType ScheduleType // ONE_TIME, RECURRING, TRIGGER_BASED
  recurrence   Json?        // Configuração de recorrência
  status       ScheduledMessageStatus
  retryCount   Int          @default(0)
  maxRetries   Int          @default(3)
}
```

---

## 📊 Analytics & Monitoramento

### ✅ **Prontos para Uso**

| Modelo | Uso |
|--------|-----|
| `AnalyticsEvent` | Eventos genéricos (tokens, custo, tempo) |
| `DailyStats` | Agregações diárias |
| `HourlyStats` | Agregações por hora |
| `UsageLog` | Consumo de recursos |
| `UsageRecord` | Histórico de uso |
| `AuditLog` | Trilha de auditoria |

```prisma
model AnalyticsEvent {
  eventType      AnalyticsEventType
  data           Json
  responseTimeMs Int?
  tokensIn       Int?
  tokensOut      Int?
  cost           Decimal?
  model          String?
}

model AuditLog {
  userId     String?
  action     String
  resource   String
  resourceId String?
  oldData    Json?
  newData    Json?
  ipAddress  String?
}
```

---

## 🔧 Integrações

### ✅ **Reaproveitáveis**

| Modelo | Uso |
|--------|-----|
| `Integration` | Conexões externas (CRM, Calendar, etc) |
| `IntegrationLog` | Histórico de syncs |
| `Webhook` | Webhooks configurados |
| `ApiKey` | Chaves de API |

```prisma
model Integration {
  type        IntegrationType  // CRM_HUBSPOT, CALENDAR_GOOGLE, PAYMENT_STRIPE...
  credentials Json             // Credenciais criptografadas
  config      Json
  status      IntegrationStatus
  syncEnabled Boolean
}
```

---

## 📚 Knowledge Base

### ✅ **Reaproveitável para RAG**

| Modelo | Uso |
|--------|-----|
| `KnowledgeBase` | Base de conhecimento |
| `KnowledgeDocument` | Documentos fonte |
| `KnowledgeChunk` | Chunks vetorizados |

```prisma
model KnowledgeBase {
  embeddingModel String @default("text-embedding-3-small")
  chunkSize      Int    @default(1000)
  chunkOverlap   Int    @default(200)
}

model KnowledgeChunk {
  content    String
  embedding  Json?   // Vetor de embeddings
  tokenCount Int?
}
```

---

## 👥 Team Management

### ✅ **Pronto para Uso**

| Modelo | Uso |
|--------|-----|
| `TeamMember` | Membros da equipe |
| `TeamInvite` | Convites pendentes |
| `TeamActivityLog` | Log de atividades |

---

## 🔔 Notificações

### ✅ **Reaproveitável**

| Modelo | Uso |
|--------|-----|
| `Notification` | Notificações do sistema |
| `NotificationPreference` | Preferências por tipo |

```prisma
enum NotificationType {
  HANDOFF_REQUESTED
  HANDOFF_TIMEOUT
  BOT_ERROR
  USAGE_ALERT
  NEW_CONVERSATION
  MENTION
  DAILY_SUMMARY
  SYSTEM
}
```

---

## 💰 Billing & Subscription

### ✅ **Reaproveitável**

| Modelo | Uso |
|--------|-----|
| `Subscription` | Plano atual (Stripe) |
| `Invoice` | Faturas |
| `Credit` | Créditos de uso |

---

## 📦 Específicos do BaaS (Baixa Prioridade)

Estes são específicos para chatbots e podem ser ignorados ou removidos:

- `Campaign` / `CampaignRecipient` - Campanhas de marketing
- `HandoffRequest` / `HandoffRule` / `HandoffSettings` - Transferência para humano
- `Personality` / `Specialist` - Personalidades de bot
- `Template` / `TemplateCategory` - Templates de mensagem
- `Feature` - Features específicas de workspace

---

## 🎯 Novas Tabelas Necessárias para Mission Control

### Propostas

```prisma
// 1. Definição de Task
model TaskDefinition {
  id          String @id
  tenantId    String
  name        String
  description String?
  agentId     String?      // Agente responsável
  type        TaskType     // CHAT, AUTOMATION, SCHEDULED, WEBHOOK
  trigger     Json         // Configuração do trigger
  config      Json         // Parâmetros da task
  isActive    Boolean
}

// 2. Execução de Task
model TaskRun {
  id           String @id
  definitionId String?
  agentId      String
  status       TaskStatus // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  input        Json
  output       Json?
  error        String?
  startedAt    DateTime?
  completedAt  DateTime?
  durationMs   Int?
  tokensUsed   Int?
  cost         Decimal?
  parentRunId  String?    // Para sub-tasks
}

// 3. Ferramenta/Skill
model Tool {
  id          String @id
  tenantId    String
  name        String
  type        ToolType // MCP_SERVER, API, FUNCTION, BROWSER
  config      Json
  schema      Json     // JSON Schema dos parâmetros
}

// 4. Agente ↔ Ferramenta
model AgentTool {
  agentId String
  toolId  String
  config  Json?    // Configuração específica
}
```

---

## 📈 Resumo de Reaproveitamento

### ✅ Usar Diretamente
- `Tenant`, `User`, `Membership`, `Workspace`
- `Session`, `Account`, `VerificationToken` (Auth)
- `ApiKey`, `AuditLog`, `Notification`
- `Subscription`, `Invoice`, `Credit`
- `KnowledgeBase`, `KnowledgeDocument`, `KnowledgeChunk`

### ⚡ Adaptar/Expandir
- `Bot` → `Agent` (adicionar campos)
- `AdminAgent` → `AgentSupervisor`
- `ActionExecution` → `TaskRun`
- `QuickAction` → `TaskDefinition`
- `Channel` (manter como está)
- `Conversation`, `Message` (manter)
- `Integration`, `Webhook` (manter)

### 🆕 Criar Novos
- `TaskDefinition` (se QuickAction não servir)
- `Tool` (ferramentas disponíveis)
- `AgentTool` (relação N:N)
- `McpServer` (servidores MCP)

### ❌ Ignorar/Remover
- Modelos de Handoff (específico atendimento)
- Modelos de Campaign (marketing)
- Templates/Categories
- Personality/Specialist (absorvido por Agent)

---

## 🔄 Plano de Migração Sugerido

1. **Fase 1:** Manter schema existente, apenas adicionar novos modelos
2. **Fase 2:** Renomear `Bot` → `Agent` com migration
3. **Fase 3:** Consolidar `QuickAction` + `ActionExecution` em sistema de tasks
4. **Fase 4:** Remover modelos não utilizados

---

*Gerado em: 2025-01-28*
