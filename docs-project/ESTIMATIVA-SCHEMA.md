# Estimativa: Schema + Migrations - Mission Control

**Data:** 2025-01-17  
**Autor:** Subagent (mc-estimate-schema)

---

## 📊 Resumo Executivo

| Categoria | Horas | Complexidade |
|-----------|-------|--------------|
| Novas Tabelas Prisma | 4-6h | Média |
| Migrations | 1-2h | Baixa |
| Seeds | 2-3h | Baixa |
| Relações Existentes | 1-2h | Baixa |
| **TOTAL** | **8-13h** | **Média** |

---

## 1. Novas Tabelas Prisma

### 1.1 Models do Mission Control

| Model | Campos | Relações | Esforço | Complexidade |
|-------|--------|----------|---------|--------------|
| `Agent` | 12 | 6 | 1h | Média |
| `Task` | 14 | 6 | 1.5h | Média |
| `TaskComment` | 8 | 5 | 45min | Baixa |
| `Activity` | 6 | 2 | 30min | Baixa |
| `AgentNotification` | 10 | 2 | 45min | Baixa |
| `Document` | 10 | 3 | 45min | Baixa |
| `CredentialPool` | 14 | 1 | 45min | Baixa |

**Subtotal: 6h**

### 1.2 Enums Necessários

| Enum | Valores | Esforço |
|------|---------|---------|
| `AgentStatus` | 4 | 5min |
| `TaskStatus` | 6 | 5min |
| `TaskPriority` | 4 | 5min |
| `ActivityType` | 12 | 10min |
| `NotificationPriority` | 4 | 5min |
| `DocumentType` | 9 | 5min |
| `CredentialType` | 2 | 5min |

**Subtotal: 40min (~0.7h)**

### 1.3 Índices e Constraints

Já definidos no schema proposto:
- 15+ índices para performance
- Unique constraints (Agent.name, Agent.sessionKey)
- Cascade deletes apropriados

**Subtotal: 30min (~0.5h)**

---

## 2. Migrations

### 2.1 Strategy

O projeto já usa Prisma com PostgreSQL. A migration será incremental:

```bash
npx prisma migrate dev --name add_mission_control_schema
```

### 2.2 Tarefas

| Tarefa | Esforço | Risco |
|--------|---------|-------|
| Gerar migration | 10min | Baixo |
| Validar SQL gerado | 20min | Baixo |
| Testar em dev | 30min | Baixo |
| Aplicar em prod | 15min | Médio |
| Rollback plan | 15min | Baixo |

**Subtotal: 1.5h**

### 2.3 Riscos

- ✅ **Baixo**: Tabelas novas, não alteram existentes
- ✅ **Baixo**: Sem dados para migrar (greenfield)
- ⚠️ **Médio**: Validar que FK para Tenant não quebra

---

## 3. Seeds

### 3.1 Dados Iniciais Necessários

| Seed | Descrição | Registros | Esforço |
|------|-----------|-----------|---------|
| Agentes padrão | researcher, developer, reviewer | 3-5 | 30min |
| Task de exemplo | Demo task com subtasks | 2-3 | 30min |
| Activity inicial | System startup logs | 5-10 | 20min |
| Document templates | Spec, Code, Report | 3 | 20min |
| Agent capabilities | Preset capabilities | 10-15 | 30min |

**Subtotal: 2.5h**

### 3.2 Arquivo de Seed

```typescript
// prisma/seed-mission-control.ts
async function seedMissionControl() {
  // 1. Criar agentes base
  // 2. Criar task de exemplo
  // 3. Criar activity inicial
  // 4. Vincular ao tenant de demo
}
```

---

## 4. Relações com Tabelas Existentes

### 4.1 Integrações Necessárias

| Relação | De → Para | Tipo | Esforço |
|---------|-----------|------|---------|
| Agent → Tenant | FK opcional | N:1 | 30min |
| Task → Workspace | FK opcional | N:1 | 30min |
| Activity → User | FK opcional | N:1 | 15min |
| CredentialPool → Tenant | FK obrigatório | N:1 | 15min |

**Subtotal: 1.5h**

### 4.2 Considerações

**Tenant:**
- Agentes podem ser globais (sem tenant) ou por tenant
- CredentialPool é sempre por tenant
- Recomendação: manter tenantId opcional em Agent/Task para flexibilidade

**User:**
- Activities podem ser de User ou Agent
- Usar campo `actorType: 'USER' | 'AGENT'` + `actorId`

**Workspace:**
- Tasks podem ou não estar vinculadas a um workspace
- Sugestão: workspaceId opcional para organização

---

## 5. Schema Final Proposto

### 5.1 Adições ao schema.prisma

```prisma
// ============================================
// MISSION CONTROL - Coordenação Multi-Agente
// ============================================

model Agent {
  id            String        @id @default(cuid())
  tenantId      String?       // Opcional: null = agente global
  name          String        @unique
  role          String
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
  
  tenant        Tenant?       @relation(fields: [tenantId], references: [id])
  currentTask   Task?         @relation("AgentCurrentTask", fields: [currentTaskId], references: [id])
  assignedTasks Task[]        @relation("TaskAssignees")
  comments      TaskComment[]
  activities    Activity[]
  notifications AgentNotification[]
  documents     Document[]

  @@index([tenantId])
  @@index([status])
  @@index([sessionKey])
}

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

  tenant       Tenant?      @relation(fields: [tenantId], references: [id])
  workspace    Workspace?   @relation(fields: [workspaceId], references: [id])
  parent       Task?        @relation("TaskSubtasks", fields: [parentId], references: [id])
  subtasks     Task[]       @relation("TaskSubtasks")
  currentAgent Agent?       @relation("AgentCurrentTask")
  assignees    Agent[]      @relation("TaskAssignees")
  comments     TaskComment[]
  activities   Activity[]
  documents    Document[]

  @@index([tenantId])
  @@index([workspaceId])
  @@index([status])
  @@index([priority])
  @@index([parentId])
}

model TaskComment {
  id          String    @id @default(cuid())
  taskId      String
  fromAgentId String
  parentId    String?
  content     String    @db.Text
  attachments Json?     @default("[]")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  fromAgent   Agent     @relation(fields: [fromAgentId], references: [id])
  parent      TaskComment? @relation("CommentThread", fields: [parentId], references: [id])
  replies     TaskComment[] @relation("CommentThread")
  notifications AgentNotification[]

  @@index([taskId])
  @@index([fromAgentId])
  @@index([parentId])
}

model Activity {
  id        String       @id @default(cuid())
  type      ActivityType
  message   String       @db.Text
  metadata  Json?        @default("{}")
  agentId   String?
  taskId    String?
  createdAt DateTime     @default(now())

  agent     Agent?       @relation(fields: [agentId], references: [id])
  task      Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([type])
  @@index([agentId])
  @@index([taskId])
  @@index([createdAt])
}

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

  mentionedAgent   Agent                @relation(fields: [mentionedAgentId], references: [id])
  comment          TaskComment?         @relation(fields: [commentId], references: [id], onDelete: SetNull)

  @@index([mentionedAgentId, delivered])
  @@index([createdAt])
}

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

  task      Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  author    Agent?       @relation(fields: [authorId], references: [id])

  @@index([taskId])
  @@index([type])
  @@index([authorId])
}

model CredentialPool {
  id           String         @id @default(cuid())
  tenantId     String
  type         CredentialType
  provider     String
  accessToken  String?
  refreshToken String?
  expiresAt    DateTime?
  apiKey       String?
  dailyLimit   Int            @default(1000000)
  dailyUsed    Int            @default(0)
  usagePercent Float          @default(100)
  isEmergency  Boolean        @default(false)
  isActive     Boolean        @default(true)
  priority     Int            @default(0)
  lastUsedAt   DateTime?
  lastCheckAt  DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  tenant       Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([type])
  @@index([isActive])
}

// Enums
enum AgentStatus {
  IDLE
  WORKING
  BLOCKED
  OFFLINE
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  BLOCKED
  DONE
  CANCELLED
}

enum TaskPriority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ActivityType {
  AGENT_STARTED
  AGENT_STOPPED
  AGENT_STATUS_CHANGED
  TASK_CREATED
  TASK_ASSIGNED
  TASK_STARTED
  TASK_UPDATED
  TASK_COMPLETED
  TASK_BLOCKED
  COMMENT_ADDED
  MENTION_SENT
  DOCUMENT_CREATED
  SYSTEM_ERROR
  SYSTEM_INFO
}

enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum DocumentType {
  SPEC
  CODE
  TEST
  REPORT
  NOTE
  ANALYSIS
  PLAN
  REVIEW
  OTHER
}

enum CredentialType {
  OAUTH
  API_KEY
}
```

### 5.2 Atualizar Tenant Model

```prisma
model Tenant {
  // ... campos existentes ...
  
  // Adicionar:
  Agent          Agent[]
  Task           Task[]
  CredentialPool CredentialPool[]
}
```

### 5.3 Atualizar Workspace Model

```prisma
model Workspace {
  // ... campos existentes ...
  
  // Adicionar:
  Task           Task[]
}
```

---

## 6. Cronograma Sugerido

| Dia | Atividade | Horas |
|-----|-----------|-------|
| 1 | Adicionar models ao schema.prisma | 3h |
| 1 | Validar relações e índices | 1h |
| 1 | Gerar e testar migration (dev) | 1h |
| 2 | Criar seeds | 2h |
| 2 | Testar seeds | 1h |
| 2 | Documentação | 1h |
| 3 | Code review | 1h |
| 3 | Deploy em staging | 1h |
| 3 | Deploy em prod | 1h |

**Total: 12h (1.5 dias úteis)**

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| FK circular Agent↔Task | Média | Alto | Usar onDelete: SetNull |
| Performance com muitos índices | Baixa | Médio | Monitorar queries lentas |
| Migration em prod com dados | Baixa | Alto | Tabelas novas, sem risco |
| Conflito de nomes (Agent vs AdminAgent) | Baixa | Baixo | Nomes distintos, OK |

---

## 8. Conclusão

### Complexidade Geral: **MÉDIA**

**Justificativa:**
- ✅ Schema bem definido no documento de referência
- ✅ Tabelas novas (não modificam existentes)
- ✅ Prisma facilita migrations
- ⚠️ Múltiplas relações requerem atenção
- ⚠️ Seeds precisam de dados realistas

### Recomendações:

1. **Implementar em etapas:**
   - Fase 1: Agent + Task + Activity (core)
   - Fase 2: TaskComment + AgentNotification (colaboração)
   - Fase 3: Document + CredentialPool (suporte)

2. **Testar bem as relações:**
   - Agent.currentTask ↔ Task.currentAgent (1:1)
   - Agent.assignedTasks ↔ Task.assignees (N:M implícito)

3. **Seeds por ambiente:**
   - Dev: Dados completos para teste
   - Staging: Subset realista
   - Prod: Apenas configs base

---

*Estimativa gerada em 2025-01-17*
