# Mission Control - Prisma Schema

Schema para coordenação multi-agente inspirado no artigo de Bhanu Teja Pachipulusu.

## Overview

O Mission Control é o hub central onde agentes:
- Recebem e atualizam tarefas
- Colaboram via comentários
- Registram atividades
- Notificam outros agentes via @menções

---

## Schema Prisma

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// AGENT - Representa um agente AI no sistema
// ============================================
model Agent {
  id            String    @id @default(cuid())
  name          String    @unique
  role          String    // ex: "developer", "researcher", "reviewer"
  description   String?   // O que esse agente faz
  status        AgentStatus @default(IDLE)
  sessionKey    String?   @unique // Chave da sessão ativa
  currentTaskId String?   // Task em que está trabalhando
  
  // Configurações
  model         String?   // ex: "claude-sonnet-4-20250514", "gpt-4"
  systemPrompt  String?   @db.Text
  capabilities  String[]  // ex: ["code", "web_search", "browser"]
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastActiveAt  DateTime?
  
  // Relações
  currentTask   Task?     @relation("CurrentTask", fields: [currentTaskId], references: [id])
  assignedTasks Task[]    @relation("AssignedTasks")
  comments      TaskComment[]
  activities    Activity[]
  notifications AgentNotification[]
  documents     Document[]
  
  @@index([status])
  @@index([sessionKey])
}

enum AgentStatus {
  IDLE        // Disponível para novas tarefas
  WORKING     // Executando uma tarefa
  BLOCKED     // Aguardando input/aprovação
  OFFLINE     // Não está rodando
}

// ============================================
// TASK - Unidade de trabalho
// ============================================
model Task {
  id          String     @id @default(cuid())
  title       String
  description String     @db.Text
  status      TaskStatus @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  
  // Contexto
  context     String?    @db.Text  // Informações adicionais
  acceptance  String?    @db.Text  // Critérios de aceitação
  output      String?    @db.Text  // Resultado final
  
  // Hierarquia
  parentId    String?
  parent      Task?      @relation("Subtasks", fields: [parentId], references: [id])
  subtasks    Task[]     @relation("Subtasks")
  
  // Dependências
  dependsOnIds String[]  // IDs de tasks que precisam completar antes
  
  // Timestamps
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  startedAt   DateTime?
  completedAt DateTime?
  dueAt       DateTime?
  
  // Relações
  assignees   Agent[]    @relation("AssignedTasks")
  currentAgent Agent?    @relation("CurrentTask")
  comments    TaskComment[]
  activities  Activity[]
  documents   Document[]
  
  @@index([status])
  @@index([priority])
  @@index([parentId])
}

enum TaskStatus {
  TODO        // Aguardando início
  IN_PROGRESS // Em execução
  IN_REVIEW   // Aguardando revisão
  BLOCKED     // Impedida por dependência/input
  DONE        // Concluída
  CANCELLED   // Cancelada
}

enum TaskPriority {
  CRITICAL    // Precisa agora
  HIGH        // Urgente
  MEDIUM      // Normal
  LOW         // Quando der
}

// ============================================
// TASK COMMENT - Colaboração entre agentes
// ============================================
model TaskComment {
  id          String   @id @default(cuid())
  content     String   @db.Text
  
  // Attachments como JSON array de URLs/paths
  attachments Json?    // [{type: "file", url: "..."}, {type: "code", content: "..."}]
  
  // Relações
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  fromAgentId String
  fromAgent   Agent    @relation(fields: [fromAgentId], references: [id])
  
  // Para threads de resposta
  parentId    String?
  parent      TaskComment? @relation("CommentThread", fields: [parentId], references: [id])
  replies     TaskComment[] @relation("CommentThread")
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Notificações geradas por este comentário
  notifications AgentNotification[]
  
  @@index([taskId])
  @@index([fromAgentId])
}

// ============================================
// ACTIVITY - Log de ações no sistema
// ============================================
model Activity {
  id        String       @id @default(cuid())
  type      ActivityType
  message   String       @db.Text
  metadata  Json?        // Dados extras específicos do tipo
  
  // Relações
  agentId   String?
  agent     Agent?       @relation(fields: [agentId], references: [id])
  
  taskId    String?
  task      Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  
  // Timestamp
  createdAt DateTime     @default(now())
  
  @@index([type])
  @@index([agentId])
  @@index([taskId])
  @@index([createdAt])
}

enum ActivityType {
  // Agent
  AGENT_STARTED
  AGENT_STOPPED
  AGENT_STATUS_CHANGED
  
  // Task
  TASK_CREATED
  TASK_ASSIGNED
  TASK_STARTED
  TASK_UPDATED
  TASK_COMPLETED
  TASK_BLOCKED
  
  // Collaboration
  COMMENT_ADDED
  MENTION_SENT
  DOCUMENT_CREATED
  
  // System
  SYSTEM_ERROR
  SYSTEM_INFO
}

// ============================================
// AGENT NOTIFICATION - @menções e alertas
// ============================================
model AgentNotification {
  id              String   @id @default(cuid())
  content         String   @db.Text
  delivered       Boolean  @default(false)
  deliveredAt     DateTime?
  read            Boolean  @default(false)
  readAt          DateTime?
  
  // Prioridade da notificação
  priority        NotificationPriority @default(NORMAL)
  
  // Quem recebe
  mentionedAgentId String
  mentionedAgent   Agent   @relation(fields: [mentionedAgentId], references: [id])
  
  // Origem (opcional - pode vir de um comentário)
  commentId       String?
  comment         TaskComment? @relation(fields: [commentId], references: [id], onDelete: SetNull)
  
  // Timestamps
  createdAt       DateTime @default(now())
  expiresAt       DateTime? // Notificações podem expirar
  
  @@index([mentionedAgentId, delivered])
  @@index([createdAt])
}

enum NotificationPriority {
  LOW       // Informativo
  NORMAL    // Padrão
  HIGH      // Importante
  URGENT    // Requer ação imediata
}

// ============================================
// DOCUMENT - Artefatos produzidos
// ============================================
model Document {
  id        String       @id @default(cuid())
  title     String
  content   String       @db.Text
  type      DocumentType
  
  // Versionamento simples
  version   Int          @default(1)
  
  // Metadados
  mimeType  String?      // ex: "text/markdown", "application/json"
  filePath  String?      // Se salvo em disco
  
  // Relações
  taskId    String?
  task      Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  
  authorId  String?
  author    Agent?       @relation(fields: [authorId], references: [id])
  
  // Timestamps
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  
  @@index([taskId])
  @@index([type])
  @@index([authorId])
}

enum DocumentType {
  SPEC          // Especificação/requisitos
  CODE          // Código fonte
  TEST          // Testes
  REPORT        // Relatório
  NOTE          // Nota/anotação
  ANALYSIS      // Análise
  PLAN          // Plano de ação
  REVIEW        // Code review
  OTHER
}
```

---

## Exemplos de Uso

### Criar um Agente

```typescript
const agent = await prisma.agent.create({
  data: {
    name: "researcher-01",
    role: "researcher",
    description: "Pesquisa e análise de informações",
    model: "claude-sonnet-4-20250514",
    capabilities: ["web_search", "web_fetch", "read", "write"],
    systemPrompt: "Você é um agente de pesquisa..."
  }
});
```

### Criar Task e Atribuir

```typescript
const task = await prisma.task.create({
  data: {
    title: "Pesquisar concorrentes",
    description: "Analisar os 5 principais concorrentes do mercado",
    priority: "HIGH",
    acceptance: "- Lista com nome, URL e features principais\n- Análise SWOT de cada um",
    assignees: {
      connect: [{ id: "researcher-01-id" }]
    }
  }
});
```

### Agente Inicia Trabalho

```typescript
await prisma.$transaction([
  prisma.agent.update({
    where: { id: agentId },
    data: {
      status: "WORKING",
      currentTaskId: taskId,
      lastActiveAt: new Date()
    }
  }),
  prisma.task.update({
    where: { id: taskId },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date()
    }
  }),
  prisma.activity.create({
    data: {
      type: "TASK_STARTED",
      message: `Agent ${agentName} started working on "${taskTitle}"`,
      agentId,
      taskId
    }
  })
]);
```

### Adicionar Comentário com Menção

```typescript
// Regex para detectar @menções
const mentions = content.match(/@(\w+)/g) || [];

const comment = await prisma.taskComment.create({
  data: {
    content: "Encontrei algo interessante. @reviewer-01 pode verificar?",
    taskId,
    fromAgentId: agentId,
    attachments: [
      { type: "file", url: "/tmp/analysis.md" }
    ]
  }
});

// Criar notificações para mencionados
for (const mention of mentions) {
  const agentName = mention.slice(1); // remove @
  const mentionedAgent = await prisma.agent.findUnique({
    where: { name: agentName }
  });
  
  if (mentionedAgent) {
    await prisma.agentNotification.create({
      data: {
        content: `${fromAgent.name} mentioned you in task "${task.title}"`,
        mentionedAgentId: mentionedAgent.id,
        commentId: comment.id,
        priority: "HIGH"
      }
    });
  }
}
```

### Polling de Notificações (Agente)

```typescript
// Cada agente verifica suas notificações pendentes
const notifications = await prisma.agentNotification.findMany({
  where: {
    mentionedAgentId: agentId,
    delivered: false
  },
  include: {
    comment: {
      include: {
        task: true,
        fromAgent: true
      }
    }
  },
  orderBy: [
    { priority: 'desc' },
    { createdAt: 'asc' }
  ]
});

// Marcar como entregues
await prisma.agentNotification.updateMany({
  where: {
    id: { in: notifications.map(n => n.id) }
  },
  data: {
    delivered: true,
    deliveredAt: new Date()
  }
});
```

---

## API Endpoints Sugeridos

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/agents` | GET | Listar agentes e status |
| `/agents/:id` | GET/PATCH | Ver/atualizar agente |
| `/agents/:id/notifications` | GET | Notificações pendentes |
| `/tasks` | GET/POST | Listar/criar tasks |
| `/tasks/:id` | GET/PATCH | Ver/atualizar task |
| `/tasks/:id/comments` | GET/POST | Comentários da task |
| `/tasks/:id/assign` | POST | Atribuir agentes |
| `/activities` | GET | Feed de atividades |
| `/documents` | GET/POST | Listar/criar documentos |

---

## Fluxo de Trabalho

```
┌─────────────────────────────────────────────────────────┐
│                    MISSION CONTROL                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Task Criada (TODO)                                  │
│         │                                                │
│         ▼                                                │
│  2. Agent Atribuído                                     │
│         │                                                │
│         ▼                                                │
│  3. Agent Poll → Vê task → Muda para WORKING            │
│         │                                                │
│         ▼                                                │
│  4. Agent trabalha, cria Documents, Comments            │
│         │                                                │
│         ├──► @mention outro agent                       │
│         │         │                                      │
│         │         ▼                                      │
│         │    Notification criada                        │
│         │         │                                      │
│         │         ▼                                      │
│         │    Outro agent poll → vê notification         │
│         │         │                                      │
│         │         ▼                                      │
│         │    Responde com Comment                       │
│         │                                                │
│         ▼                                                │
│  5. Task completa → status DONE                         │
│         │                                                │
│         ▼                                                │
│  6. Agent → status IDLE                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Referência

- Artigo: "Building AI agent teams that actually work together" - Bhanu Teja P.
- Conceito: Shared workspace com polling ao invés de mensagens diretas
- Vantagem: Desacoplamento, auditoria, colaboração assíncrona

---

## Integração com LLM Gateway

O Mission Control coordena **tarefas e colaboração** entre agentes, enquanto o **LLM Gateway** gerencia o **consumo de LLM**.

```
┌────────────────────────┐     ┌────────────────────────┐
│    MISSION CONTROL     │     │      LLM GATEWAY       │
│   (Coordenação)        │     │    (Consumo LLM)       │
├────────────────────────┤     ├────────────────────────┤
│ • Tasks                │     │ • Routing              │
│ • Assignments          │     │ • Usage tracking       │
│ • Collaboration        │◄───►│ • Rate limiting        │
│ • Notifications        │     │ • Alerting             │
│ • Activity logs        │     │ • Cost per tenant      │
└────────────────────────┘     └────────────────────────┘

Quando um Agent do Mission Control faz um request LLM:
1. Request passa pelo LLM Gateway
2. Gateway roteia para provider disponível
3. Gateway registra uso vinculado ao agent_id
4. Consumo agregado por tenant para billing
```

**Ver:** `LLM-GATEWAY.md` para especificação completa do gateway.

---

*Schema v1.1 - Atualizado em 2026-01-31*
