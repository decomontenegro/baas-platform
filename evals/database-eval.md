# Database Schema Evaluation - BaaS Dashboard

**Avaliado em:** 2025-01-21  
**Arquivo:** `prisma/schema.prisma`  
**Versão:** Initial Schema

---

## 📊 Nota Geral: 6/10

| Critério | Nota | Status |
|----------|------|--------|
| Normalização | 7/10 | 🟡 Bom |
| Multi-tenancy | 5/10 | 🟠 Atenção |
| Performance | 6/10 | 🟡 Bom |
| Escalabilidade | 5/10 | 🟠 Atenção |
| LGPD Compliance | 3/10 | 🔴 Crítico |
| Audit Trail | 5/10 | 🟠 Atenção |
| Flexibilidade | 8/10 | 🟢 Ótimo |

---

## 1. Normalização (7/10) 🟡

### ✅ Pontos Positivos
- Estrutura relacional bem definida: `User → Tenant`, `Workspace → Tenant`, `Channel → Workspace`
- Foreign keys com cascade delete apropriado
- Sem campos redundantes visíveis
- Uso correto de `@unique` constraints

### ❌ Problemas Identificados
- `Account` e `Session` não têm relação direta com `Tenant` (isolamento fraco)
- `Channel` depende transitivamente de `Tenant` via `Workspace` (pode complicar queries)

### 💡 Sugestões
```prisma
model Account {
  // ... campos existentes
  tenantId  String?
  tenant    Tenant? @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
}
```

---

## 2. Multi-tenancy (5/10) 🟠

### ✅ Pontos Positivos
- `Tenant` existe como entidade central
- `User.tenantId` presente
- `Workspace.tenantId` presente

### ❌ Problemas Críticos
- **`Channel` sem `tenantId` direto** — requer JOIN para filtrar por tenant
- **`Account`, `Session` sem `tenantId`** — risco de data leak entre tenants
- **Sem RLS (Row Level Security)** — toda proteção está na aplicação

### 💡 Sugestões
```prisma
// Adicionar tenantId em TODAS as tabelas de negócio
model Channel {
  // ... campos existentes
  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
}

// Criar RLS policies no PostgreSQL
-- Execute via migration SQL
ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Channel"
  USING (tenant_id = current_setting('app.tenant_id'));
```

---

## 3. Performance (6/10) 🟡

### ✅ Índices Existentes
- `Workspace(tenantId)` ✓
- `Channel(workspaceId)` ✓
- `Channel(type)` ✓
- `Channel(status)` ✓

### ❌ Índices Faltando
- `User(tenantId)` — queries por tenant serão lentas
- `Account(userId)` — lookup de accounts será full scan
- `Session(userId)` — autenticação lenta
- `Session(expires)` — cleanup de sessões expiradas

### 💡 Sugestões
```prisma
model User {
  // ... campos existentes
  @@index([tenantId])
  @@index([email, tenantId]) // busca por email dentro do tenant
}

model Account {
  // ... campos existentes
  @@index([userId])
}

model Session {
  // ... campos existentes
  @@index([userId])
  @@index([expires])
}

model Channel {
  // ... campos existentes
  @@index([tenantId, status]) // composite index para dashboard
  @@index([workspaceId, type])
}
```

---

## 4. Escalabilidade (5/10) 🟠

### ✅ Pontos Positivos
- Usa `cuid()` como ID — bom para sistemas distribuídos
- `tenantId` nas principais tabelas permite sharding por tenant
- Json fields permitem schema evolution

### ❌ Limitações
- Sem campos para particionamento temporal (ex: `created_month`)
- Sem preparação para sharding (ex: `shard_key`)
- Cascade deletes podem ser problema em alta escala

### 💡 Sugestões para Futuro
```prisma
model Channel {
  // ... campos existentes
  createdMonth  String? // "2025-01" para particionamento
  
  @@index([createdMonth]) // partition pruning
}

// Considerar modelo de eventos para audit trail
model ChannelEvent {
  id          String   @id @default(cuid())
  channelId   String
  tenantId    String
  eventType   String
  payload     Json
  createdAt   DateTime @default(now())
  
  @@index([channelId, createdAt])
  @@index([tenantId, createdAt])
}
```

---

## 5. LGPD Compliance (3/10) 🔴 CRÍTICO

### ❌ Problemas Graves
- **Sem soft delete (`deletedAt`)** — impossível recuperar dados ou auditar exclusões
- **Sem data retention fields** — difícil implementar políticas de retenção
- **Sem campos de anonimização** — LGPD exige capacidade de anonimizar
- **Cascade delete** — dados são perdidos permanentemente

### 💡 Correções Necessárias
```prisma
// Mixin base para todas as entidades
model User {
  // ... campos existentes
  deletedAt   DateTime?   // soft delete
  deletedBy   String?     // quem deletou (audit)
  
  @@index([deletedAt])
}

model Tenant {
  // ... campos existentes
  deletedAt       DateTime?
  dataRetention   Int       @default(365) // dias para reter dados
  gdprConsent     DateTime? // consentimento LGPD
  anonymizedAt    DateTime? // quando foi anonimizado
}

// Tabela de consentimentos LGPD
model Consent {
  id          String   @id @default(cuid())
  userId      String
  tenantId    String
  purpose     String   // "marketing", "analytics", etc
  granted     Boolean
  grantedAt   DateTime
  revokedAt   DateTime?
  ipAddress   String?
  userAgent   String?
  
  @@index([userId])
  @@index([tenantId])
}
```

---

## 6. Audit Trail (5/10) 🟠

### ✅ Presente
- `createdAt` na maioria das tabelas
- `updatedAt` na maioria das tabelas

### ❌ Ausente
- `deletedAt` em todas as tabelas
- `createdBy`, `updatedBy` para rastrear quem fez alterações
- `Account`, `Session`, `VerificationToken` sem timestamps
- Tabela de audit log para mudanças críticas

### 💡 Sugestões
```prisma
// Adicionar em TODAS as tabelas
model Workspace {
  // ... campos existentes
  deletedAt   DateTime?
  createdBy   String?
  updatedBy   String?
}

// Audit log centralizado
model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String?
  action      String   // CREATE, UPDATE, DELETE, LOGIN
  entity      String   // User, Channel, etc
  entityId    String
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  
  @@index([tenantId, createdAt])
  @@index([entity, entityId])
  @@index([userId, createdAt])
}
```

---

## 7. Flexibilidade (8/10) 🟢

### ✅ Pontos Positivos
- **Json fields** bem utilizados (`settings`, `config`, `metadata`)
- **Enums** bem definidos e extensíveis
- Estrutura permite adicionar novos tipos de canal facilmente
- `TenantPlan` enum permite evolução de pricing

### 💡 Sugestões de Melhoria
```prisma
// Adicionar enum para status de usuário
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}

model User {
  // ... campos existentes
  status  UserStatus @default(PENDING_VERIFICATION)
}

// Considerar tabela de features para feature flags
model TenantFeature {
  id         String  @id @default(cuid())
  tenantId   String
  feature    String
  enabled    Boolean @default(false)
  config     Json    @default("{}")
  
  @@unique([tenantId, feature])
}
```

---

## 🎯 Prioridade de Correções

### 🔴 Urgente (antes de produção)
1. Adicionar `deletedAt` em todas as tabelas (LGPD)
2. Adicionar `tenantId` em `Channel` (multi-tenancy)
3. Criar índice em `User(tenantId)`

### 🟠 Importante (próximo sprint)
4. Adicionar timestamps em `Account`, `Session`
5. Criar tabela `AuditLog`
6. Adicionar índices de performance faltantes

### 🟡 Recomendado (backlog)
7. Implementar RLS no PostgreSQL
8. Adicionar `createdBy`/`updatedBy`
9. Criar tabela de consentimento LGPD
10. Preparar campos para particionamento

---

## 📝 Schema Corrigido (Sugestão)

```prisma
// Base fields a adicionar em todas as tabelas principais:
// createdAt   DateTime  @default(now())
// updatedAt   DateTime  @updatedAt
// deletedAt   DateTime?
// createdBy   String?
// updatedBy   String?

// Índices mínimos recomendados:
// @@index([tenantId])
// @@index([deletedAt])

// Ver arquivo completo em: prisma/schema.suggested.prisma
```

---

**Avaliador:** Subagent Database Eval  
**Próxima revisão:** Após implementação das correções urgentes
