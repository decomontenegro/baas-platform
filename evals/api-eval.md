# API REST Design Evaluation - BaaS Dashboard

**Data:** 2025-01-25  
**Avaliador:** Subagent Eval-API  
**Versão:** 1.0

---

## 📊 Resumo Executivo

| Critério | Nota | Status |
|----------|------|--------|
| 1. RESTful Conventions | 9/10 | ✅ Excelente |
| 2. Consistency | 8/10 | ✅ Muito Bom |
| 3. Pagination | 7/10 | ⚠️ Bom |
| 4. Filtering & Sorting | 6/10 | ⚠️ Adequado |
| 5. Rate Limiting | 2/10 | ❌ Ausente |
| 6. Versioning | 1/10 | ❌ Ausente |
| 7. Input Validation (Zod) | 9/10 | ✅ Excelente |
| 8. Error Responses | 8/10 | ✅ Muito Bom |
| 9. Documentation (OpenAPI) | 1/10 | ❌ Ausente |
| 10. Authorization (Tenant Scoping) | 9/10 | ✅ Excelente |

**NOTA FINAL: 6.0/10** ⚠️

---

## 📋 Avaliação Detalhada

### 1. RESTful Conventions (9/10) ✅

**Pontos Positivos:**
- ✅ Verbos HTTP corretos: GET (list/read), POST (create), PATCH (update), DELETE (remove)
- ✅ URLs semânticas e hierárquicas: `/workspaces`, `/workspaces/[id]`, `/channels/[id]/test`
- ✅ Uso correto de status codes: 200 (OK), 201 (Created), 204 (No Content), 400, 401, 403, 404, 409, 500
- ✅ Recursos no plural (workspaces, channels, tenants)
- ✅ Nested resources fazem sentido (`/channels/[id]/test`)

**Sugestões:**
- Considerar adicionar PATCH vs PUT para semântica mais clara
- Adicionar HEAD para verificação de existência sem payload

```typescript
// Exemplo: HEAD /api/workspaces/[id]
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  // Retorna apenas headers, sem body
}
```

---

### 2. Consistency (8/10) ✅

**Pontos Positivos:**
- ✅ Response format consistente: `{ resource: data }` ou `{ resources: [], pagination: {} }`
- ✅ Error format padronizado: `{ error: { message, code, details? } }`
- ✅ Naming consistente em camelCase
- ✅ Todos handlers seguem mesmo padrão try/catch com `handleApiError`

**Inconsistências Encontradas:**
- ⚠️ `tenants/route.ts` retorna `{ tenant: {} }` enquanto deveria ser singular já que é "current tenant"
- ⚠️ Alguns responses incluem `_count` do Prisma diretamente (vazamento de implementação)

**Sugestões:**
```typescript
// Padronizar mapeamento de response
const formatWorkspace = (workspace: WorkspaceWithCount) => ({
  id: workspace.id,
  name: workspace.name,
  // ... campos explícitos
  channelCount: workspace._count.channels, // Melhor que expor _count
})
```

---

### 3. Pagination (7/10) ⚠️

**Pontos Positivos:**
- ✅ Implementação offset-based funcional
- ✅ Limites configuráveis (max 100)
- ✅ Response inclui metadata: `{ page, limit, total, totalPages }`

**Problemas:**
- ⚠️ Não há cursor-based pagination (melhor para datasets grandes)
- ⚠️ Faltam links HATEOAS (prev, next, first, last)
- ⚠️ Offset-based tem problemas com inserções/deleções durante paginação

**Sugestões:**
```typescript
// Adicionar links para navegação
return apiResponse({
  workspaces,
  pagination: {
    page,
    limit,
    total,
    totalPages,
    // Adicionar links
    links: {
      self: `/api/workspaces?page=${page}&limit=${limit}`,
      first: `/api/workspaces?page=1&limit=${limit}`,
      last: `/api/workspaces?page=${totalPages}&limit=${limit}`,
      prev: page > 1 ? `/api/workspaces?page=${page - 1}&limit=${limit}` : null,
      next: page < totalPages ? `/api/workspaces?page=${page + 1}&limit=${limit}` : null,
    },
  },
})

// Para cursor-based (futuro)
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(20),
})
```

---

### 4. Filtering & Sorting (6/10) ⚠️

**Pontos Positivos:**
- ✅ Channels tem filtros por `workspaceId`, `type`, `status`
- ✅ Schema de validação para filtros

**Problemas:**
- ❌ Não há sorting configurável pelo cliente
- ❌ Workspaces não tem nenhum filtro
- ❌ Tenants não listável (ok para single-tenant user)
- ❌ Falta busca textual (search)

**Sugestões:**
```typescript
// Schema de sorting genérico
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Filtros avançados para workspaces
export const workspaceFilterSchema = paginationSchema.merge(sortSchema).extend({
  search: z.string().optional(), // Busca em name/description
  hasChannels: z.coerce.boolean().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
})

// Uso no handler
const orderBy = sortBy 
  ? { [sortBy]: sortOrder }
  : { createdAt: 'desc' }
```

---

### 5. Rate Limiting (2/10) ❌

**Status: NÃO IMPLEMENTADO**

**Riscos:**
- 🚨 Vulnerável a DDoS
- 🚨 Abuso de API por bots
- 🚨 Custos não controlados

**Implementação Sugerida:**
```typescript
// middleware.ts ou lib/api/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
  analytics: true,
  prefix: 'baas-api',
})

export async function withRateLimit(
  request: NextRequest,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier)
  
  return {
    success,
    remaining,
    reset,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    },
  }
}
```

---

### 6. Versioning (1/10) ❌

**Status: NÃO IMPLEMENTADO**

**Riscos:**
- 🚨 Breaking changes afetarão todos os clientes
- 🚨 Não há caminho de migração

**Opções de Implementação:**

```typescript
// Opção 1: URL Path (recomendado para APIs públicas)
// /api/v1/workspaces

// Opção 2: Header (mais elegante, mais complexo)
// Accept: application/vnd.baas.v1+json

// Opção 3: Query param (não recomendado mas simples)
// /api/workspaces?version=1

// Implementação path-based (Next.js App Router):
// src/app/api/v1/workspaces/route.ts
```

**Sugestão Pragmática:**
Para MVP interno, adicionar versionamento quando API for pública. Documentar breaking changes no changelog.

---

### 7. Input Validation - Zod (9/10) ✅

**Pontos Positivos:**
- ✅ Schemas bem definidos e tipados
- ✅ Validação de enums (channelType, channelStatus)
- ✅ Coercion para números em query params
- ✅ Defaults sensatos (page=1, limit=20)
- ✅ Limites de tamanho (max 100 chars, max 500 description)
- ✅ Validação de CUID para IDs
- ✅ Helpers `parseBody` e `parseQuery` reutilizáveis
- ✅ Erros de validação mapeados para 400 com detalhes

**Sugestões:**
```typescript
// Adicionar sanitização para XSS
const sanitizedString = z.string().transform(s => DOMPurify.sanitize(s))

// Adicionar validação de config específica por tipo de channel
const whatsappConfigSchema = z.object({
  phoneNumberId: z.string(),
  accessToken: z.string(),
  webhookVerifyToken: z.string(),
})

const channelConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WHATSAPP'), config: whatsappConfigSchema }),
  z.object({ type: z.literal('TELEGRAM'), config: telegramConfigSchema }),
  // ...
])
```

---

### 8. Error Responses (8/10) ✅

**Pontos Positivos:**
- ✅ Error classes hierárquicas (ApiError, NotFoundError, etc.)
- ✅ Códigos de erro consistentes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, etc.)
- ✅ Tratamento de erros Prisma (P2002, P2025)
- ✅ Detalhes de validação Zod incluídos
- ✅ Erros genéricos não vazam stack traces

**Problemas:**
- ⚠️ Falta request ID para correlação
- ⚠️ Mensagens de erro poderiam ter mais contexto

**Sugestões:**
```typescript
// Adicionar request ID
export function handleApiError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
  const id = requestId || crypto.randomUUID()
  console.error(`[API Error] [${id}]`, error)
  
  return NextResponse.json({
    error: {
      id,
      message: error.message,
      code: error.code,
      // timestamp para debugging
      timestamp: new Date().toISOString(),
    }
  }, { status: error.statusCode })
}

// Middleware para gerar request ID
// headers: { 'X-Request-ID': requestId }
```

---

### 9. Documentation - OpenAPI (1/10) ❌

**Status: NÃO IMPLEMENTADO**

**Impacto:**
- 🚨 Difícil onboarding de novos devs
- 🚨 Sem documentação interativa
- 🚨 Sem geração automática de clients

**Implementação Sugerida:**
```typescript
// Usar next-swagger-doc ou similar
// src/app/api/docs/route.ts

import { createSwaggerSpec } from 'next-swagger-doc'

const spec = createSwaggerSpec({
  apiFolder: 'src/app/api',
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BaaS Dashboard API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  },
})

// Ou usar JSDoc nos handlers
/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     summary: List workspaces
 *     tags: [Workspaces]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of workspaces
 */
```

---

### 10. Authorization - Tenant Scoping (9/10) ✅

**Pontos Positivos:**
- ✅ TODAS as rotas verificam `tenantId` da sessão
- ✅ Verificação de ownership em resources aninhados
- ✅ Helper functions `getWorkspaceWithAccess`, `getChannelWithAccess`
- ✅ Role-based access para operações sensíveis (OWNER/ADMIN para tenant update)
- ✅ Separação clara: 401 (não autenticado) vs 403 (não autorizado)

**Sugestões:**
```typescript
// Extrair middleware de tenant scoping
export function withTenantScope<T>(
  handler: (req: NextRequest, tenantId: string) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    
    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }
    
    return handler(req, tenantId)
  }
}

// Uso:
export const GET = withTenantScope(async (req, tenantId) => {
  const workspaces = await prisma.workspace.findMany({
    where: { tenantId }
  })
  return apiResponse({ workspaces })
})
```

---

## 🔧 Recomendações Prioritárias

### Alta Prioridade (antes de produção)
1. **Rate Limiting** - Implementar com Upstash/Redis
2. **OpenAPI Docs** - Adicionar Swagger/OpenAPI spec
3. **Request ID** - Para correlação de logs

### Média Prioridade (sprint seguinte)
4. **Sorting** - Adicionar `sortBy` e `sortOrder` aos filtros
5. **Search** - Busca textual em workspaces/channels
6. **Pagination Links** - HATEOAS links (prev, next)

### Baixa Prioridade (futuro)
7. **API Versioning** - Quando API for pública
8. **Cursor Pagination** - Para datasets grandes
9. **Config Validation** - Schemas específicos por channel type

---

## 📁 Estrutura de Arquivos

```
src/app/api/
├── auth/
│   └── [...nextauth]/route.ts  ✅ NextAuth handler
├── tenants/
│   └── route.ts                ✅ GET, PATCH (current tenant)
├── workspaces/
│   ├── route.ts                ✅ GET (list), POST (create)
│   └── [id]/route.ts           ✅ GET, PATCH, DELETE
└── channels/
    ├── route.ts                ✅ GET (list+filter), POST (create)
    └── [id]/
        ├── route.ts            ✅ GET, PATCH, DELETE
        └── test/route.ts       ✅ POST (test bot)

src/lib/api/
├── errors.ts                   ✅ Error classes + handler
└── validate.ts                 ✅ Zod schemas + helpers
```

---

## ✅ Conclusão

A API está **bem estruturada** para um MVP. Os fundamentos de RESTful design, validação, e autorização estão sólidos. 

**Gaps críticos** são Rate Limiting e Documentação - devem ser adicionados antes de qualquer uso público.

A arquitetura facilita evolução futura. Parabéns pelo trabalho! 🎉

---

*Gerado automaticamente por eval-api subagent*
