# Estimativa de Esforço - APIs do Mission Control

**Data:** 2025-02-02  
**Baseado em:** MISSION-CONTROL-SCHEMA.md + estrutura existente do baas-app

---

## 📊 Resumo Executivo

| API | Complexidade | Esforço (h) | Prioridade |
|-----|-------------|-------------|------------|
| CRUD Agents | Média | 12-16h | 🔴 Alta |
| CRUD Tasks | Alta | 16-24h | 🔴 Alta |
| CRUD Comments | Média | 10-14h | 🔴 Alta |
| Activity Feed | Média | 8-12h | 🟡 Média |
| Notifications | Média | 10-14h | 🟡 Média |
| Documents | Média | 10-14h | 🟡 Média |
| Gateway Integration | Alta | 20-30h | 🔴 Alta |
| **TOTAL** | - | **86-124h** | - |

**Estimativa realista:** ~100-110 horas (2-3 semanas de dev focado)

---

## 1. CRUD de Agents

### Endpoints
```
GET    /api/agents              # Listar agentes
POST   /api/agents              # Criar agente
GET    /api/agents/:id          # Detalhes do agente
PATCH  /api/agents/:id          # Atualizar agente
DELETE /api/agents/:id          # Remover agente
PATCH  /api/agents/:id/status   # Atualizar status (IDLE/WORKING/BLOCKED)
GET    /api/agents/:id/tasks    # Tasks atribuídas ao agente
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 1h | 🟢 Baixa |
| Validação Zod (create/update) | 1h | 🟢 Baixa |
| CRUD básico (GET/POST/PATCH/DELETE) | 4h | 🟢 Baixa |
| Endpoint status com logging | 2h | 🟡 Média |
| Filtros e paginação | 2h | 🟡 Média |
| Testes de integração | 3h | 🟡 Média |
| Documentação OpenAPI | 1h | 🟢 Baixa |

**Subtotal: 12-16h**

### Dependências
- Schema `Agent` já definido no MISSION-CONTROL-SCHEMA.md
- Seguir padrão existente em `/api/bots/*`

---

## 2. CRUD de Tasks

### Endpoints
```
GET    /api/tasks                    # Listar tasks (com filtros)
POST   /api/tasks                    # Criar task
GET    /api/tasks/:id                # Detalhes da task
PATCH  /api/tasks/:id                # Atualizar task
DELETE /api/tasks/:id                # Remover task
POST   /api/tasks/:id/assign         # Atribuir agentes
POST   /api/tasks/:id/start          # Iniciar task
POST   /api/tasks/:id/complete       # Completar task
GET    /api/tasks/:id/subtasks       # Subtasks
POST   /api/tasks/:id/subtasks       # Criar subtask
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 1h | 🟢 Baixa |
| Validação Zod (create/update) | 2h | 🟡 Média |
| CRUD básico | 4h | 🟢 Baixa |
| Hierarquia (parent/subtasks) | 3h | 🟡 Média |
| Status machine (TODO→IN_PROGRESS→DONE) | 2h | 🟡 Média |
| Assignment (N:N com Agents) | 2h | 🟡 Média |
| Filtros avançados (status, priority, assignee) | 3h | 🟡 Média |
| Verificação de dependências | 2h | 🟡 Média |
| Testes de integração | 3h | 🟡 Média |
| Documentação OpenAPI | 2h | 🟢 Baixa |

**Subtotal: 16-24h**

### Complexidades Adicionais
- Hierarquia de subtasks (recursão controlada)
- Dependências entre tasks (`dependsOnIds`)
- Transações para status changes + activities
- Validação de ciclos em dependências

---

## 3. CRUD de Comments (TaskComment)

### Endpoints
```
GET    /api/tasks/:taskId/comments       # Listar comentários da task
POST   /api/tasks/:taskId/comments       # Criar comentário
GET    /api/comments/:id                 # Detalhes do comentário
PATCH  /api/comments/:id                 # Editar comentário
DELETE /api/comments/:id                 # Remover comentário
POST   /api/comments/:id/replies         # Responder comentário
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 1h | 🟢 Baixa |
| Validação Zod | 1h | 🟢 Baixa |
| CRUD básico | 3h | 🟢 Baixa |
| Thread de replies | 2h | 🟡 Média |
| Parsing de @mentions | 2h | 🟡 Média |
| Criar notificações automáticas | 2h | 🟡 Média |
| Attachments (JSON storage) | 1h | 🟢 Baixa |
| Testes de integração | 2h | 🟡 Média |

**Subtotal: 10-14h**

### Features Especiais
- Detecção de @mentions via regex
- Criação automática de `AgentNotification` para mencionados
- Thread support (parent/replies)

---

## 4. Activity Feed API

### Endpoints
```
GET    /api/activities                # Feed global (paginado)
GET    /api/agents/:id/activities     # Atividades do agente
GET    /api/tasks/:id/activities      # Atividades da task
POST   /api/activities                # Registrar atividade (interno)
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 0.5h | 🟢 Baixa |
| Validação Zod | 0.5h | 🟢 Baixa |
| GET paginado com includes | 2h | 🟢 Baixa |
| Filtros (type, agent, task, dateRange) | 2h | 🟡 Média |
| Helper para criar activities | 1h | 🟢 Baixa |
| Integração em outros endpoints | 3h | 🟡 Média |
| Testes | 2h | 🟡 Média |

**Subtotal: 8-12h**

### Implementação
- Activity é criada automaticamente por outros endpoints (task.start, comment.create, etc.)
- Helper function `createActivity(type, agentId?, taskId?, message, metadata)`
- Índices para queries eficientes por date/agent/task

---

## 5. Notifications API

### Endpoints
```
GET    /api/agents/:id/notifications          # Notificações do agente
GET    /api/agents/:id/notifications/pending  # Apenas não entregues
PATCH  /api/notifications/:id/delivered       # Marcar como entregue
PATCH  /api/notifications/:id/read            # Marcar como lida
DELETE /api/notifications/:id                 # Remover notificação
POST   /api/notifications/send                # Enviar notificação (admin)
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 0.5h | 🟢 Baixa |
| Validação Zod | 0.5h | 🟢 Baixa |
| GET com filtros (delivered, read, priority) | 2h | 🟢 Baixa |
| Batch update (marcar várias como lidas) | 1h | 🟢 Baixa |
| Criação automática via @mentions | 2h | 🟡 Média |
| Expiração de notificações (cleanup job) | 2h | 🟡 Média |
| Long-polling ou SSE (opcional) | 3h | 🔴 Alta |
| Testes | 2h | 🟡 Média |

**Subtotal: 10-14h**

### Considerações
- Polling pattern (agentes consultam periodicamente)
- Opção futura: SSE/WebSocket para real-time
- Priorização (URGENT > HIGH > NORMAL > LOW)

---

## 6. Documents API

### Endpoints
```
GET    /api/documents                   # Listar documentos
POST   /api/documents                   # Criar documento
GET    /api/documents/:id               # Detalhes do documento
PATCH  /api/documents/:id               # Atualizar documento
DELETE /api/documents/:id               # Remover documento
GET    /api/tasks/:id/documents         # Documentos da task
GET    /api/agents/:id/documents        # Documentos criados pelo agente
POST   /api/documents/:id/versions      # Nova versão (opcional)
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Schema Prisma + migration | 0.5h | 🟢 Baixa |
| Validação Zod | 1h | 🟢 Baixa |
| CRUD básico | 3h | 🟢 Baixa |
| Versionamento simples | 2h | 🟡 Média |
| Filtros (type, author, task) | 2h | 🟡 Média |
| Upload de arquivos (opcional) | 3h | 🟡 Média |
| Testes | 2h | 🟡 Média |

**Subtotal: 10-14h**

### Tipos de Documento
```typescript
enum DocumentType {
  SPEC,      // Especificação
  CODE,      // Código fonte
  TEST,      // Testes
  REPORT,    // Relatório
  NOTE,      // Nota
  ANALYSIS,  // Análise
  PLAN,      // Plano
  REVIEW,    // Code review
  OTHER
}
```

---

## 7. Integração com Clawdbot Gateway

### Endpoints Necessários
```
# Sync de dados
GET    /api/gateway/status              # Status da conexão
POST   /api/gateway/sync                # Trigger sync manual
GET    /api/gateway/sessions            # Listar sessões ativas

# Controle de agentes
POST   /api/gateway/agents/:id/spawn    # Spawnar agente no Clawdbot
POST   /api/gateway/agents/:id/stop     # Parar agente
GET    /api/gateway/agents/:id/logs     # Logs do agente

# Config
GET    /api/gateway/config              # Ler config atual
PATCH  /api/gateway/config              # Atualizar config
POST   /api/gateway/config/validate     # Validar config

# Webhooks (receber do Gateway)
POST   /api/webhooks/gateway/message    # Nova mensagem
POST   /api/webhooks/gateway/event      # Evento do agente
POST   /api/webhooks/gateway/health     # Health check
```

### Tarefas
| Tarefa | Horas | Complexidade |
|--------|-------|--------------|
| Client HTTP para Gateway API | 3h | 🟡 Média |
| Autenticação/API Key management | 2h | 🟡 Média |
| GET /status e /sessions | 2h | 🟢 Baixa |
| Spawn/Stop de agentes | 4h | 🔴 Alta |
| Config read/write | 3h | 🟡 Média |
| Validação de config | 2h | 🟡 Média |
| Webhook handlers | 4h | 🟡 Média |
| Event processing (criar Activities) | 3h | 🟡 Média |
| Error handling e retries | 2h | 🟡 Média |
| Sync job (background) | 3h | 🟡 Média |
| Testes de integração | 4h | 🔴 Alta |

**Subtotal: 20-30h**

### Mapeamento Gateway → Mission Control

| Gateway | Mission Control |
|---------|-----------------|
| Session | Agent (status sync) |
| Message | Activity + Comment |
| Config | Agent.systemPrompt, capabilities |
| Health | Agent.status + Notification |

### Complexidades
- Autenticação segura com Gateway
- Retry logic para operações críticas
- Eventual consistency entre sistemas
- Health check bidirecional

---

## 📈 Priorização Recomendada

### Fase 1: Core (40-50h) - Semana 1-2
1. ✅ CRUD Agents (12-16h)
2. ✅ CRUD Tasks (16-24h)
3. ✅ CRUD Comments (10-14h)

### Fase 2: Collaboration (18-26h) - Semana 2-3
4. Activity Feed (8-12h)
5. Notifications (10-14h)

### Fase 3: Artifacts + Integration (30-44h) - Semana 3-4
6. Documents (10-14h)
7. Gateway Integration (20-30h)

---

## 🛠️ Considerações Técnicas

### Padrões a Seguir
- **Validação:** Zod schemas (já usado no projeto)
- **DB:** Prisma ORM (já configurado)
- **Auth:** NextAuth session validation
- **Paginação:** Cursor-based (offset para MVP)
- **Errors:** RFC 7807 Problem Details

### Estrutura de Arquivos
```
app/api/
├── agents/
│   ├── route.ts              # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts          # GET, PATCH, DELETE
│       ├── status/route.ts   # PATCH status
│       ├── tasks/route.ts    # GET tasks
│       └── notifications/route.ts
├── tasks/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── assign/route.ts
│       ├── comments/route.ts
│       ├── subtasks/route.ts
│       └── documents/route.ts
├── comments/
│   └── [id]/route.ts
├── activities/route.ts
├── documents/
│   ├── route.ts
│   └── [id]/route.ts
├── notifications/
│   └── [id]/route.ts
└── gateway/
    ├── status/route.ts
    ├── sync/route.ts
    └── config/route.ts
```

### Middleware Comum
```typescript
// lib/api/middleware.ts
export const withAuth = (handler) => {...}
export const withTenant = (handler) => {...}
export const withValidation = (schema) => (handler) => {...}
export const withPagination = (handler) => {...}
```

---

## ⚠️ Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Gateway API não documentada | Alta | Alto | Engenharia reversa + contato com Clawdbot |
| Transações complexas | Média | Médio | Usar Prisma $transaction |
| Performance do Activity feed | Média | Médio | Índices + paginação agressiva |
| Concorrência em Tasks | Média | Médio | Locking otimista com version |

---

## 📋 Checklist de Entrega

### Por Endpoint
- [ ] Route handler implementado
- [ ] Zod schema de validação
- [ ] Testes de integração
- [ ] Documentação OpenAPI
- [ ] Error handling padronizado
- [ ] Logging adequado

### Global
- [ ] Migration Prisma aplicada
- [ ] Seeds de desenvolvimento
- [ ] Postman/Insomnia collection
- [ ] README da API

---

## 🏁 Conclusão

**Esforço total estimado: 86-124 horas**

Considerando:
- Curva de aprendizado do codebase existente
- Integração com Gateway (parte mais complexa)
- Testes e documentação

**Recomendação:** Alocar 2-3 semanas de desenvolvimento focado, ou 4-5 semanas em paralelo com outras atividades.

**Quick win:** Começar pelo CRUD de Agents e Tasks que desbloqueiam o Mission Control básico.

---

*Estimativa gerada em 2025-02-02*
