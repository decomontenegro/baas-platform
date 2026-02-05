# APIs Existentes no BaaS - Mapeamento Completo

> Análise realizada em: 2025-01-27
> Diretório: `/src/app/api`

---

## 📊 Resumo Executivo

| Categoria | Quantidade | Status |
|-----------|------------|--------|
| APIs de CRUD | 18 | ✅ Completo |
| APIs de Actions | 4 | ✅ Completo |
| APIs de Analytics | 7 | ✅ Completo |
| APIs de Admin | 8 | ✅ Completo |
| APIs de Real-time | 0 | ❌ Não existe |
| APIs de Notificações | 5 | ✅ Completo |
| APIs de Integração | 5 | ✅ Completo |

---

## 1️⃣ APIs de CRUD (Reaproveitáveis para Tasks/Agents)

### 🤖 Bots
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/bots` | GET | Lista bots com paginação, filtros, busca | ✅ Modelo perfeito |
| `/api/bots` | POST | Cria bot com personality, systemPrompt, model | ✅ Modelo perfeito |
| `/api/bots/[id]` | GET | Obtém bot por ID | ✅ |
| `/api/bots/[id]` | PUT | Atualiza bot | ✅ |
| `/api/bots/[id]` | DELETE | Soft delete | ✅ |
| `/api/bots/[id]/duplicate` | POST | Duplica bot | 🟡 Útil para agents |
| `/api/bots/[id]/test` | POST | Testa bot | 🟡 Adaptar para tasks |
| `/api/bots/[id]/assign` | POST | Associa a canais | ✅ |

**Padrão identificado:**
```typescript
// Filtros padrão
const { page, limit, offset } = getPaginationParams(searchParams)
const activeOnly = searchParams.get('active')
const search = searchParams.get('search')

// Response padrão
return paginatedResponse(data, { page, limit, total, totalPages })
```

### 📋 Actions (Quick Actions)
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/actions` | GET | Lista ações com filtros | ✅ Base para Tasks |
| `/api/actions` | POST | Cria ação | ✅ Base para Tasks |
| `/api/actions/[id]` | GET/PUT/DELETE | CRUD individual | ✅ |
| `/api/actions/[id]/execute` | POST | **Executa ação** | ⭐ Modelo para Task execution |
| `/api/actions/history` | GET | Histórico de execuções | ✅ Modelo para Task history |

**Schema de Actions (reutilizável):**
```typescript
{
  name: string
  trigger: string
  type: 'RESPONSE' | 'WEBHOOK' | 'SEARCH' | 'FUNCTION'
  config: JsonObject
  triggerType: 'COMMAND' | 'KEYWORD' | 'PATTERN' | 'AUTO'
  triggerConfig: JsonObject
  responseTemplate?: string
  errorTemplate?: string
  allowedRoles: string[]
  cooldownSeconds?: number
  isEnabled: boolean
}
```

### ⏰ Scheduled Messages
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/scheduled` | GET | Lista agendamentos | ✅ Base para scheduled tasks |
| `/api/scheduled` | POST | Cria agendamento | ✅ |
| `/api/scheduled/[id]` | GET/PUT/DELETE | CRUD individual | ✅ |

**Tipos de agendamento:**
- `ONCE` - Uma vez
- `RECURRING` - Recorrente (cron)
- `TRIGGER_BASED` - Baseado em evento

### 📚 Knowledge Base
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/knowledge` | GET/POST | Lista/Cria KB | ✅ Para agent context |
| `/api/knowledge/[id]` | GET/PUT/DELETE | CRUD KB | ✅ |
| `/api/knowledge/[id]/documents` | GET/POST | Documentos | ✅ |
| `/api/knowledge/[id]/documents/[docId]` | DELETE | Remove doc | ✅ |
| `/api/knowledge/[id]/query` | POST | **Busca semântica** | ⭐ Útil para agents |

### 💬 Conversations
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/conversations` | GET | Lista com filtros avançados | ✅ |
| `/api/conversations` | POST | Cria conversa | ✅ |
| `/api/conversations/[id]` | GET/PUT/DELETE | CRUD | ✅ |
| `/api/conversations/[id]/messages` | GET/POST | Mensagens | ✅ |
| `/api/conversations/[id]/note` | POST | Adiciona nota | 🟡 |
| `/api/conversations/[id]/tag` | POST | Adiciona tag | 🟡 |

### 📣 Campaigns
| Endpoint | Método | Descrição | Reaproveitável |
|----------|--------|-----------|----------------|
| `/api/campaigns` | GET/POST | Lista/Cria | ✅ Modelo para batch tasks |
| `/api/campaigns/[id]` | GET/PUT/DELETE | CRUD | ✅ |
| `/api/campaigns/[id]/start` | POST | Inicia campanha | ✅ Modelo para task start |
| `/api/campaigns/[id]/pause` | POST | Pausa | ✅ |
| `/api/campaigns/[id]/recipients` | GET/POST | Destinatários | 🟡 |
| `/api/campaigns/[id]/stats` | GET | Estatísticas | ✅ |

### 🏢 Workspaces & Channels
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/workspaces` | GET/POST | CRUD workspaces |
| `/api/workspaces/[id]` | GET/PUT/DELETE | Individual |
| `/api/channels` | GET/POST | CRUD channels |
| `/api/channels/[id]` | GET/PUT/DELETE | Individual |
| `/api/channels/[id]/test` | POST | Testa conexão |
| `/api/channels/whatsapp` | POST | WhatsApp específico |

### 👥 Team Management
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/team` | GET | Lista membros |
| `/api/team` | POST | Adiciona membro |
| `/api/team/[id]` | PUT/DELETE | Gerencia membro |
| `/api/team/invite` | POST | Envia convite |
| `/api/team/invite/[token]/accept` | POST | Aceita convite |

### 🎭 Personalities & Templates
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/personalities` | GET/POST | CRUD personalidades |
| `/api/personalities/[id]` | GET/PUT/DELETE | Individual |
| `/api/personalities/[id]/preview` | POST | Preview |
| `/api/templates` | GET/POST | Templates de bot |
| `/api/templates/[id]` | GET/PUT/DELETE | Individual |
| `/api/templates/categories` | GET | Categorias |

---

## 2️⃣ APIs de Real-time / WebSocket

### ⚠️ **NÃO EXISTE IMPLEMENTAÇÃO**

O código tem comentário indicando intenção:
```typescript
// Emit real-time event (if using websockets for dashboard updates)
// await pusher.trigger(`private-org-${organizationId}`, eventType, data);
```

**Dependência instalada:** `pusher` (no package.json)

---

## 3️⃣ APIs de Notificações

| Endpoint | Método | Descrição | Status |
|----------|--------|-----------|--------|
| `/api/notifications` | GET | Lista notificações paginadas | ✅ |
| `/api/notifications/[id]/read` | POST | Marca como lida | ✅ |
| `/api/notifications/read-all` | POST | Marca todas como lidas | ✅ |
| `/api/notifications/preferences` | GET/PUT | Preferências | ✅ |

**Tipos de notificação existentes:**
- Sistema
- Handoff
- Campanhas
- Alertas

---

## 4️⃣ APIs de Cron/Scheduler

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/cron/scheduler` | POST | Processa mensagens agendadas e campanhas |
| `/api/cron/scheduler` | GET | Health check |

**Worker existente:** `@/lib/workers/scheduler`
- Processa `scheduledMessages`
- Processa `campaigns`

---

## 5️⃣ APIs de Handoff (Human Takeover)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/handoff/request` | POST | Solicita handoff |
| `/api/handoff/queue` | GET | Fila de handoffs |
| `/api/handoff/settings` | GET/PUT | Configurações |
| `/api/handoff/rules` | GET/POST | Regras de handoff |
| `/api/handoff/rules/[id]` | PUT/DELETE | Individual |
| `/api/handoff/[id]` | GET/PUT | Detalhes |
| `/api/handoff/[id]/assign` | POST | Atribui agente |
| `/api/handoff/[id]/resolve` | POST | Resolve |
| `/api/handoff/[id]/notes` | POST | Adiciona nota |

---

## 6️⃣ APIs de Integrations

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/integrations` | GET | Lista integrações (available + connected) |
| `/api/integrations` | POST | Conecta integração |
| `/api/integrations/[id]` | GET/DELETE | Individual |
| `/api/integrations/[id]/sync` | POST | Sincroniza dados |
| `/api/integrations/oauth/[type]/connect` | GET | Inicia OAuth |
| `/api/integrations/oauth/[type]/callback` | GET | Callback OAuth |

**Tipos suportados:** Google Sheets, HubSpot, Salesforce, etc.

---

## 7️⃣ APIs de Analytics

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/analytics` | GET | Overview metrics |
| `/api/analytics/overview` | GET | Métricas gerais |
| `/api/analytics/usage` | GET | Uso de recursos |
| `/api/analytics/activity` | GET | Atividade |
| `/api/analytics/trends` | GET | Tendências |
| `/api/analytics/channels/[id]` | GET | Por canal |
| `/api/analytics/export` | POST | Exporta dados |

---

## 8️⃣ APIs de Admin

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/admin/setup` | POST | Setup inicial |
| `/api/admin/health` | GET | Health check |
| `/api/admin/metrics` | GET | Métricas do sistema |
| `/api/admin/audit` | GET | Logs de auditoria |
| `/api/admin/alerts` | GET/POST | Alertas |
| `/api/admin/emergency` | POST | Ações de emergência |
| `/api/admin/cron` | GET/POST | Gerencia cron jobs |
| `/api/admin/credentials` | GET/POST | Credenciais |

---

## 9️⃣ APIs Específicas

### Clawdbot Integration
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/clawdbot/send` | POST | Envia mensagem via Gateway |
| `/api/clawdbot/stats` | GET | Estatísticas |

### Audit
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/audit` | GET | Lista audit logs |
| `/api/audit/[id]` | GET | Detalhes |
| `/api/audit/export` | POST | Exporta |
| `/api/audit/alerts` | GET | Alertas de segurança |

### GDPR
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/gdpr/export` | POST | Exporta dados do usuário |
| `/api/gdpr/delete` | POST | Deleta dados |

### Billing
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/billing` | GET | Info de billing |
| `/api/billing/portal` | POST | Stripe portal |
| `/api/billing/upgrade` | POST | Upgrade plano |
| `/api/billing/usage` | GET | Uso do período |
| `/api/billing/invoices` | GET | Faturas |
| `/api/billing/webhook` | POST | Stripe webhook |

### Auth
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/[...nextauth]` | ALL | NextAuth handler |
| `/api/auth/magic-link` | POST | Magic link login |

### Misc
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/tenants` | GET/POST | Multi-tenant |
| `/api/features` | GET | Feature flags |
| `/api/settings` | GET/PUT | Configurações |
| `/api/specialists` | GET/POST | Especialistas |
| `/api/health` | GET | Health check |
| `/api/docs` | GET | OpenAPI spec |
| `/api/docs/ui` | GET | Swagger UI |

---

## 🔴 O QUE FALTA CRIAR

### 1. **Real-time / WebSocket** (Prioridade ALTA)
```typescript
// Necessário para:
- Dashboard updates em tempo real
- Notificações push
- Status de tasks/agents
- Chat em tempo real

// Sugestão: Usar Pusher ou Socket.io
```

### 2. **APIs de Tasks** (Prioridade ALTA)
```typescript
// Endpoints necessários:
POST   /api/tasks           - Cria task
GET    /api/tasks           - Lista tasks
GET    /api/tasks/[id]      - Detalhes da task
PUT    /api/tasks/[id]      - Atualiza task
DELETE /api/tasks/[id]      - Remove task
POST   /api/tasks/[id]/run  - Executa task
POST   /api/tasks/[id]/stop - Para task
GET    /api/tasks/[id]/logs - Logs de execução
GET    /api/tasks/[id]/status - Status em tempo real (SSE?)
```

### 3. **APIs de Agents** (Prioridade ALTA)
```typescript
// Endpoints necessários:
POST   /api/agents           - Cria agent
GET    /api/agents           - Lista agents
GET    /api/agents/[id]      - Detalhes
PUT    /api/agents/[id]      - Atualiza
DELETE /api/agents/[id]      - Remove
POST   /api/agents/[id]/chat - Conversa com agent
GET    /api/agents/[id]/conversations - Histórico
POST   /api/agents/[id]/tools - Associa tools
GET    /api/agents/[id]/metrics - Métricas
```

### 4. **APIs de Tools** (Prioridade MÉDIA)
```typescript
// Endpoints necessários:
GET    /api/tools           - Lista tools disponíveis
POST   /api/tools           - Registra custom tool
GET    /api/tools/[id]      - Detalhes
PUT    /api/tools/[id]      - Atualiza
DELETE /api/tools/[id]      - Remove
POST   /api/tools/[id]/test - Testa tool
```

### 5. **APIs de Workflows** (Prioridade MÉDIA)
```typescript
// Endpoints necessários:
POST   /api/workflows           - Cria workflow
GET    /api/workflows           - Lista
GET    /api/workflows/[id]      - Detalhes
PUT    /api/workflows/[id]      - Atualiza
DELETE /api/workflows/[id]      - Remove
POST   /api/workflows/[id]/run  - Executa
GET    /api/workflows/[id]/runs - Histórico de execuções
```

### 6. **Server-Sent Events (SSE)** (Prioridade MÉDIA)
```typescript
// Endpoint para streaming:
GET /api/stream/[sessionId] - SSE stream para updates
```

---

## ✅ PADRÕES REUTILIZÁVEIS

### 1. Autenticação
```typescript
import { auth } from '@/lib/auth'
async function requireAuth() {
  const session = await auth()
  if (!session?.user) throw new UnauthorizedError()
  return session
}
```

### 2. Tratamento de Erros
```typescript
import { handleApiError, apiResponse, NotFoundError } from '@/lib/api/errors'
// Em cada handler: return handleApiError(error)
```

### 3. Validação com Zod
```typescript
import { parseBody, parseQuery } from '@/lib/api/validate'
const data = await parseBody(request, createSchema)
const filters = parseQuery(request, filterSchema)
```

### 4. Paginação
```typescript
return apiResponse({
  items,
  pagination: { page, limit, total, totalPages }
})
```

### 5. Soft Delete
```typescript
where: { tenantId, deletedAt: null }
// DELETE -> update({ deletedAt: new Date() })
```

---

## 📝 RECOMENDAÇÕES

1. **Reaproveitar Actions como base para Tasks**
   - Estrutura similar
   - Sistema de execução já existe
   - Adicionar: queue, retries, webhooks

2. **Reaproveitar Bots como base para Agents**
   - personality, systemPrompt, model já existem
   - Adicionar: tools, memory, context

3. **Implementar WebSocket com Pusher**
   - Já está no package.json
   - Comentários indicam intenção
   - Criar lib/realtime.ts

4. **Usar Scheduled Messages para Task scheduling**
   - Infraestrutura de cron já existe
   - Worker scheduler funcionando

5. **Knowledge Base para Agent RAG**
   - Embedding já implementado
   - Query semântica funcionando
