# 🎯 Mission Control - Especificação de APIs

**Versão:** 1.0  
**Data:** 2025-01-31  
**Status:** Draft  
**Owner:** Engineering

---

## 📑 Índice

1. [Visão Geral](#1-visão-geral)
2. [Autenticação](#2-autenticação)
3. [Agents API](#3-agents-api)
4. [Tasks API](#4-tasks-api)
5. [Comments API](#5-comments-api)
6. [Activity API](#6-activity-api)
7. [Notifications API](#7-notifications-api)
8. [Documents API](#8-documents-api)
9. [WebSocket Events](#9-websocket-events)
10. [Códigos de Erro](#10-códigos-de-erro)

---

## 1. Visão Geral

### 1.1 Propósito

O Mission Control é a interface de supervisão e coordenação de agentes IA. Esta API permite:

- **Gerenciar agentes** (bots) e suas configurações
- **Criar e acompanhar tarefas** atribuídas a agentes
- **Colaborar via comentários** em tarefas
- **Visualizar feed de atividades** em tempo real
- **Sistema de notificações** com @mentions
- **Gerenciar documentos** (deliverables, anexos)

### 1.2 Base URL

```
Produção:  https://api.baas.com/api/mission-control
Staging:   https://staging.baas.com/api/mission-control
Local:     http://localhost:3000/api/mission-control
```

### 1.3 Convenções

- **Content-Type:** `application/json`
- **Encoding:** UTF-8
- **Dates:** ISO 8601 (`2025-01-31T14:30:00Z`)
- **IDs:** CUID (`clxyz123abc456def789`)
- **Paginação:** Cursor-based por padrão

### 1.4 Rate Limits

| Plano    | Requests/min | Burst |
|----------|--------------|-------|
| Free     | 30           | 50    |
| Starter  | 100          | 150   |
| Pro      | 500          | 750   |
| Max      | 2000         | 3000  |

Headers de resposta:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706711400
```

---

## 2. Autenticação

### 2.1 Bearer Token

Todas as requisições devem incluir token JWT no header:

```http
Authorization: Bearer <jwt_token>
```

### 2.2 API Keys (Machine-to-Machine)

Para integrações programáticas:

```http
X-API-Key: <api_key>
X-Tenant-ID: <tenant_id>
```

### 2.3 Resposta de Erro de Autenticação

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token inválido ou expirado",
    "details": null
  }
}
```

---

## 3. Agents API

Gerenciamento de agentes (bots) IA.

### 3.1 Listar Agentes

```http
GET /agents
```

**Query Parameters:**

| Param    | Tipo   | Default | Descrição |
|----------|--------|---------|-----------|
| status   | string | all     | `active`, `inactive`, `paused`, `error` |
| type     | string | all     | `bot`, `admin`, `specialist` |
| search   | string | -       | Busca por nome |
| limit    | number | 20      | Max 100 |
| cursor   | string | -       | Cursor de paginação |

**Response 200:**

```json
{
  "data": [
    {
      "id": "agent_clxyz123",
      "name": "Suporte Bot",
      "type": "bot",
      "status": "active",
      "personality": {
        "tone": "friendly",
        "formality": 0.3,
        "emoji": true
      },
      "channels": [
        {
          "type": "whatsapp",
          "groupId": "EXAMPLE_GROUP_ID@g.us",
          "enabled": true
        }
      ],
      "stats": {
        "messagesLast24h": 142,
        "avgResponseTime": 2.3,
        "successRate": 0.98
      },
      "health": {
        "status": "healthy",
        "lastHeartbeat": "2025-01-31T14:30:00Z",
        "uptime": 0.999
      },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-31T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6ImFnZW50X2FiYyJ9",
    "hasMore": true,
    "total": 5
  }
}
```

### 3.2 Obter Agente

```http
GET /agents/:agentId
```

**Response 200:**

```json
{
  "data": {
    "id": "agent_clxyz123",
    "name": "Suporte Bot",
    "type": "bot",
    "status": "active",
    "description": "Bot de suporte para clientes",
    "personality": {
      "tone": "friendly",
      "formality": 0.3,
      "emoji": true,
      "systemPrompt": "Você é o assistente de suporte da Empresa X...",
      "restrictions": ["Nunca falar de concorrentes", "Não dar conselhos financeiros"]
    },
    "capabilities": {
      "webSearch": true,
      "imageGeneration": false,
      "codeExecution": false,
      "fileUpload": true,
      "voiceMessages": true
    },
    "limits": {
      "maxTokensPerMessage": 4000,
      "maxMessagesPerHour": 100,
      "maxCostPerDay": 10.00
    },
    "channels": [
      {
        "type": "whatsapp",
        "groupId": "EXAMPLE_GROUP_ID@g.us",
        "groupName": "Suporte Empresa X",
        "enabled": true,
        "requireMention": true
      }
    ],
    "specialists": [
      {
        "id": "spec_abc123",
        "name": "Especialista Técnico",
        "trigger": "quando perguntarem sobre API"
      }
    ],
    "stats": {
      "messagesTotal": 5420,
      "messagesLast24h": 142,
      "messagesLast7d": 890,
      "avgResponseTime": 2.3,
      "successRate": 0.98,
      "costTotal": 45.67,
      "costLast30d": 12.50
    },
    "health": {
      "status": "healthy",
      "lastHeartbeat": "2025-01-31T14:30:00Z",
      "uptime": 0.999,
      "lastError": null
    },
    "credentials": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "poolStatus": {
        "available": 3,
        "usagePercent": 65
      }
    },
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-31T14:30:00Z",
    "createdBy": {
      "id": "user_abc123",
      "name": "João Silva"
    }
  }
}
```

### 3.3 Criar Agente

```http
POST /agents
```

**Request Body:**

```json
{
  "name": "Bot de Vendas",
  "type": "bot",
  "description": "Bot para qualificação de leads",
  "personality": {
    "tone": "professional",
    "formality": 0.7,
    "emoji": false,
    "systemPrompt": "Você é um consultor de vendas da Empresa X...",
    "restrictions": ["Não dar descontos acima de 10%"]
  },
  "capabilities": {
    "webSearch": false,
    "imageGeneration": false,
    "codeExecution": false,
    "fileUpload": true,
    "voiceMessages": false
  },
  "limits": {
    "maxTokensPerMessage": 2000,
    "maxMessagesPerHour": 50,
    "maxCostPerDay": 5.00
  },
  "channels": [
    {
      "type": "whatsapp",
      "groupId": "EXAMPLE_GROUP_ID@g.us",
      "enabled": true,
      "requireMention": false
    }
  ]
}
```

**Response 201:**

```json
{
  "data": {
    "id": "agent_clxyz456",
    "name": "Bot de Vendas",
    "type": "bot",
    "status": "inactive",
    "createdAt": "2025-01-31T15:00:00Z"
  },
  "message": "Agente criado com sucesso. Ative-o para começar a responder."
}
```

### 3.4 Atualizar Agente

```http
PATCH /agents/:agentId
```

**Request Body:** (campos parciais)

```json
{
  "name": "Bot de Vendas v2",
  "status": "active",
  "personality": {
    "tone": "casual"
  }
}
```

**Response 200:**

```json
{
  "data": {
    "id": "agent_clxyz456",
    "name": "Bot de Vendas v2",
    "status": "active",
    "updatedAt": "2025-01-31T15:30:00Z"
  },
  "message": "Agente atualizado com sucesso"
}
```

### 3.5 Deletar Agente

```http
DELETE /agents/:agentId
```

**Query Parameters:**

| Param | Tipo    | Default | Descrição |
|-------|---------|---------|-----------|
| force | boolean | false   | Deletar mesmo com tarefas ativas |

**Response 200:**

```json
{
  "data": {
    "id": "agent_clxyz456",
    "deletedAt": "2025-01-31T16:00:00Z"
  },
  "message": "Agente deletado com sucesso"
}
```

### 3.6 Ações do Agente

#### Pausar Agente

```http
POST /agents/:agentId/pause
```

```json
{
  "reason": "Manutenção programada",
  "duration": 3600
}
```

#### Retomar Agente

```http
POST /agents/:agentId/resume
```

#### Reiniciar Agente

```http
POST /agents/:agentId/restart
```

#### Health Check Manual

```http
POST /agents/:agentId/health-check
```

**Response 200:**

```json
{
  "data": {
    "status": "healthy",
    "latency": 234,
    "lastMessage": "2025-01-31T14:28:00Z",
    "memoryUsage": 0.45,
    "queueSize": 0
  }
}
```

---

## 4. Tasks API

Gerenciamento de tarefas atribuídas a agentes.

### 4.1 Listar Tarefas

```http
GET /tasks
```

**Query Parameters:**

| Param      | Tipo   | Default | Descrição |
|------------|--------|---------|-----------|
| status     | string | all     | `pending`, `in_progress`, `completed`, `failed`, `cancelled` |
| priority   | string | all     | `low`, `medium`, `high`, `urgent` |
| agentId    | string | -       | Filtrar por agente |
| assigneeId | string | -       | Filtrar por responsável humano |
| dueBefore  | string | -       | Data limite máxima (ISO 8601) |
| dueAfter   | string | -       | Data limite mínima (ISO 8601) |
| search     | string | -       | Busca em título e descrição |
| tags       | string | -       | Lista separada por vírgula |
| limit      | number | 20      | Max 100 |
| cursor     | string | -       | Cursor de paginação |
| sort       | string | -createdAt | `createdAt`, `dueDate`, `priority`, `status` |

**Response 200:**

```json
{
  "data": [
    {
      "id": "task_abc123",
      "title": "Responder dúvidas sobre API",
      "description": "Monitorar grupo de desenvolvedores e responder questões técnicas",
      "status": "in_progress",
      "priority": "high",
      "progress": 0.65,
      "agent": {
        "id": "agent_clxyz123",
        "name": "Suporte Bot",
        "avatar": "🤖"
      },
      "assignee": {
        "id": "user_abc123",
        "name": "João Silva",
        "avatar": "https://..."
      },
      "dueDate": "2025-02-01T18:00:00Z",
      "tags": ["suporte", "api", "técnico"],
      "comments": 5,
      "attachments": 2,
      "createdAt": "2025-01-30T10:00:00Z",
      "updatedAt": "2025-01-31T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6InRhc2tfYWJjIn0=",
    "hasMore": true,
    "total": 42
  },
  "summary": {
    "total": 42,
    "byStatus": {
      "pending": 10,
      "in_progress": 15,
      "completed": 12,
      "failed": 3,
      "cancelled": 2
    },
    "byPriority": {
      "urgent": 2,
      "high": 8,
      "medium": 20,
      "low": 12
    }
  }
}
```

### 4.2 Obter Tarefa

```http
GET /tasks/:taskId
```

**Response 200:**

```json
{
  "data": {
    "id": "task_abc123",
    "title": "Responder dúvidas sobre API",
    "description": "Monitorar grupo de desenvolvedores e responder questões técnicas sobre a API v2",
    "status": "in_progress",
    "priority": "high",
    "progress": 0.65,
    "progressNotes": "15 de 23 perguntas respondidas",
    "agent": {
      "id": "agent_clxyz123",
      "name": "Suporte Bot",
      "type": "bot",
      "avatar": "🤖",
      "status": "active"
    },
    "assignee": {
      "id": "user_abc123",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "avatar": "https://..."
    },
    "watchers": [
      {
        "id": "user_def456",
        "name": "Maria Santos"
      }
    ],
    "dueDate": "2025-02-01T18:00:00Z",
    "startedAt": "2025-01-30T14:00:00Z",
    "completedAt": null,
    "tags": ["suporte", "api", "técnico"],
    "metadata": {
      "source": "manual",
      "groupId": "EXAMPLE_GROUP_ID@g.us",
      "estimatedTokens": 50000
    },
    "subtasks": [
      {
        "id": "subtask_1",
        "title": "Responder sobre autenticação",
        "completed": true
      },
      {
        "id": "subtask_2",
        "title": "Documentar endpoints novos",
        "completed": false
      }
    ],
    "dependencies": [],
    "blockedBy": [],
    "activity": [
      {
        "id": "act_xyz789",
        "type": "status_change",
        "from": "pending",
        "to": "in_progress",
        "actor": {
          "id": "agent_clxyz123",
          "name": "Suporte Bot"
        },
        "timestamp": "2025-01-30T14:00:00Z"
      }
    ],
    "createdAt": "2025-01-30T10:00:00Z",
    "updatedAt": "2025-01-31T14:30:00Z",
    "createdBy": {
      "id": "user_abc123",
      "name": "João Silva"
    }
  }
}
```

### 4.3 Criar Tarefa

```http
POST /tasks
```

**Request Body:**

```json
{
  "title": "Analisar feedback dos clientes",
  "description": "Revisar mensagens do último mês e identificar padrões de reclamação",
  "priority": "medium",
  "agentId": "agent_clxyz123",
  "assigneeId": "user_abc123",
  "dueDate": "2025-02-05T18:00:00Z",
  "tags": ["análise", "feedback", "clientes"],
  "subtasks": [
    { "title": "Coletar mensagens" },
    { "title": "Categorizar por tema" },
    { "title": "Gerar relatório" }
  ],
  "metadata": {
    "groupId": "EXAMPLE_GROUP_ID@g.us",
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    }
  },
  "watchers": ["user_def456", "user_ghi789"]
}
```

**Response 201:**

```json
{
  "data": {
    "id": "task_def456",
    "title": "Analisar feedback dos clientes",
    "status": "pending",
    "priority": "medium",
    "createdAt": "2025-01-31T15:00:00Z"
  },
  "message": "Tarefa criada e atribuída ao agente"
}
```

### 4.4 Atualizar Tarefa

```http
PATCH /tasks/:taskId
```

**Request Body:**

```json
{
  "status": "completed",
  "progress": 1.0,
  "progressNotes": "Todas as 23 perguntas respondidas com sucesso"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "task_abc123",
    "status": "completed",
    "progress": 1.0,
    "completedAt": "2025-01-31T16:00:00Z",
    "updatedAt": "2025-01-31T16:00:00Z"
  },
  "message": "Tarefa atualizada"
}
```

### 4.5 Deletar Tarefa

```http
DELETE /tasks/:taskId
```

**Response 200:**

```json
{
  "data": {
    "id": "task_abc123",
    "deletedAt": "2025-01-31T17:00:00Z"
  },
  "message": "Tarefa deletada"
}
```

### 4.6 Ações da Tarefa

#### Atribuir Agente

```http
POST /tasks/:taskId/assign
```

```json
{
  "agentId": "agent_clxyz456",
  "notify": true
}
```

#### Adicionar Watcher

```http
POST /tasks/:taskId/watchers
```

```json
{
  "userId": "user_ghi789"
}
```

#### Remover Watcher

```http
DELETE /tasks/:taskId/watchers/:userId
```

#### Atualizar Subtask

```http
PATCH /tasks/:taskId/subtasks/:subtaskId
```

```json
{
  "completed": true
}
```

#### Duplicar Tarefa

```http
POST /tasks/:taskId/duplicate
```

```json
{
  "title": "Analisar feedback - Fevereiro",
  "dueDate": "2025-03-05T18:00:00Z"
}
```

---

## 5. Comments API

Comentários em tarefas com suporte a @mentions.

### 5.1 Listar Comentários

```http
GET /tasks/:taskId/comments
```

**Query Parameters:**

| Param  | Tipo   | Default | Descrição |
|--------|--------|---------|-----------|
| limit  | number | 50      | Max 100 |
| cursor | string | -       | Cursor de paginação |
| sort   | string | createdAt | `createdAt`, `-createdAt` |

**Response 200:**

```json
{
  "data": [
    {
      "id": "comment_xyz123",
      "content": "Ótimo progresso! @joao podemos revisar os resultados amanhã?",
      "contentHtml": "<p>Ótimo progresso! <span class=\"mention\" data-user-id=\"user_abc123\">@joao</span> podemos revisar os resultados amanhã?</p>",
      "author": {
        "id": "agent_clxyz123",
        "type": "agent",
        "name": "Suporte Bot",
        "avatar": "🤖"
      },
      "mentions": [
        {
          "id": "user_abc123",
          "name": "João Silva",
          "type": "user"
        }
      ],
      "attachments": [
        {
          "id": "doc_abc123",
          "name": "relatorio.pdf",
          "type": "application/pdf",
          "size": 245000,
          "url": "https://..."
        }
      ],
      "reactions": [
        {
          "emoji": "👍",
          "count": 2,
          "users": ["user_abc123", "user_def456"]
        }
      ],
      "replyTo": null,
      "edited": false,
      "createdAt": "2025-01-31T14:00:00Z",
      "updatedAt": "2025-01-31T14:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6ImNvbW1lbnRfYWJjIn0=",
    "hasMore": true,
    "total": 25
  }
}
```

### 5.2 Criar Comentário

```http
POST /tasks/:taskId/comments
```

**Request Body:**

```json
{
  "content": "Finalizei a análise! @maria pode revisar os resultados?",
  "replyTo": null,
  "attachments": ["doc_xyz789"]
}
```

**Response 201:**

```json
{
  "data": {
    "id": "comment_abc456",
    "content": "Finalizei a análise! @maria pode revisar os resultados?",
    "author": {
      "id": "user_abc123",
      "name": "João Silva"
    },
    "mentions": [
      {
        "id": "user_def456",
        "name": "Maria Santos"
      }
    ],
    "createdAt": "2025-01-31T15:00:00Z"
  },
  "message": "Comentário adicionado"
}
```

### 5.3 Atualizar Comentário

```http
PATCH /comments/:commentId
```

**Request Body:**

```json
{
  "content": "Finalizei a análise! @maria e @pedro podem revisar?"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "comment_abc456",
    "content": "Finalizei a análise! @maria e @pedro podem revisar?",
    "edited": true,
    "updatedAt": "2025-01-31T15:30:00Z"
  }
}
```

### 5.4 Deletar Comentário

```http
DELETE /comments/:commentId
```

**Response 200:**

```json
{
  "data": {
    "id": "comment_abc456",
    "deletedAt": "2025-01-31T16:00:00Z"
  }
}
```

### 5.5 Reações

#### Adicionar Reação

```http
POST /comments/:commentId/reactions
```

```json
{
  "emoji": "👍"
}
```

#### Remover Reação

```http
DELETE /comments/:commentId/reactions/:emoji
```

### 5.6 Buscar Menções (Autocomplete)

```http
GET /mentions/search
```

**Query Parameters:**

| Param | Tipo   | Descrição |
|-------|--------|-----------|
| q     | string | Texto de busca |
| limit | number | Max resultados (default 10) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "user_abc123",
      "type": "user",
      "name": "João Silva",
      "handle": "joao",
      "avatar": "https://..."
    },
    {
      "id": "agent_clxyz123",
      "type": "agent",
      "name": "Suporte Bot",
      "handle": "suporte-bot",
      "avatar": "🤖"
    }
  ]
}
```

---

## 6. Activity API

Feed de atividades em tempo real.

### 6.1 Listar Atividades

```http
GET /activity
```

**Query Parameters:**

| Param    | Tipo   | Default | Descrição |
|----------|--------|---------|-----------|
| type     | string | all     | `task_created`, `task_updated`, `task_completed`, `comment_added`, `agent_status`, `mention`, `system` |
| agentId  | string | -       | Filtrar por agente |
| taskId   | string | -       | Filtrar por tarefa |
| actorId  | string | -       | Filtrar por autor |
| since    | string | -       | Data mínima (ISO 8601) |
| until    | string | -       | Data máxima (ISO 8601) |
| limit    | number | 50      | Max 100 |
| cursor   | string | -       | Cursor de paginação |

**Response 200:**

```json
{
  "data": [
    {
      "id": "act_xyz789",
      "type": "task_completed",
      "title": "Tarefa concluída",
      "description": "Suporte Bot completou 'Responder dúvidas sobre API'",
      "actor": {
        "id": "agent_clxyz123",
        "type": "agent",
        "name": "Suporte Bot",
        "avatar": "🤖"
      },
      "target": {
        "type": "task",
        "id": "task_abc123",
        "title": "Responder dúvidas sobre API"
      },
      "metadata": {
        "previousStatus": "in_progress",
        "newStatus": "completed",
        "duration": 172800
      },
      "timestamp": "2025-01-31T16:00:00Z"
    },
    {
      "id": "act_abc456",
      "type": "comment_added",
      "title": "Novo comentário",
      "description": "João Silva comentou em 'Analisar feedback'",
      "actor": {
        "id": "user_abc123",
        "type": "user",
        "name": "João Silva",
        "avatar": "https://..."
      },
      "target": {
        "type": "task",
        "id": "task_def456",
        "title": "Analisar feedback dos clientes"
      },
      "metadata": {
        "commentId": "comment_xyz123",
        "preview": "Finalizei a análise! @maria pode revisar..."
      },
      "timestamp": "2025-01-31T15:00:00Z"
    },
    {
      "id": "act_def789",
      "type": "agent_status",
      "title": "Status do agente alterado",
      "description": "Bot de Vendas foi pausado",
      "actor": {
        "id": "user_abc123",
        "type": "user",
        "name": "João Silva"
      },
      "target": {
        "type": "agent",
        "id": "agent_clxyz456",
        "name": "Bot de Vendas"
      },
      "metadata": {
        "previousStatus": "active",
        "newStatus": "paused",
        "reason": "Manutenção programada"
      },
      "timestamp": "2025-01-31T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6ImFjdF9hYmMifQ==",
    "hasMore": true,
    "total": 156
  }
}
```

### 6.2 Obter Atividade

```http
GET /activity/:activityId
```

**Response 200:**

```json
{
  "data": {
    "id": "act_xyz789",
    "type": "task_completed",
    "title": "Tarefa concluída",
    "description": "Suporte Bot completou 'Responder dúvidas sobre API'",
    "actor": { ... },
    "target": { ... },
    "metadata": { ... },
    "relatedActivities": [
      {
        "id": "act_abc123",
        "type": "task_created",
        "timestamp": "2025-01-30T10:00:00Z"
      }
    ],
    "timestamp": "2025-01-31T16:00:00Z"
  }
}
```

### 6.3 Resumo de Atividades

```http
GET /activity/summary
```

**Query Parameters:**

| Param  | Tipo   | Default | Descrição |
|--------|--------|---------|-----------|
| period | string | 24h     | `1h`, `24h`, `7d`, `30d` |

**Response 200:**

```json
{
  "data": {
    "period": "24h",
    "startTime": "2025-01-30T16:00:00Z",
    "endTime": "2025-01-31T16:00:00Z",
    "summary": {
      "totalActivities": 87,
      "byType": {
        "task_created": 12,
        "task_updated": 35,
        "task_completed": 8,
        "comment_added": 25,
        "agent_status": 5,
        "mention": 2
      },
      "byActor": {
        "agents": 45,
        "users": 42
      },
      "topAgents": [
        {
          "id": "agent_clxyz123",
          "name": "Suporte Bot",
          "activities": 23
        }
      ],
      "topUsers": [
        {
          "id": "user_abc123",
          "name": "João Silva",
          "activities": 18
        }
      ]
    }
  }
}
```

---

## 7. Notifications API

Sistema de notificações e @mentions.

### 7.1 Listar Notificações

```http
GET /notifications
```

**Query Parameters:**

| Param  | Tipo    | Default | Descrição |
|--------|---------|---------|-----------|
| read   | boolean | all     | `true`, `false`, `all` |
| type   | string  | all     | `mention`, `task_assigned`, `task_completed`, `comment`, `system`, `alert` |
| limit  | number  | 20      | Max 100 |
| cursor | string  | -       | Cursor de paginação |

**Response 200:**

```json
{
  "data": [
    {
      "id": "notif_abc123",
      "type": "mention",
      "title": "Você foi mencionado",
      "message": "@joao, podemos revisar os resultados amanhã?",
      "read": false,
      "actor": {
        "id": "agent_clxyz123",
        "type": "agent",
        "name": "Suporte Bot",
        "avatar": "🤖"
      },
      "target": {
        "type": "comment",
        "id": "comment_xyz123",
        "taskId": "task_abc123",
        "taskTitle": "Responder dúvidas sobre API"
      },
      "actions": [
        {
          "label": "Ver comentário",
          "url": "/tasks/task_abc123#comment_xyz123"
        },
        {
          "label": "Responder",
          "action": "reply",
          "targetId": "comment_xyz123"
        }
      ],
      "createdAt": "2025-01-31T14:00:00Z"
    },
    {
      "id": "notif_def456",
      "type": "task_assigned",
      "title": "Nova tarefa atribuída",
      "message": "Você foi atribuído à tarefa 'Analisar feedback dos clientes'",
      "read": true,
      "actor": {
        "id": "user_def456",
        "type": "user",
        "name": "Maria Santos"
      },
      "target": {
        "type": "task",
        "id": "task_def456",
        "title": "Analisar feedback dos clientes"
      },
      "actions": [
        {
          "label": "Ver tarefa",
          "url": "/tasks/task_def456"
        }
      ],
      "createdAt": "2025-01-31T10:00:00Z",
      "readAt": "2025-01-31T10:05:00Z"
    },
    {
      "id": "notif_ghi789",
      "type": "alert",
      "title": "Alerta do sistema",
      "message": "Bot de Vendas não responde há 5 minutos",
      "read": false,
      "severity": "warning",
      "actor": {
        "id": "system",
        "type": "system",
        "name": "Admin Agent"
      },
      "target": {
        "type": "agent",
        "id": "agent_clxyz456",
        "name": "Bot de Vendas"
      },
      "actions": [
        {
          "label": "Reiniciar",
          "action": "restart",
          "targetId": "agent_clxyz456"
        },
        {
          "label": "Ver logs",
          "url": "/agents/agent_clxyz456/logs"
        }
      ],
      "createdAt": "2025-01-31T15:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6Im5vdGlmX2FiYyJ9",
    "hasMore": true,
    "total": 45
  },
  "unreadCount": 12
}
```

### 7.2 Marcar como Lida

```http
PATCH /notifications/:notificationId/read
```

**Response 200:**

```json
{
  "data": {
    "id": "notif_abc123",
    "read": true,
    "readAt": "2025-01-31T16:00:00Z"
  }
}
```

### 7.3 Marcar Todas como Lidas

```http
POST /notifications/read-all
```

**Request Body (opcional):**

```json
{
  "type": "mention",
  "before": "2025-01-31T16:00:00Z"
}
```

**Response 200:**

```json
{
  "data": {
    "markedAsRead": 12
  },
  "message": "12 notificações marcadas como lidas"
}
```

### 7.4 Deletar Notificação

```http
DELETE /notifications/:notificationId
```

### 7.5 Preferências de Notificação

#### Obter Preferências

```http
GET /notifications/preferences
```

**Response 200:**

```json
{
  "data": {
    "channels": {
      "inApp": true,
      "email": true,
      "whatsapp": false,
      "push": true
    },
    "types": {
      "mention": {
        "enabled": true,
        "channels": ["inApp", "email", "push"]
      },
      "task_assigned": {
        "enabled": true,
        "channels": ["inApp", "email"]
      },
      "task_completed": {
        "enabled": true,
        "channels": ["inApp"]
      },
      "comment": {
        "enabled": true,
        "channels": ["inApp"]
      },
      "alert": {
        "enabled": true,
        "channels": ["inApp", "email", "whatsapp", "push"]
      }
    },
    "quietHours": {
      "enabled": true,
      "start": "22:00",
      "end": "08:00",
      "timezone": "America/Sao_Paulo",
      "exceptUrgent": true
    },
    "digest": {
      "enabled": true,
      "frequency": "daily",
      "time": "09:00"
    }
  }
}
```

#### Atualizar Preferências

```http
PATCH /notifications/preferences
```

**Request Body:**

```json
{
  "channels": {
    "whatsapp": true
  },
  "types": {
    "comment": {
      "channels": ["inApp", "push"]
    }
  },
  "quietHours": {
    "enabled": true,
    "start": "23:00",
    "end": "07:00"
  }
}
```

### 7.6 Contagem de Não Lidas

```http
GET /notifications/unread-count
```

**Response 200:**

```json
{
  "data": {
    "total": 12,
    "byType": {
      "mention": 5,
      "task_assigned": 2,
      "comment": 3,
      "alert": 2
    }
  }
}
```

---

## 8. Documents API

Gerenciamento de documentos e deliverables.

### 8.1 Listar Documentos

```http
GET /documents
```

**Query Parameters:**

| Param   | Tipo   | Default | Descrição |
|---------|--------|---------|-----------|
| taskId  | string | -       | Filtrar por tarefa |
| agentId | string | -       | Filtrar por agente |
| type    | string | all     | `deliverable`, `attachment`, `report`, `log` |
| mimeType| string | -       | Filtrar por tipo MIME |
| search  | string | -       | Busca por nome |
| limit   | number | 20      | Max 100 |
| cursor  | string | -       | Cursor de paginação |

**Response 200:**

```json
{
  "data": [
    {
      "id": "doc_abc123",
      "name": "relatorio-janeiro-2025.pdf",
      "type": "deliverable",
      "mimeType": "application/pdf",
      "size": 1245678,
      "sizeFormatted": "1.2 MB",
      "url": "https://storage.baas.com/docs/...",
      "thumbnailUrl": "https://storage.baas.com/thumbs/...",
      "task": {
        "id": "task_abc123",
        "title": "Analisar feedback dos clientes"
      },
      "agent": {
        "id": "agent_clxyz123",
        "name": "Suporte Bot"
      },
      "uploadedBy": {
        "id": "agent_clxyz123",
        "type": "agent",
        "name": "Suporte Bot"
      },
      "metadata": {
        "pages": 15,
        "version": "1.0",
        "generated": true
      },
      "createdAt": "2025-01-31T14:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6ImRvY19hYmMifQ==",
    "hasMore": true,
    "total": 35
  },
  "summary": {
    "totalSize": 156789012,
    "totalSizeFormatted": "149.5 MB",
    "byType": {
      "deliverable": 12,
      "attachment": 18,
      "report": 3,
      "log": 2
    }
  }
}
```

### 8.2 Obter Documento

```http
GET /documents/:documentId
```

**Response 200:**

```json
{
  "data": {
    "id": "doc_abc123",
    "name": "relatorio-janeiro-2025.pdf",
    "type": "deliverable",
    "mimeType": "application/pdf",
    "size": 1245678,
    "sizeFormatted": "1.2 MB",
    "url": "https://storage.baas.com/docs/...",
    "downloadUrl": "https://storage.baas.com/download/...",
    "previewUrl": "https://storage.baas.com/preview/...",
    "thumbnailUrl": "https://storage.baas.com/thumbs/...",
    "task": {
      "id": "task_abc123",
      "title": "Analisar feedback dos clientes",
      "status": "completed"
    },
    "agent": {
      "id": "agent_clxyz123",
      "name": "Suporte Bot"
    },
    "uploadedBy": {
      "id": "agent_clxyz123",
      "type": "agent",
      "name": "Suporte Bot"
    },
    "versions": [
      {
        "version": "1.0",
        "size": 1245678,
        "createdAt": "2025-01-31T14:00:00Z"
      }
    ],
    "metadata": {
      "pages": 15,
      "author": "Suporte Bot",
      "title": "Relatório de Feedback - Janeiro 2025",
      "generated": true,
      "generatedAt": "2025-01-31T13:58:00Z",
      "processingTime": 45.2
    },
    "access": {
      "public": false,
      "expiresAt": null,
      "allowedUsers": []
    },
    "createdAt": "2025-01-31T14:00:00Z",
    "updatedAt": "2025-01-31T14:00:00Z"
  }
}
```

### 8.3 Upload de Documento

```http
POST /documents
Content-Type: multipart/form-data
```

**Form Data:**

| Field    | Tipo   | Obrigatório | Descrição |
|----------|--------|-------------|-----------|
| file     | file   | Sim         | Arquivo (max 50MB) |
| type     | string | Não         | `deliverable`, `attachment` (default) |
| taskId   | string | Não         | ID da tarefa relacionada |
| name     | string | Não         | Nome customizado |
| metadata | json   | Não         | Metadados adicionais |

**Response 201:**

```json
{
  "data": {
    "id": "doc_def456",
    "name": "planilha-dados.xlsx",
    "type": "attachment",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size": 45678,
    "url": "https://storage.baas.com/docs/...",
    "createdAt": "2025-01-31T15:00:00Z"
  },
  "message": "Documento enviado com sucesso"
}
```

### 8.4 Atualizar Documento

```http
PATCH /documents/:documentId
```

**Request Body:**

```json
{
  "name": "relatorio-janeiro-2025-v2.pdf",
  "type": "deliverable",
  "metadata": {
    "version": "2.0",
    "changes": "Correções de formatação"
  }
}
```

### 8.5 Deletar Documento

```http
DELETE /documents/:documentId
```

**Query Parameters:**

| Param | Tipo    | Default | Descrição |
|-------|---------|---------|-----------|
| force | boolean | false   | Deletar mesmo se referenciado |

### 8.6 Download de Documento

```http
GET /documents/:documentId/download
```

**Response:** Stream do arquivo com headers apropriados

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="relatorio-janeiro-2025.pdf"
Content-Length: 1245678
```

### 8.7 Gerar Link Temporário

```http
POST /documents/:documentId/share
```

**Request Body:**

```json
{
  "expiresIn": 3600,
  "password": null,
  "allowDownload": true
}
```

**Response 200:**

```json
{
  "data": {
    "url": "https://storage.baas.com/share/abc123xyz...",
    "expiresAt": "2025-01-31T17:00:00Z",
    "password": null
  }
}
```

### 8.8 Anexar a Tarefa

```http
POST /documents/:documentId/attach
```

**Request Body:**

```json
{
  "taskId": "task_abc123"
}
```

### 8.9 Buscar Documentos (Full-text)

```http
GET /documents/search
```

**Query Parameters:**

| Param   | Tipo   | Descrição |
|---------|--------|-----------|
| q       | string | Texto de busca (busca em conteúdo OCR) |
| taskId  | string | Filtrar por tarefa |
| limit   | number | Max resultados |

**Response 200:**

```json
{
  "data": [
    {
      "id": "doc_abc123",
      "name": "relatorio-janeiro-2025.pdf",
      "type": "deliverable",
      "highlights": [
        "...análise de <mark>feedback</mark> mostra que...",
        "...principais <mark>feedback</mark>s dos clientes..."
      ],
      "score": 0.95,
      "createdAt": "2025-01-31T14:00:00Z"
    }
  ]
}
```

---

## 9. WebSocket Events

Eventos em tempo real via WebSocket.

### 9.1 Conexão

```javascript
const ws = new WebSocket('wss://api.baas.com/ws/mission-control');

// Autenticação
ws.send(JSON.stringify({
  type: 'auth',
  token: 'jwt_token_here'
}));
```

### 9.2 Eventos Disponíveis

#### Subscrição

```javascript
// Subscrever a eventos
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['agents', 'tasks', 'activity', 'notifications']
}));

// Subscrever a entidade específica
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['task:task_abc123', 'agent:agent_clxyz123']
}));
```

#### Eventos de Agentes

```json
{
  "type": "agent.status_changed",
  "data": {
    "agentId": "agent_clxyz123",
    "previousStatus": "active",
    "newStatus": "paused",
    "reason": "Manutenção",
    "timestamp": "2025-01-31T14:30:00Z"
  }
}
```

```json
{
  "type": "agent.health_updated",
  "data": {
    "agentId": "agent_clxyz123",
    "health": {
      "status": "healthy",
      "latency": 234,
      "uptime": 0.999
    },
    "timestamp": "2025-01-31T14:30:00Z"
  }
}
```

#### Eventos de Tarefas

```json
{
  "type": "task.created",
  "data": {
    "taskId": "task_abc123",
    "title": "Nova tarefa",
    "createdBy": { ... },
    "timestamp": "2025-01-31T15:00:00Z"
  }
}
```

```json
{
  "type": "task.updated",
  "data": {
    "taskId": "task_abc123",
    "changes": {
      "status": { "from": "pending", "to": "in_progress" },
      "progress": { "from": 0, "to": 0.25 }
    },
    "updatedBy": { ... },
    "timestamp": "2025-01-31T15:30:00Z"
  }
}
```

```json
{
  "type": "task.completed",
  "data": {
    "taskId": "task_abc123",
    "title": "Responder dúvidas",
    "completedBy": { ... },
    "duration": 172800,
    "timestamp": "2025-01-31T16:00:00Z"
  }
}
```

#### Eventos de Comentários

```json
{
  "type": "comment.added",
  "data": {
    "commentId": "comment_xyz123",
    "taskId": "task_abc123",
    "content": "Ótimo progresso!",
    "author": { ... },
    "mentions": [ ... ],
    "timestamp": "2025-01-31T14:00:00Z"
  }
}
```

#### Eventos de Notificações

```json
{
  "type": "notification.new",
  "data": {
    "notificationId": "notif_abc123",
    "type": "mention",
    "title": "Você foi mencionado",
    "message": "@joao, podemos revisar?",
    "timestamp": "2025-01-31T14:00:00Z"
  }
}
```

### 9.3 Heartbeat

```json
// Cliente → Servidor (a cada 30s)
{ "type": "ping" }

// Servidor → Cliente
{ "type": "pong", "timestamp": "2025-01-31T14:30:00Z" }
```

---

## 10. Códigos de Erro

### 10.1 Formato de Erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      {
        "field": "title",
        "message": "Título é obrigatório",
        "code": "required"
      }
    ],
    "requestId": "req_abc123xyz"
  }
}
```

### 10.2 Códigos HTTP

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | VALIDATION_ERROR | Dados de entrada inválidos |
| 400 | BAD_REQUEST | Requisição malformada |
| 401 | UNAUTHORIZED | Token inválido ou expirado |
| 403 | FORBIDDEN | Sem permissão para esta ação |
| 404 | NOT_FOUND | Recurso não encontrado |
| 409 | CONFLICT | Conflito (ex: duplicado) |
| 422 | UNPROCESSABLE | Semanticamente inválido |
| 429 | RATE_LIMITED | Muitas requisições |
| 500 | INTERNAL_ERROR | Erro interno do servidor |
| 503 | SERVICE_UNAVAILABLE | Serviço temporariamente indisponível |

### 10.3 Códigos de Negócio

| Código | Descrição |
|--------|-----------|
| AGENT_INACTIVE | Agente não está ativo |
| AGENT_BUSY | Agente ocupado com outra tarefa |
| TASK_ALREADY_COMPLETED | Tarefa já foi concluída |
| TASK_LOCKED | Tarefa bloqueada por dependência |
| QUOTA_EXCEEDED | Limite do plano excedido |
| DOCUMENT_TOO_LARGE | Arquivo excede limite de tamanho |
| INVALID_MENTION | Usuário mencionado não existe |

---

## Apêndice A: Modelos de Dados

### Agent

```typescript
interface Agent {
  id: string;
  tenantId: string;
  name: string;
  type: 'bot' | 'admin' | 'specialist';
  status: 'active' | 'inactive' | 'paused' | 'error';
  description?: string;
  personality: AgentPersonality;
  capabilities: AgentCapabilities;
  limits: AgentLimits;
  channels: AgentChannel[];
  specialists?: AgentSpecialist[];
  stats: AgentStats;
  health: AgentHealth;
  credentials: AgentCredentials;
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserRef;
}
```

### Task

```typescript
interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number; // 0-1
  progressNotes?: string;
  agentId?: string;
  agent?: AgentRef;
  assigneeId?: string;
  assignee?: UserRef;
  watchers: UserRef[];
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  tags: string[];
  metadata?: Record<string, any>;
  subtasks: Subtask[];
  dependencies: string[];
  blockedBy: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserRef;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  taskId: string;
  content: string;
  contentHtml: string;
  authorId: string;
  author: ActorRef;
  mentions: MentionRef[];
  attachments: DocumentRef[];
  reactions: Reaction[];
  replyTo?: string;
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'task_assigned' | 'task_completed' | 'comment' | 'system' | 'alert';
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  actor: ActorRef;
  target: TargetRef;
  actions: NotificationAction[];
  createdAt: Date;
}
```

### Document

```typescript
interface Document {
  id: string;
  tenantId: string;
  name: string;
  type: 'deliverable' | 'attachment' | 'report' | 'log';
  mimeType: string;
  size: number;
  url: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  taskId?: string;
  agentId?: string;
  uploadedBy: ActorRef;
  versions: DocumentVersion[];
  metadata?: Record<string, any>;
  access: DocumentAccess;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Apêndice B: Exemplos de Uso

### Criar Agente e Atribuir Tarefa

```bash
# 1. Criar agente
curl -X POST https://api.baas.com/api/mission-control/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Analista de Dados",
    "type": "specialist",
    "personality": {
      "tone": "technical",
      "formality": 0.8
    }
  }'

# 2. Criar tarefa para o agente
curl -X POST https://api.baas.com/api/mission-control/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Gerar relatório mensal",
    "agentId": "agent_clxyz123",
    "priority": "high",
    "dueDate": "2025-02-01T18:00:00Z"
  }'
```

### Monitorar Atividades em Tempo Real

```javascript
const ws = new WebSocket('wss://api.baas.com/ws/mission-control');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token: TOKEN }));
  ws.send(JSON.stringify({ 
    type: 'subscribe', 
    channels: ['tasks', 'agents', 'notifications'] 
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'task.completed':
      showNotification(`Tarefa "${data.data.title}" concluída!`);
      break;
    case 'agent.health_updated':
      updateAgentStatus(data.data);
      break;
    case 'notification.new':
      incrementBadge();
      break;
  }
};
```

---

*Especificação criada em 31/01/2025 | Lobo 🐺*
