# 🎯 PLANO DE IMPLEMENTAÇÃO - Mission Control

> **Documento Consolidado** - Plano completo para implementação do Mission Control no BaaS
> 
> **Versão:** 1.0  
> **Data:** 2025-02-04  
> **Status:** Aprovado para Execução

---

## 📑 Índice

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [O que Já Existe no BaaS (Reaproveitável)](#2-o-que-já-existe-no-baas-reaproveitável)
3. [O que Precisa Ser Criado](#3-o-que-precisa-ser-criado)
4. [Fases de Implementação (MVP → Full)](#4-fases-de-implementação-mvp--full)
5. [Estimativa Total de Esforço](#5-estimativa-total-de-esforço)
6. [Priorização das Features](#6-priorização-das-features)
7. [Dependências entre Tarefas](#7-dependências-entre-tarefas)
8. [Riscos e Mitigações](#8-riscos-e-mitigações)
9. [Cronograma Sugerido](#9-cronograma-sugerido)
10. [Checklist de Entrega](#10-checklist-de-entrega)

---

## 1. Visão Geral do Projeto

### 1.1 O que é o Mission Control?

O **Mission Control** é o hub central de coordenação e supervisão do ecossistema de agentes AI no BaaS. Inspirado no artigo "Building AI agent teams that actually work together" de Bhanu Teja P., ele permite:

- **Gerenciar Agentes** - Visualizar, configurar e monitorar bots AI
- **Coordenar Tarefas** - Criar, atribuir e acompanhar trabalho dos agentes
- **Colaborar via Comentários** - Sistema de @mentions entre agentes/humanos
- **Monitorar Saúde** - Health checks, alertas e auto-recovery
- **Visualizar Atividade** - Feed em tempo real de todas as ações

### 1.2 Arquitetura Conceitual

```
┌─────────────────────────────────────────────────────────────────┐
│                      MISSION CONTROL                             │
│                    (Dashboard Web BaaS)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Dashboard │  │  Tasks   │  │  Agents  │  │ Standup  │        │
│  │ Overview │  │  Board   │  │   List   │  │  Daily   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
│       └─────────────┴──────┬──────┴─────────────┘                │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  PostgreSQL (Prisma)                     │    │
│  │  • Agents  • Tasks  • Comments  • Activity  • Heartbeat │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Clawdbot Gateway                       │    │
│  │          (Engine de execução dos agentes)               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Princípios de Design

| Princípio | Descrição |
|-----------|-----------|
| **UI First** | Transformar JSON em interfaces intuitivas |
| **Economia de Tokens** | HEARTBEAT_OK como caminho feliz (mínimo custo) |
| **Escalonamento** | Heartbeats em minutos diferentes para evitar picos |
| **Observabilidade** | Tudo logado e monitorável |
| **Proatividade** | Agentes fazem trabalho útil, não só "ping-pong" |

### 1.4 Público-Alvo

| Persona | Uso Principal |
|---------|---------------|
| **Admin da Empresa** | Overview, billing, controle de custos |
| **Operador** | Gerenciar agentes, ajustar configs, monitorar |
| **Desenvolvedor** | APIs, integrações, debugging |

---

## 2. O que Já Existe no BaaS (Reaproveitável)

### 2.1 Infraestrutura Base ✅

| Componente | Status | Descrição |
|------------|--------|-----------|
| **Next.js 14** | ✅ Pronto | Framework web com App Router |
| **Prisma ORM** | ✅ Pronto | Conexão PostgreSQL configurada |
| **shadcn/ui** | ✅ Pronto | Biblioteca de componentes |
| **TailwindCSS** | ✅ Pronto | Styling system |
| **NextAuth** | ✅ Pronto | Autenticação (magic link) |
| **Resend** | ✅ Pronto | Email transacional |

### 2.2 Modelos de Dados Existentes ✅

```prisma
# Já existem no schema.prisma:

✅ Tenant          # Multi-tenancy
✅ User            # Usuários e auth
✅ Workspace       # Agrupamento de recursos
✅ Channel         # Canais conectados (WhatsApp, etc)
✅ Bot             # Configuração básica de bots
✅ DailyStats      # Métricas agregadas
✅ HourlyStats     # Distribuição por hora
```

### 2.3 Páginas Existentes ✅

| Página | Status | Reutilizável para MC? |
|--------|--------|----------------------|
| `/dashboard` | ✅ | Sim - base para overview |
| `/analytics` | ✅ | Sim - gráficos reutilizáveis |
| `/conversations` | ✅ | Sim - lista de conversas |
| `/channels` | ✅ | Sim - lista de canais |
| `/settings` | 🔧 | Parcial - estrutura base |
| `/team` | ✅ | Sim - gestão de usuários |

### 2.4 Componentes Reutilizáveis ✅

| Componente | Localização | Uso no MC |
|------------|-------------|-----------|
| `Sidebar` | `/components/layout` | ✅ Adicionar menu MC |
| `StatCard` | `/components/dashboard` | ✅ Quick Stats |
| `DataTable` | `/components/ui` | ✅ Lista de Tasks/Agents |
| `Chart` | `/components/charts` | ✅ Activity timeline |
| `Modal` | `/components/ui` | ✅ Task detail |
| `Badge` | `/components/ui` | ✅ Status indicators |

### 2.5 APIs Existentes ✅

```typescript
// APIs base que podem ser extendidas:

GET  /api/dashboard/stats    # → Adicionar stats de agents/tasks
GET  /api/channels           # → Base para /api/agents
GET  /api/conversations      # → Base para /api/tasks
POST /api/webhooks/clawdbot  # → Estender para heartbeat
```

### 2.6 Scripts de Sync ✅

| Script | Função | Reutilizável |
|--------|--------|--------------|
| `sync-clawdbot-data.js` | Importa transcripts | ✅ Base para sync |
| `sync-clawdbot-full.js` | Sync completo | ✅ Estender |
| `import-whatsapp-channels.ts` | Importa grupos | ✅ Modelo de import |

---

## 3. O que Precisa Ser Criado

### 3.1 Novos Modelos Prisma

```prisma
# ============================================
# MISSION CONTROL - Novos Models
# ============================================

# 1. Agent (estende Bot existente ou novo)
model Agent {
  id            String        @id @default(cuid())
  tenantId      String?
  name          String        @unique
  role          String        # "developer", "researcher", "reviewer"
  description   String?
  status        AgentStatus   @default(IDLE)
  sessionKey    String?       @unique
  currentTaskId String?       @unique
  model         String?
  systemPrompt  String?       @db.Text
  capabilities  String[]      @default([])
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  lastActiveAt  DateTime?
  
  # Relações
  currentTask   Task?         @relation("AgentCurrentTask")
  assignedTasks Task[]        @relation("TaskAssignees")
  comments      TaskComment[]
  activities    Activity[]
  notifications AgentNotification[]
  documents     Document[]
}

# 2. Task (coordenação de trabalho)
model Task {
  id           String       @id @default(cuid())
  tenantId     String?
  workspaceId  String?
  title        String
  description  String       @db.Text
  status       TaskStatus   @default(TODO)
  priority     TaskPriority @default(MEDIUM)
  context      String?      @db.Text
  acceptance   String?      @db.Text
  output       String?      @db.Text
  parentId     String?
  dependsOnIds String[]     @default([])
  
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  startedAt    DateTime?
  completedAt  DateTime?
  dueAt        DateTime?
  
  # Relações
  subtasks     Task[]       @relation("TaskSubtasks")
  currentAgent Agent?       @relation("AgentCurrentTask")
  assignees    Agent[]      @relation("TaskAssignees")
  comments     TaskComment[]
  activities   Activity[]
  documents    Document[]
}

# 3. TaskComment (colaboração)
model TaskComment {
  id          String    @id @default(cuid())
  taskId      String
  fromAgentId String
  parentId    String?
  content     String    @db.Text
  attachments Json?     @default("[]")
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  # Relações
  task          Task       @relation(fields: [taskId], references: [id])
  fromAgent     Agent      @relation(fields: [fromAgentId], references: [id])
  replies       TaskComment[] @relation("CommentThread")
  notifications AgentNotification[]
}

# 4. Activity (feed de atividades)
model Activity {
  id        String       @id @default(cuid())
  type      ActivityType
  message   String       @db.Text
  metadata  Json?        @default("{}")
  agentId   String?
  taskId    String?
  
  createdAt DateTime     @default(now())
}

# 5. AgentNotification (@mentions)
model AgentNotification {
  id               String               @id @default(cuid())
  mentionedAgentId String
  commentId        String?
  content          String               @db.Text
  priority         NotificationPriority @default(NORMAL)
  delivered        Boolean              @default(false)
  deliveredAt      DateTime?
  read             Boolean              @default(false)
  readAt           DateTime?
  
  createdAt        DateTime             @default(now())
  expiresAt        DateTime?
}

# 6. Document (deliverables)
model Document {
  id        String       @id @default(cuid())
  title     String
  content   String       @db.Text
  type      DocumentType
  version   Int          @default(1)
  mimeType  String?
  filePath  String?
  taskId    String?
  authorId  String?
  
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

# 7. HeartbeatLog (monitoramento)
model HeartbeatLog {
  id           String   @id @default(cuid())
  tenantId     String
  agentId      String
  scheduledAt  DateTime
  receivedAt   DateTime?
  completedAt  DateTime?
  status       String   # 'ok', 'working', 'alert', 'error', 'missed'
  response     String?  @db.Text
  tokensUsed   Int?
  durationMs   Int?
  costUsd      Decimal?
  checksPerformed Json?
  alerts       Json?
  
  createdAt    DateTime @default(now())
}

# 8. AgentHealth (estado agregado)
model AgentHealth {
  id               String   @id @default(cuid())
  tenantId         String
  agentId          String   @unique
  currentStatus    String
  lastHeartbeatAt  DateTime?
  consecutiveMisses Int     @default(0)
  consecutiveErrors Int     @default(0)
  successRate24h   Decimal?
  avgTokens24h     Int?
  avgLatencyMs24h  Int?
  totalHeartbeats  Int      @default(0)
  totalTokens      Int      @default(0)
  totalCostUsd     Decimal? @default(0)
  
  updatedAt        DateTime @default(now())
}

# 9. DailyStandup (relatórios)
model DailyStandup {
  id              String   @id @default(cuid())
  date            DateTime @db.Date
  periodStart     DateTime
  periodEnd       DateTime
  summary         String   @db.Text
  metrics         Json
  sections        Json
  deliveredAt     DateTime?
  deliveryChannels Json?
  generatedBy     String?
  tenantId        String?
  
  createdAt       DateTime @default(now())
}

# 10. StandupConfig (configuração por tenant)
model StandupConfig {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  enabled       Boolean  @default(true)
  schedule      String   @default("0 9 * * 1-5")
  timezone      String   @default("UTC")
  lookbackHours Int      @default(24)
  includeMetrics  Boolean @default(true)
  includeConcerns Boolean @default(true)
  language      String   @default("pt-BR")
  channels      Json     # DeliveryChannel[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

# Enums
enum AgentStatus { IDLE, WORKING, BLOCKED, OFFLINE }
enum TaskStatus { TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED }
enum TaskPriority { CRITICAL, HIGH, MEDIUM, LOW }
enum ActivityType {
  AGENT_STARTED, AGENT_STOPPED, AGENT_STATUS_CHANGED,
  TASK_CREATED, TASK_ASSIGNED, TASK_STARTED, TASK_UPDATED, 
  TASK_COMPLETED, TASK_BLOCKED, COMMENT_ADDED, MENTION_SENT,
  DOCUMENT_CREATED, SYSTEM_ERROR, SYSTEM_INFO
}
enum NotificationPriority { LOW, NORMAL, HIGH, URGENT }
enum DocumentType { SPEC, CODE, TEST, REPORT, NOTE, ANALYSIS, PLAN, REVIEW, OTHER }
```

**Esforço: 8-13 horas** (conforme ESTIMATIVA-SCHEMA.md)

### 3.2 Novas Páginas

| Página | Rota | Descrição | Esforço |
|--------|------|-----------|---------|
| **Dashboard MC** | `/mission-control` | Overview com agent cards + activity feed | 12h |
| **Task Board** | `/mission-control/tasks` | Kanban com drag-and-drop | 20h |
| **Task Detail** | `/mission-control/tasks/[id]` | Detalhes + comentários | 12h |
| **Agents List** | `/mission-control/agents` | Lista de agentes + status | 8h |
| **Agent Detail** | `/mission-control/agents/[id]` | Config + memory + logs | 16h |
| **Daily Standup** | `/mission-control/standup` | Relatório diário agregado | 12h |
| **Heartbeat Monitor** | `/mission-control/heartbeat` | Monitoramento de saúde | 10h |

**Total páginas: ~90 horas**

### 3.3 Novas APIs

| Endpoint | Método | Descrição | Esforço |
|----------|--------|-----------|---------|
| `/api/mission-control/stats` | GET | Métricas agregadas | 2h |
| `/api/mission-control/activity` | GET | Feed de atividades | 3h |
| `/api/agents` | CRUD | Gerenciamento de agentes | 6h |
| `/api/agents/[id]/stats` | GET | Stats do agente | 2h |
| `/api/agents/[id]/memory` | GET | Arquivos de memória | 3h |
| `/api/agents/[id]/logs` | GET | Logs do agente | 2h |
| `/api/agents/[id]/message` | POST | Enviar msg para agente | 2h |
| `/api/tasks` | CRUD | Gerenciamento de tasks | 6h |
| `/api/tasks/[id]/comments` | CRUD | Comentários | 4h |
| `/api/tasks/[id]/assign` | POST | Atribuir agente | 2h |
| `/api/notifications` | CRUD | Notificações | 4h |
| `/api/documents` | CRUD | Documentos | 4h |
| `/api/heartbeat` | POST | Webhook receiver | 4h |
| `/api/standup` | GET/POST | Standup diário | 4h |

**Total APIs: ~48 horas**

### 3.4 Componentes Novos

| Componente | Descrição | Esforço |
|------------|-----------|---------|
| `AgentCard` | Card com status, task atual, ações | 3h |
| `TaskCard` | Card Kanban com drag support | 4h |
| `ActivityFeed` | Lista virtualizada de atividades | 4h |
| `CommentThread` | Thread de comentários com @mentions | 6h |
| `MentionInput` | Input com autocomplete de @mentions | 4h |
| `KanbanBoard` | Board com colunas e DnD | 8h |
| `StatusBadge` | Badge de status com cores | 1h |
| `AgentHeader` | Header do detalhe do agente | 2h |
| `QuickChat` | Mini chat para conversar com agente | 6h |
| `HeartbeatChart` | Gráfico de heartbeats | 3h |
| `StandupCard` | Card expandível do standup | 3h |

**Total componentes: ~44 horas**

### 3.5 Integrações

| Integração | Descrição | Esforço |
|------------|-----------|---------|
| **WebSocket** | Real-time updates | 12h |
| **Clawdbot API** | Controle de agentes | 8h |
| **Cron Escalonado** | Heartbeats por minuto | 6h |
| **Delivery Multi-canal** | WhatsApp/Telegram/Email | 8h |

**Total integrações: ~34 horas**

---

## 4. Fases de Implementação (MVP → Full)

### Fase 1: MVP Core (2-3 semanas)

**Objetivo:** Dashboard básico funcional com tasks e agents

```
┌─────────────────────────────────────────┐
│           FASE 1 - MVP CORE             │
├─────────────────────────────────────────┤
│                                         │
│  Schema Prisma                    8h    │
│  ├── Agents                             │
│  ├── Tasks                              │
│  └── Activity                           │
│                                         │
│  Dashboard Overview              12h    │
│  ├── Agent cards básicos                │
│  ├── Quick stats                        │
│  └── Activity feed (read-only)          │
│                                         │
│  Task List                       12h    │
│  ├── Lista simples (tabela)             │
│  ├── Filtros básicos                    │
│  └── Criar task                         │
│                                         │
│  Agent List                       8h    │
│  ├── Lista de agentes                   │
│  ├── Status indicators                  │
│  └── Link para config                   │
│                                         │
│  APIs Base                       16h    │
│  ├── /api/agents (CRUD)                 │
│  ├── /api/tasks (CRUD)                  │
│  └── /api/activity (GET)                │
│                                         │
│  TOTAL FASE 1:                   56h    │
│  (~7 dias úteis, 1 dev)                 │
│                                         │
└─────────────────────────────────────────┘
```

**Entregáveis Fase 1:**
- [x] Schema: Agent, Task, Activity no Prisma
- [x] Página: `/mission-control` com overview
- [x] Página: `/mission-control/tasks` lista simples
- [x] Página: `/mission-control/agents` lista
- [x] APIs: CRUD básico de agents e tasks

---

### Fase 2: Kanban + Colaboração (2 semanas)

**Objetivo:** Board completo com drag-and-drop e comentários

```
┌─────────────────────────────────────────┐
│      FASE 2 - KANBAN + COLABORAÇÃO      │
├─────────────────────────────────────────┤
│                                         │
│  Kanban Board                    20h    │
│  ├── Colunas por status                 │
│  ├── Drag-and-drop                      │
│  ├── Task cards                         │
│  └── Quick add                          │
│                                         │
│  Task Detail                     12h    │
│  ├── Modal ou página dedicada           │
│  ├── Edição inline                      │
│  ├── Subtasks                           │
│  └── Sidebar de metadados               │
│                                         │
│  Comments System                 10h    │
│  ├── Thread de comentários              │
│  ├── @mentions                          │
│  └── Markdown básico                    │
│                                         │
│  Notifications                    8h    │
│  ├── Schema + API                       │
│  ├── Bell icon com badge                │
│  └── Dropdown de notificações           │
│                                         │
│  TOTAL FASE 2:                   50h    │
│  (~6 dias úteis, 1 dev)                 │
│                                         │
└─────────────────────────────────────────┘
```

**Entregáveis Fase 2:**
- [x] Kanban funcional com DnD
- [x] Modal de task detail editável
- [x] Sistema de comentários com @mentions
- [x] Notificações in-app

---

### Fase 3: Agent Detail + Memory (1-2 semanas)

**Objetivo:** Visão completa de cada agente

```
┌─────────────────────────────────────────┐
│       FASE 3 - AGENT DETAIL             │
├─────────────────────────────────────────┤
│                                         │
│  Agent Overview Tab              10h    │
│  ├── Stats cards                        │
│  ├── Recent activity                    │
│  ├── Active tasks                       │
│  └── Quick chat                         │
│                                         │
│  Memory Tab                       8h    │
│  ├── File browser                       │
│  ├── Preview de arquivos                │
│  └── Editor básico                      │
│                                         │
│  Tasks Tab                        4h    │
│  ├── Tasks do agente                    │
│  └── Stats de conclusão                 │
│                                         │
│  Logs Tab                         6h    │
│  ├── Tail de logs                       │
│  ├── Filtros por level                  │
│  └── Search                             │
│                                         │
│  Config Tab                       8h    │
│  ├── Edição de config                   │
│  ├── Model selection                    │
│  └── Capabilities toggles               │
│                                         │
│  TOTAL FASE 3:                   36h    │
│  (~4-5 dias úteis, 1 dev)               │
│                                         │
└─────────────────────────────────────────┘
```

**Entregáveis Fase 3:**
- [x] Página completa do agente com tabs
- [x] Visualização e edição de memória
- [x] Logs em tempo real
- [x] Configuração visual do agente

---

### Fase 4: Heartbeat + Standup (2 semanas)

**Objetivo:** Monitoramento proativo e relatórios automáticos

```
┌─────────────────────────────────────────┐
│      FASE 4 - HEARTBEAT + STANDUP       │
├─────────────────────────────────────────┤
│                                         │
│  Heartbeat System                24h    │
│  ├── Schema (HeartbeatLog, Health)      │
│  ├── Webhook receiver                   │
│  ├── Cron de detecção de misses         │
│  ├── Dashboard de monitoramento         │
│  └── Alertas básicos                    │
│                                         │
│  Cron Escalonado                  6h    │
│  ├── Algoritmo de escalonamento         │
│  ├── Integração com Clawdbot cron       │
│  └── Config por tenant                  │
│                                         │
│  Daily Standup                   16h    │
│  ├── Schema (DailyStandup, Config)      │
│  ├── Collector de dados                 │
│  ├── Gerador de relatório               │
│  ├── Página de histórico                │
│  └── Delivery multi-canal               │
│                                         │
│  TOTAL FASE 4:                   46h    │
│  (~6 dias úteis, 1 dev)                 │
│                                         │
└─────────────────────────────────────────┘
```

**Entregáveis Fase 4:**
- [x] Sistema de heartbeat completo
- [x] Dashboard de monitoramento
- [x] Standup automático diário
- [x] Delivery via WhatsApp/Telegram

---

### Fase 5: Real-time + Polish (1-2 semanas)

**Objetivo:** WebSocket e refinamentos de UX

```
┌─────────────────────────────────────────┐
│        FASE 5 - REALTIME + POLISH       │
├─────────────────────────────────────────┤
│                                         │
│  WebSocket Integration           12h    │
│  ├── Setup do servidor WS               │
│  ├── Eventos de agents                  │
│  ├── Eventos de tasks                   │
│  ├── Eventos de atividade               │
│  └── Reconexão automática               │
│                                         │
│  UX Improvements                 12h    │
│  ├── Loading states                     │
│  ├── Error handling                     │
│  ├── Tooltips e ajudas                  │
│  ├── Keyboard shortcuts                 │
│  └── Mobile responsive                  │
│                                         │
│  Quick Chat                       8h    │
│  ├── Interface de chat                  │
│  ├── Histórico recente                  │
│  └── Expand para full view              │
│                                         │
│  TOTAL FASE 5:                   32h    │
│  (~4 dias úteis, 1 dev)                 │
│                                         │
└─────────────────────────────────────────┘
```

**Entregáveis Fase 5:**
- [x] Updates em tempo real via WebSocket
- [x] UX polida e responsiva
- [x] Quick chat funcional

---

## 5. Estimativa Total de Esforço

### 5.1 Por Categoria

| Categoria | Horas | % |
|-----------|-------|---|
| **Schema Prisma** | 13h | 6% |
| **Páginas** | 90h | 41% |
| **APIs** | 48h | 22% |
| **Componentes** | 44h | 20% |
| **Integrações** | 34h | 16% |
| **Buffer (15%)** | 34h | - |
| **TOTAL** | **263h** | 100% |

### 5.2 Por Fase

| Fase | Descrição | Horas | Dias |
|------|-----------|-------|------|
| **Fase 1** | MVP Core | 56h | 7 |
| **Fase 2** | Kanban + Colaboração | 50h | 6 |
| **Fase 3** | Agent Detail | 36h | 5 |
| **Fase 4** | Heartbeat + Standup | 46h | 6 |
| **Fase 5** | Real-time + Polish | 32h | 4 |
| **Buffer** | Imprevistos | 34h | 4 |
| **TOTAL** | - | **254h** | **32 dias** |

### 5.3 Conversão para Semanas

```
1 dev, 8h/dia:  ~6-7 semanas
1 dev, 6h/dia:  ~8-9 semanas
2 devs, 8h/dia: ~3-4 semanas
```

**Recomendação:** 1 desenvolvedor por 7-8 semanas ou 2 desenvolvedores por 4 semanas.

---

## 6. Priorização das Features

### 6.1 Matriz de Priorização

| Feature | Impacto | Esforço | Prioridade |
|---------|---------|---------|------------|
| **Agent Cards + Status** | Alto | Baixo | 🔴 P0 |
| **Task List básica** | Alto | Baixo | 🔴 P0 |
| **Activity Feed** | Alto | Médio | 🔴 P0 |
| **Kanban Board** | Alto | Alto | 🟠 P1 |
| **Task Detail + Edit** | Alto | Médio | 🟠 P1 |
| **Comments/@mentions** | Médio | Médio | 🟠 P1 |
| **Agent Detail** | Médio | Alto | 🟡 P2 |
| **Memory Browser** | Médio | Médio | 🟡 P2 |
| **Heartbeat System** | Alto | Alto | 🟡 P2 |
| **Daily Standup** | Médio | Alto | 🟢 P3 |
| **WebSocket Real-time** | Médio | Alto | 🟢 P3 |
| **Quick Chat** | Baixo | Médio | 🟢 P3 |

### 6.2 MoSCoW

**Must Have (MVP):**
- Dashboard overview com agent cards
- Lista de tasks (tabela)
- Lista de agents
- APIs básicas CRUD

**Should Have (v1):**
- Kanban board
- Task detail com comentários
- @mentions
- Notificações in-app

**Could Have (v1.1):**
- Agent detail completo
- Memory browser
- Heartbeat monitoring
- Logs viewer

**Won't Have (v2):**
- Daily standup automático
- WebSocket real-time
- Quick chat
- AI summary

---

## 7. Dependências entre Tarefas

### 7.1 Diagrama de Dependências

```
FASE 1 (Schema + MVP)
├── Schema Prisma [sem deps]
│   ├── Agent model
│   ├── Task model
│   └── Activity model
├── APIs Base [depende: Schema]
│   ├── /api/agents
│   ├── /api/tasks
│   └── /api/activity
├── Dashboard Overview [depende: APIs]
├── Task List [depende: APIs]
└── Agent List [depende: APIs]

FASE 2 (Kanban + Colaboração)
├── Kanban Board [depende: Fase 1]
├── Task Detail [depende: Fase 1]
├── TaskComment model [depende: Schema]
├── Comments API [depende: TaskComment]
├── Comments UI [depende: Comments API]
├── Notification model [depende: Schema]
├── Notifications API [depende: Notification]
└── Notifications UI [depende: Notifications API]

FASE 3 (Agent Detail)
├── Agent Overview Tab [depende: Fase 1]
├── Memory Tab [depende: Clawdbot API]
├── Tasks Tab [depende: Fase 2]
├── Logs Tab [depende: Clawdbot API]
└── Config Tab [depende: Clawdbot API]

FASE 4 (Heartbeat + Standup)
├── HeartbeatLog model [depende: Schema]
├── AgentHealth model [depende: Schema]
├── Heartbeat Webhook [depende: HeartbeatLog]
├── Heartbeat Dashboard [depende: Webhook]
├── DailyStandup model [depende: Schema]
├── Standup Collector [depende: Fase 1]
├── Standup Generator [depende: Collector]
└── Standup Delivery [depende: Generator]

FASE 5 (Real-time + Polish)
├── WebSocket Server [sem deps]
├── WS Client Integration [depende: WS Server]
├── UX Improvements [depende: Fases 1-4]
└── Quick Chat [depende: Clawdbot API]
```

### 7.2 Caminho Crítico

```
Schema → APIs → Dashboard → Kanban → Task Detail → Comments
                                 ↓
                            Heartbeat → Standup
```

**Bloqueadores principais:**
1. Schema Prisma - tudo depende dele
2. APIs base - UI precisa das APIs
3. Clawdbot API - logs, memory, chat dependem

---

## 8. Riscos e Mitigações

### 8.1 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **FK circular Agent↔Task** | Média | Alto | onDelete: SetNull |
| **Performance com muitos agents** | Baixa | Médio | Pagination, lazy loading |
| **WebSocket scaling** | Média | Médio | Redis pub/sub |
| **Clawdbot API rate limit** | Baixa | Alto | Cache + queue |
| **Migration em prod** | Baixa | Alto | Tabelas novas, sem risco |

### 8.2 Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Scope creep** | Alta | Alto | PRD como contrato |
| **Time underestimated** | Média | Médio | Buffer de 15% |
| **UX confusa** | Média | Médio | User testing early |

### 8.3 Plano de Contingência

**Se atrasar:**
1. Cortar Fase 5 (Real-time)
2. Simplificar Standup (manual ao invés de auto)
3. Manter Activity feed read-only

**Se WebSocket for complexo:**
- Polling a cada 30s como fallback

---

## 9. Cronograma Sugerido

### 9.1 Timeline (1 Desenvolvedor)

```
Semana 1  │████████│ Fase 1 - Schema + APIs
Semana 2  │████████│ Fase 1 - Dashboard + Lists
Semana 3  │████████│ Fase 2 - Kanban Board
Semana 4  │████████│ Fase 2 - Task Detail + Comments
Semana 5  │████████│ Fase 3 - Agent Detail
Semana 6  │████████│ Fase 4 - Heartbeat System
Semana 7  │████████│ Fase 4 - Daily Standup
Semana 8  │████████│ Fase 5 - Polish + Buffer
```

### 9.2 Timeline (2 Desenvolvedores)

```
          Dev A                    Dev B
Semana 1  │ Schema + APIs        │ Components base
Semana 2  │ Dashboard + Lists    │ Kanban Board
Semana 3  │ Task Detail          │ Comments System
Semana 4  │ Agent Detail         │ Heartbeat System
Semana 5  │ Polish + Buffer      │ Standup + Real-time
```

### 9.3 Milestones

| Milestone | Data | Critério de Aceite |
|-----------|------|-------------------|
| **M1: MVP Alpha** | +2 sem | Dashboard + Task list funcionais |
| **M2: MVP Beta** | +4 sem | Kanban + Comments funcionais |
| **M3: v1.0** | +6 sem | Agent detail + Heartbeat |
| **M4: v1.1** | +8 sem | Standup + Real-time |

---

## 10. Checklist de Entrega

### Fase 1: MVP Core
- [ ] `npx prisma migrate dev --name add_mission_control_schema`
- [ ] Modelo Agent no Prisma
- [ ] Modelo Task no Prisma
- [ ] Modelo Activity no Prisma
- [ ] API `/api/agents` (CRUD)
- [ ] API `/api/tasks` (CRUD)
- [ ] API `/api/activity` (GET)
- [ ] Página `/mission-control` dashboard
- [ ] Página `/mission-control/tasks` lista
- [ ] Página `/mission-control/agents` lista
- [ ] Componente `AgentCard`
- [ ] Componente `StatusBadge`
- [ ] Navegação no sidebar

### Fase 2: Kanban + Colaboração
- [ ] Modelo TaskComment no Prisma
- [ ] Modelo AgentNotification no Prisma
- [ ] API `/api/tasks/[id]/comments` (CRUD)
- [ ] API `/api/notifications` (CRUD)
- [ ] Componente `KanbanBoard` com DnD
- [ ] Componente `TaskCard`
- [ ] Modal/página Task Detail
- [ ] Componente `CommentThread`
- [ ] Componente `MentionInput`
- [ ] Dropdown de notificações

### Fase 3: Agent Detail
- [ ] Página `/mission-control/agents/[id]`
- [ ] Tab Overview com stats
- [ ] Tab Memory com file browser
- [ ] Tab Tasks com lista filtrada
- [ ] Tab Logs com tail
- [ ] Tab Config com editor
- [ ] API `/api/agents/[id]/memory`
- [ ] API `/api/agents/[id]/logs`
- [ ] API `/api/agents/[id]/message`

### Fase 4: Heartbeat + Standup
- [ ] Modelo HeartbeatLog no Prisma
- [ ] Modelo AgentHealth no Prisma
- [ ] Modelo DailyStandup no Prisma
- [ ] Modelo StandupConfig no Prisma
- [ ] API `/api/heartbeat` webhook receiver
- [ ] Cron detector de misses
- [ ] Página `/mission-control/heartbeat`
- [ ] Collector de dados para standup
- [ ] Generator de relatório
- [ ] Página `/mission-control/standup`
- [ ] Delivery WhatsApp/Telegram

### Fase 5: Real-time + Polish
- [ ] WebSocket server setup
- [ ] Eventos de agents
- [ ] Eventos de tasks
- [ ] Eventos de activity
- [ ] Client-side WS integration
- [ ] Loading states em todas as páginas
- [ ] Error handling unificado
- [ ] Tooltips e ajudas
- [ ] Keyboard shortcuts
- [ ] Mobile responsive
- [ ] Quick chat widget

---

## 📚 Documentos de Referência

| Documento | Conteúdo |
|-----------|----------|
| `MISSION-CONTROL-SCHEMA.md` | Schema Prisma detalhado |
| `MISSION-CONTROL-PAGES.md` | Wireframes e especificações de UI |
| `MISSION-CONTROL-APIS.md` | Especificação completa das APIs |
| `MISSION-CONTROL-HEARTBEAT.md` | Sistema de heartbeat |
| `MISSION-CONTROL-STANDUP.md` | Sistema de standup diário |
| `ESTIMATIVA-SCHEMA.md` | Estimativa detalhada do schema |
| `ADMIN-AGENT-ARCHITECTURE.md` | Arquitetura do Admin Agent |
| `CLAWDBOT-BAAS-DATA-MAPPING.md` | Mapeamento de dados |
| `CLAWDBOT-FEATURES-TO-BAAS.md` | Features do Clawdbot para UI |
| `PLANO-INTEGRADO-BAAS.md` | Visão geral do BaaS |
| `PRD.md` | Product Requirements Document |

---

## ✅ Próximas Ações

1. **Aprovar cronograma** com stakeholders
2. **Criar branch** `feature/mission-control`
3. **Iniciar Fase 1** - Schema + APIs
4. **Setup de review** - PRs para cada milestone

---

*Documento consolidado em 2025-02-04 | Lobo 🐺*
