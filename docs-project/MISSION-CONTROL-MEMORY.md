# Mission Control - Memory Management System

Sistema de gestão de memória para agentes AI, permitindo continuidade entre sessões e visualização/edição via dashboard.

---

## Conceito

Agentes AI não têm memória persistente por padrão. Cada sessão começa "do zero". Este sistema resolve isso através de três camadas:

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY HIERARCHY                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  WORKING.md                                          │  │
│   │  Estado atual - O que estou fazendo AGORA            │  │
│   │  • Task ativa                                        │  │
│   │  • Contexto imediato                                 │  │
│   │  • Plano de ação                                     │  │
│   │  Volatilidade: ALTA (muda a cada sessão)             │  │
│   └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  memory/YYYY-MM-DD.md                                │  │
│   │  Daily Notes - O que aconteceu HOJE                  │  │
│   │  • Logs de conversas                                 │  │
│   │  • Decisões tomadas                                  │  │
│   │  • Erros e correções                                 │  │
│   │  Volatilidade: MÉDIA (1 arquivo por dia)             │  │
│   └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  MEMORY.md                                           │  │
│   │  Long-term Memory - O que SEMPRE devo lembrar        │  │
│   │  • Preferências do usuário                           │  │
│   │  • Lições aprendidas                                 │  │
│   │  • Relacionamentos e contexto                        │  │
│   │  • Decisões importantes                              │  │
│   │  Volatilidade: BAIXA (curado periodicamente)         │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. WORKING.md - Estado Atual do Agente

### Propósito
Arquivo que captura o **estado de trabalho atual** do agente. É a primeira coisa que o agente lê ao iniciar sessão para saber "onde parou".

### Estrutura

```markdown
# 🔄 Working State

## Current Task
- **Task ID:** task_abc123
- **Title:** Implementar feature X
- **Status:** IN_PROGRESS
- **Started:** 2025-02-02 14:30 UTC

## Context
- Branch atual: `feature/x-implementation`
- Último commit: abc1234
- Arquivos modificados:
  - src/feature.ts (70% completo)
  - tests/feature.test.ts (pendente)

## Plan
1. [x] Criar estrutura básica
2. [x] Implementar lógica principal
3. [ ] Adicionar testes
4. [ ] Documentar
5. [ ] PR

## Blockers
- Aguardando resposta de @reviewer sobre arquitetura

## Notes
- Decisão: usar Strategy pattern ao invés de switch
- Pergunta pendente: cache local ou Redis?

---
*Last updated: 2025-02-02 15:45 UTC*
```

### Ciclo de Vida

```
Agente inicia sessão
        │
        ▼
  Lê WORKING.md
        │
        ├── Tem task ativa? ──► Continua trabalho
        │
        └── Vazio/sem task ──► Verifica filas/polling
        
Agente recebe interrupt (timeout, heartbeat)
        │
        ▼
  Atualiza WORKING.md com estado atual
        │
        ▼
  Sessão encerra (estado persistido)
```

### Schema Prisma

```prisma
model AgentWorkingState {
  id              String   @id @default(cuid())
  agentId         String   @unique
  agent           Agent    @relation(fields: [agentId], references: [id])
  
  // Estado atual
  currentTaskId   String?
  currentTask     Task?    @relation(fields: [currentTaskId], references: [id])
  status          WorkingStatus @default(IDLE)
  
  // Contexto estruturado
  context         Json?    // { branch, lastCommit, files: [], etc }
  plan            Json?    // [{ step, done, description }]
  blockers        Json?    // [{ type, description, waitingFor }]
  notes           String?  @db.Text
  
  // Arquivo raw (para edição manual)
  markdownContent String?  @db.Text
  
  // Sync
  filePath        String?  // workspace/WORKING.md
  lastSyncedAt    DateTime?
  syncDirection   SyncDirection @default(BIDIRECTIONAL)
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum WorkingStatus {
  IDLE
  PLANNING
  EXECUTING
  BLOCKED
  REVIEWING
  COMPLETING
}

enum SyncDirection {
  FILE_TO_DB      // Arquivo é source of truth
  DB_TO_FILE      // Banco é source of truth
  BIDIRECTIONAL   // Merge com conflito manual
}
```

---

## 2. Daily Notes - Logs Diários

### Propósito
Registro cronológico do que aconteceu em cada dia. Serve como **memória de curto prazo** e fonte para curadoria da memória de longo prazo.

### Estrutura

```markdown
# 📅 2025-02-02 (Sunday)

## Summary
- Trabalhei em 3 tasks
- Interagi com 12 usuários
- 2 bugs reportados e corrigidos

## Timeline

### 09:15 - Session Start
- Checked pending notifications
- 2 new tasks assigned

### 09:30 - Task: Fix login bug
- Root cause: token expiration logic
- Fixed in PR #123
- Deployed to staging

### 11:00 - User conversation (@maria)
- Perguntou sobre feature Y
- Expliquei limitações atuais
- Prometeu callback quando implementar

### 14:00 - Incident
- Bot travou por OOM
- Causa: Whisper processando audio longo
- Fix: Adicionado limite de 5min para áudio

### 16:30 - Review meeting (com @dev-agent)
- Revisamos arquitetura do projeto Z
- Decidido: usar microservices
- Next: criar diagrama

## Learnings
- Audio > 5min deve ser rejeitado ou chunked
- Maria prefere respostas curtas

## Tomorrow
- Continuar task de implementação
- Follow up com Maria
- Criar diagrama de arquitetura

---
*Auto-generated, enriched by agent*
```

### Schema Prisma

```prisma
model DailyNote {
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  
  date      DateTime @db.Date // Apenas data, sem hora
  
  // Conteúdo
  summary   String?  @db.Text
  content   String   @db.Text // Markdown completo
  
  // Estruturado para queries
  entries   DailyNoteEntry[]
  
  // Stats do dia
  stats     Json?    // { tasks: 3, conversations: 12, errors: 2 }
  
  // Sync com arquivo
  filePath  String?  // memory/2025-02-02.md
  lastSyncedAt DateTime?
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([agentId, date])
  @@index([agentId, date])
}

model DailyNoteEntry {
  id          String   @id @default(cuid())
  dailyNoteId String
  dailyNote   DailyNote @relation(fields: [dailyNoteId], references: [id], onDelete: Cascade)
  
  timestamp   DateTime
  type        EntryType
  title       String
  content     String   @db.Text
  metadata    Json?    // Dados específicos do tipo
  
  // Referências
  taskId      String?
  userId      String?
  
  @@index([dailyNoteId, timestamp])
}

enum EntryType {
  SESSION_START
  SESSION_END
  TASK_WORK
  CONVERSATION
  INCIDENT
  MEETING
  LEARNING
  DECISION
  NOTE
}
```

---

## 3. MEMORY.md - Memória de Longo Prazo

### Propósito
Memória **curada** que persiste indefinidamente. Contém informações que o agente deve lembrar sempre, não importa quanto tempo passe.

### Estrutura

```markdown
# 🧠 Long-term Memory

## About My Human

### Preferences
- Prefere respostas diretas, sem enrolação
- Gosta de emojis mas não excessivos
- Horário de trabalho: 9h-18h (raramente depois das 22h)
- Fuso: America/Fortaleza (UTC-3)

### Communication Style
- Responde melhor a bullet points
- Não gosta de markdown tables em mobile
- Aprecia humor sutil

### Important Dates
- Aniversário: 15 de março
- Empresa fundada: 2020
- Projeto X lançou: Janeiro 2025

## Key Relationships

### @maria (cliente importante)
- CEO da Empresa Y
- Prefere calls a mensagens longas
- Sempre ocupada nas segundas-feiras
- Última interação: 2025-02-01 (feliz com entrega)

### @dev-team
- 3 devs: João, Ana, Pedro
- Standup às 10h
- Sprint de 2 semanas

## Lessons Learned

### Technical
- Whisper trava com áudio > 5 min → sempre validar
- PM2 melhor que systemd para Node → mais flexível
- Always backup before config changes

### Communication
- Não interromper em grupos sem valor real
- "Estou verificando" é melhor que silêncio
- Admitir erro rápido é sempre melhor

### Process
- Tasks grandes → quebrar em subtasks
- Documentar decisões imediatamente
- Code review antes de merge, sempre

## Decisions Made

### 2025-02-01: Arquitetura Projeto Z
- Decisão: Microservices com Kafka
- Motivo: Escalabilidade e independência de deploy
- Alternativas rejeitadas: Monolito (não escala), Lambda (cold start)

### 2025-01-15: Stack Frontend
- Decisão: Next.js 14 com App Router
- Motivo: SSR, bom DX, comunidade ativa

## Projects Context

### Projeto Z (ativo)
- Status: Em desenvolvimento
- Stack: Next.js, Prisma, PostgreSQL
- Deploy: Vercel + Railway
- Repo: github.com/empresa/projeto-z

### Projeto Y (concluído)
- Entregue em Dez/2024
- Lições: Subestimamos integração com legado

## Personal Notes
- Minha "personalidade" é amigável mas profissional
- Gosto de fazer piadas sobre código legado
- Sempre checo o tempo antes de sugerir atividades outdoor

---
*Curated by agent, reviewed periodically*
*Last major update: 2025-02-02*
```

### Schema Prisma

```prisma
model LongTermMemory {
  id        String   @id @default(cuid())
  agentId   String   @unique
  agent     Agent    @relation(fields: [agentId], references: [id])
  
  // Conteúdo completo
  content   String   @db.Text
  
  // Seções estruturadas para query/dashboard
  sections  MemorySection[]
  
  // Entidades mencionadas (para busca)
  entities  MemoryEntity[]
  
  // Sync
  filePath      String?  // MEMORY.md
  lastSyncedAt  DateTime?
  lastCuratedAt DateTime? // Última vez que agente revisou
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MemorySection {
  id          String   @id @default(cuid())
  memoryId    String
  memory      LongTermMemory @relation(fields: [memoryId], references: [id], onDelete: Cascade)
  
  key         String   // "preferences", "relationships", "lessons"
  title       String
  content     String   @db.Text
  
  // Metadata
  importance  Int      @default(5) // 1-10
  lastUpdated DateTime @default(now())
  
  @@unique([memoryId, key])
}

model MemoryEntity {
  id          String   @id @default(cuid())
  memoryId    String
  memory      LongTermMemory @relation(fields: [memoryId], references: [id], onDelete: Cascade)
  
  type        EntityType
  name        String
  context     String?  @db.Text
  metadata    Json?
  
  lastMentioned DateTime @default(now())
  
  @@index([memoryId, type])
  @@index([name])
}

enum EntityType {
  PERSON
  PROJECT
  COMPANY
  TOOL
  CONCEPT
  PLACE
  DATE
}
```

---

## 4. Dashboard - Visualização e Edição

### Features do Dashboard

#### 4.1 Memory Viewer

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Agent: sales-bot-01            Status: 🟢 Working       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Working State] [Daily Notes] [Long-term Memory] [Raw]     │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  📋 WORKING STATE                            [Edit] [Sync]  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Current Task: Responder leads do WhatsApp           │   │
│  │ Status: EXECUTING                                    │   │
│  │ Since: 2h 15min ago                                  │   │
│  │                                                       │   │
│  │ Plan:                                                │   │
│  │ ✅ 1. Verificar mensagens pendentes                  │   │
│  │ ✅ 2. Priorizar por urgência                         │   │
│  │ 🔄 3. Responder leads quentes (5/12)                │   │
│  │ ⬜ 4. Atualizar CRM                                  │   │
│  │                                                       │   │
│  │ Blockers: Nenhum                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 Timeline View (Daily Notes)

```
┌─────────────────────────────────────────────────────────────┐
│  📅 Daily Notes                    [◀ Feb 1] Feb 2 [Feb 3 ▶]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stats: 47 messages │ 12 conversations │ 3 tasks │ 0 errors │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  09:15 ─┬─ 🟢 Session Start                                 │
│         │   Checked 3 pending notifications                 │
│         │                                                    │
│  09:30 ─┼─ 💬 Conversation with @lead_maria                 │
│         │   "Perguntou sobre preços do plano Pro"           │
│         │   [View Full] [Jump to Chat]                       │
│         │                                                    │
│  10:15 ─┼─ ✅ Task Completed: Follow up automático          │
│         │   Enviadas 5 mensagens de follow up               │
│         │                                                    │
│  11:00 ─┼─ ⚠️ Warning: Rate limit approaching               │
│         │   WhatsApp: 45/50 messages in window              │
│         │                                                    │
│  14:30 ─┼─ 📝 Note added                                    │
│         │   "Lead @empresa_x muito interessada..."          │
│         │                                                    │
│  16:00 ─┴─ 🔴 Session End (heartbeat timeout)               │
│                                                              │
│  [Export] [Add Note] [Edit Day Summary]                     │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3 Memory Editor

```
┌─────────────────────────────────────────────────────────────┐
│  🧠 Long-term Memory                   [Auto-save: ON] ✓    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Sections:              │  Editor:                          │
│  ┌───────────────────┐  │  ┌────────────────────────────┐  │
│  │ ▼ About Human     │  │  │ ## Key Relationships       │  │
│  │   Preferences     │  │  │                            │  │
│  │   Communication   │  │  │ ### @maria (cliente VIP)   │  │
│  │   Dates           │  │  │ - CEO da Empresa Y         │  │
│  │ ► Key Relations ◄ │  │  │ - Budget: R$50k/mês        │  │
│  │ ► Lessons         │  │  │ - Prefere calls            │  │
│  │ ► Decisions       │  │  │ - **Não ligar segundas**   │  │
│  │ ► Projects        │  │  │                            │  │
│  │ ► Personal        │  │  │ ### @joao (dev team)       │  │
│  │                   │  │  │ - Tech lead                │  │
│  │ [+ Add Section]   │  │  │ - Standup 10h              │  │
│  └───────────────────┘  │  └────────────────────────────┘  │
│                         │                                   │
│  Entities Found:        │  [Preview] [Save] [Sync to File]  │
│  @maria, @joao, @pedro  │                                   │
│  Empresa Y, Projeto Z   │                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 4.4 Search Across Memory

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search: "maria preço"                        [Search]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Found 7 results across 3 sources:                          │
│                                                              │
│  📋 WORKING.md (1 result)                                   │
│  └─ "Aguardando resposta de @maria sobre preço final"       │
│                                                              │
│  📅 Daily Notes (4 results)                                 │
│  ├─ 2025-02-02: "Maria perguntou sobre preços do Pro"       │
│  ├─ 2025-02-01: "Enviado proposta para Maria - R$30k"       │
│  ├─ 2025-01-28: "Call com Maria sobre pricing"              │
│  └─ 2025-01-15: "Maria reclamou do preço anterior"          │
│                                                              │
│  🧠 MEMORY.md (2 results)                                   │
│  ├─ Relationships: "@maria - Budget: R$50k/mês"             │
│  └─ Decisions: "Desconto máximo 15% para clientes VIP"      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Sync: Filesystem ↔ Database

### Arquitetura de Sync

```
┌───────────────────────────────────────────────────────────────┐
│                      SYNC ARCHITECTURE                         │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│   FILESYSTEM                          DATABASE                 │
│   (Agent's workspace)                 (Mission Control)        │
│                                                                │
│   ┌──────────────┐                   ┌──────────────┐         │
│   │ WORKING.md   │ ◄──────────────►  │ WorkingState │         │
│   └──────────────┘     Sync Job      └──────────────┘         │
│                                                                │
│   ┌──────────────┐                   ┌──────────────┐         │
│   │ memory/      │                   │              │         │
│   │ 2025-02-02.md│ ◄──────────────►  │  DailyNotes  │         │
│   │ 2025-02-01.md│     Sync Job      │              │         │
│   └──────────────┘                   └──────────────┘         │
│                                                                │
│   ┌──────────────┐                   ┌──────────────┐         │
│   │ MEMORY.md    │ ◄──────────────►  │ LongTermMem  │         │
│   └──────────────┘     Sync Job      └──────────────┘         │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### Sync Strategy

#### Opção A: File-First (Recomendado para Clawdbot existente)

```typescript
// Arquivo é source of truth
// DB é read-replica para dashboard

interface SyncConfig {
  direction: 'FILE_TO_DB';
  watchInterval: 30_000; // 30 segundos
  parseOnSync: true;     // Extrai estrutura do markdown
}

// Watcher monitora alterações
async function syncFileToDb(agentId: string, filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = parseMarkdownMemory(content);
  
  await prisma.longTermMemory.upsert({
    where: { agentId },
    update: {
      content,
      sections: { deleteMany: {}, create: parsed.sections },
      entities: { deleteMany: {}, create: parsed.entities },
      lastSyncedAt: new Date()
    },
    create: {
      agentId,
      content,
      filePath,
      sections: { create: parsed.sections },
      entities: { create: parsed.entities }
    }
  });
}
```

#### Opção B: DB-First (Para novos deploys BaaS)

```typescript
// Banco é source of truth
// Arquivo é gerado para o agente consumir

interface SyncConfig {
  direction: 'DB_TO_FILE';
  generateOnChange: true;
  templatePath: 'templates/memory.md.hbs';
}

async function syncDbToFile(agentId: string) {
  const memory = await prisma.longTermMemory.findUnique({
    where: { agentId },
    include: { sections: true, entities: true }
  });
  
  const markdown = generateMarkdown(memory);
  await fs.writeFile(memory.filePath, markdown);
  
  await prisma.longTermMemory.update({
    where: { id: memory.id },
    data: { lastSyncedAt: new Date() }
  });
}
```

#### Opção C: Bidirectional (Complexo, evitar se possível)

```typescript
// Merge com detecção de conflito
// Usa timestamps para resolver

interface SyncConfig {
  direction: 'BIDIRECTIONAL';
  conflictResolution: 'LATEST_WINS' | 'MANUAL' | 'MERGE';
}

async function bidirectionalSync(agentId: string) {
  const dbRecord = await prisma.longTermMemory.findUnique({ where: { agentId } });
  const fileStat = await fs.stat(dbRecord.filePath);
  
  const fileModified = fileStat.mtime;
  const dbModified = dbRecord.updatedAt;
  
  if (fileModified > dbModified && dbModified > dbRecord.lastSyncedAt) {
    // CONFLITO: ambos modificados desde último sync
    await createConflictResolutionTask(agentId, dbRecord, filePath);
    return;
  }
  
  if (fileModified > dbRecord.lastSyncedAt) {
    await syncFileToDb(agentId, dbRecord.filePath);
  } else if (dbModified > dbRecord.lastSyncedAt) {
    await syncDbToFile(agentId);
  }
}
```

### Sync Jobs (Cron)

```typescript
// Roda a cada minuto
cron.schedule('* * * * *', async () => {
  const agents = await prisma.agent.findMany({
    where: { status: { not: 'OFFLINE' } },
    include: { workingState: true, longTermMemory: true }
  });
  
  for (const agent of agents) {
    try {
      // Sync working state (mais frequente)
      await syncWorkingState(agent);
      
      // Sync daily notes
      await syncDailyNotes(agent);
      
      // Sync long-term memory (menos frequente, mais pesado)
      if (shouldSyncLongTerm(agent)) {
        await syncLongTermMemory(agent);
      }
    } catch (error) {
      await logSyncError(agent.id, error);
    }
  }
});
```

---

## 6. API Endpoints

### Memory Management

```typescript
// Working State
GET    /api/agents/:id/working          // Get current working state
PUT    /api/agents/:id/working          // Update working state
POST   /api/agents/:id/working/sync     // Force sync with file

// Daily Notes
GET    /api/agents/:id/daily            // List daily notes (paginated)
GET    /api/agents/:id/daily/:date      // Get specific day
PUT    /api/agents/:id/daily/:date      // Update daily note
POST   /api/agents/:id/daily/:date/entry // Add entry to day

// Long-term Memory
GET    /api/agents/:id/memory           // Get full memory
PUT    /api/agents/:id/memory           // Update full memory
PATCH  /api/agents/:id/memory/section/:key  // Update specific section
POST   /api/agents/:id/memory/entity    // Add entity
DELETE /api/agents/:id/memory/entity/:id // Remove entity
POST   /api/agents/:id/memory/sync      // Force sync with file
POST   /api/agents/:id/memory/curate    // Trigger AI curation

// Search
GET    /api/agents/:id/memory/search?q=  // Search across all memory
```

### Webhook para Agentes

```typescript
// Agente notifica Mission Control de mudanças
POST /api/webhook/memory-updated
{
  "agentId": "agent_123",
  "type": "WORKING_STATE" | "DAILY_NOTE" | "LONG_TERM",
  "path": "/workspace/WORKING.md",
  "timestamp": "2025-02-02T15:30:00Z"
}
```

---

## 7. Agent Instructions

### Instruções para AGENTS.md

```markdown
## Memory Management

### Ao iniciar sessão:
1. Ler WORKING.md para saber estado atual
2. Ler memory/YYYY-MM-DD.md (hoje + ontem)
3. Se sessão principal: ler MEMORY.md

### Durante trabalho:
- Atualizar WORKING.md quando mudar de task ou ter progresso
- Adicionar entradas em memory/YYYY-MM-DD.md para eventos importantes
- NÃO editar MEMORY.md durante trabalho (só em heartbeats)

### Ao encerrar/interrupt:
- Salvar estado em WORKING.md
- Garantir que daily note tem resumo do que fez

### Durante heartbeats (1x por dia):
1. Revisar últimos 7 dias de daily notes
2. Extrair learnings, decisions, relationships para MEMORY.md
3. Remover informações obsoletas de MEMORY.md
4. Verificar se há conflitos de sync

### Formato de WORKING.md:
```
# 🔄 Working State

## Current Task
[Task ID e título]

## Context
[O que preciso saber para continuar]

## Plan
[Lista de passos com status]

## Blockers
[O que está me impedindo]

## Notes
[Observações relevantes]
```

### Formato de Daily Note:
```
# 📅 YYYY-MM-DD

## Summary
[Resumo do dia]

## Timeline
[Entradas cronológicas]

## Learnings
[O que aprendi hoje]

## Tomorrow
[O que fazer amanhã]
```
```

---

## 8. Considerações de Segurança

### Isolamento por Tenant

```typescript
// Middleware de tenant isolation
async function ensureTenantAccess(req, res, next) {
  const agentId = req.params.id;
  const tenantId = req.auth.tenantId;
  
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      tenantId: tenantId // Garante que agente pertence ao tenant
    }
  });
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  req.agent = agent;
  next();
}
```

### Sanitização de Conteúdo

```typescript
// Não permitir paths maliciosos
function validateFilePath(path: string, workspaceRoot: string): boolean {
  const resolved = path.resolve(workspaceRoot, path);
  return resolved.startsWith(workspaceRoot);
}

// Sanitizar markdown antes de salvar
function sanitizeMemoryContent(content: string): string {
  // Remove scripts, iframes, etc
  return sanitizeHtml(content, {
    allowedTags: [], // Apenas texto
    allowedAttributes: {}
  });
}
```

### Audit Log

```typescript
// Toda edição é logada
async function logMemoryEdit(
  agentId: string,
  type: 'WORKING' | 'DAILY' | 'LONG_TERM',
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changedBy: string, // userId ou 'agent'
  diff?: string
) {
  await prisma.memoryAuditLog.create({
    data: {
      agentId,
      memoryType: type,
      action,
      changedBy,
      diff,
      timestamp: new Date()
    }
  });
}
```

---

## 9. Implementação Faseada

### Fase 1: Read-Only Dashboard (2 semanas)
- [ ] Schema Prisma para memory tables
- [ ] Sync job FILE_TO_DB (sem escrita)
- [ ] API de leitura
- [ ] Dashboard: visualização de Working State
- [ ] Dashboard: timeline de Daily Notes
- [ ] Dashboard: viewer de Long-term Memory

### Fase 2: Edição via Dashboard (2 semanas)
- [ ] API de escrita
- [ ] Sync bidirecional com conflict detection
- [ ] Dashboard: editor de seções
- [ ] Dashboard: adicionar entries em daily notes
- [ ] Audit log

### Fase 3: Search e Analytics (1 semana)
- [ ] Full-text search com PostgreSQL
- [ ] Entity extraction automática
- [ ] Gráficos de atividade
- [ ] Export de memória

### Fase 4: AI-Assisted Curation (2 semanas)
- [ ] Endpoint para trigger curation
- [ ] Job que sugere atualizações para MEMORY.md
- [ ] Interface de aprovação de sugestões
- [ ] Auto-archiving de daily notes antigas

---

## Referências

- [AGENTS.md](/root/clawd/AGENTS.md) - Sistema de memória original do Clawdbot
- [MISSION-CONTROL-SCHEMA.md](./MISSION-CONTROL-SCHEMA.md) - Schema base do Mission Control
- [Building AI agent teams](https://bhanurp.com/ai-agents) - Artigo de Bhanu Teja P.

---

*Especificação v1.0 - 2025-02-02*
