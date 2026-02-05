# LGPD/GDPR Compliance - BaaS Dashboard

## Visão Geral

Este documento descreve a implementação de compliance LGPD (Lei Geral de Proteção de Dados) e GDPR (General Data Protection Regulation) no BaaS Dashboard.

## Princípios Implementados

### 1. Direito de Acesso (LGPD Art. 18, III / GDPR Art. 15)
- Usuários podem exportar todos os seus dados em formato JSON estruturado
- API: `POST /api/gdpr/export` para solicitar export
- API: `GET /api/gdpr/export?download=true` para baixar

### 2. Direito de Eliminação (LGPD Art. 18, VI / GDPR Art. 17)
- Implementação de Soft Delete em todas as tabelas
- Período de retenção configurável antes da anonimização
- API: `POST /api/gdpr/delete` para solicitar exclusão
- API: `DELETE /api/gdpr/delete?requestId=xxx` para cancelar

### 3. Auditoria e Rastreabilidade
- Logs de auditoria mantidos permanentemente (não sofrem soft delete)
- Registro de quem solicitou e quem executou cada operação
- Timestamp de todas as ações

## Arquitetura de Soft Delete

### Campos Adicionados em Todas as Tabelas

```prisma
deletedAt   DateTime?  // Data/hora da exclusão
deletedBy   String?    // ID do usuário que deletou
```

### Campos Específicos do Tenant

```prisma
dataRetentionDays Int? @default(365)  // Dias para manter dados
```

### Campos Específicos do User

```prisma
isAnonymized  Boolean   @default(false)
anonymizedAt  DateTime?
```

## Fluxo de Exclusão

```
┌─────────────────────────────────────────────────────────────────┐
│                       FLUXO DE EXCLUSÃO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SOLICITAÇÃO                                                 │
│     └─> POST /api/gdpr/delete                                   │
│         └─> Cria GdprRequest (status: PENDING)                  │
│         └─> Envia email de verificação                          │
│                                                                 │
│  2. VERIFICAÇÃO                                                 │
│     └─> Usuário clica no link/confirma token                    │
│         └─> Status: VERIFIED → PROCESSING                       │
│                                                                 │
│  3. SOFT DELETE (imediato)                                      │
│     └─> User.deletedAt = now()                                  │
│     └─> Accounts, Sessions, Memberships → soft deleted          │
│     └─> Usuário perde acesso mas dados são mantidos             │
│                                                                 │
│  4. ANONIMIZAÇÃO (após 30 dias)                                 │
│     └─> scripts/gdpr-cleanup.ts (cron diário)                   │
│     └─> email → deleted_xxx@anonymized.local                    │
│     └─> name → "Deleted User xxx"                               │
│     └─> isAnonymized = true                                     │
│                                                                 │
│  5. HARD DELETE (após 365 dias da anonimização)                 │
│     └─> scripts/gdpr-cleanup.ts (cron diário)                   │
│     └─> Remoção permanente de todos os dados                    │
│     └─> Audit logs mantidos (userId = null)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Política de Retenção

| Período | Ação | Dados Afetados |
|---------|------|----------------|
| Imediato | Soft Delete | User, Accounts, Sessions, Memberships |
| 30 dias | Anonimização | Dados pessoais substituídos por valores anônimos |
| 365 dias | Hard Delete | Remoção permanente de todos os registros |

### Configuração por Tenant

Cada tenant pode definir seu próprio período de retenção:

```typescript
// Padrão: 365 dias
await prisma.tenant.update({
  where: { id: tenantId },
  data: { dataRetentionDays: 180 } // 180 dias
})
```

## APIs Disponíveis

### Exportação de Dados

```bash
# Solicitar export (requer verificação)
POST /api/gdpr/export
Content-Type: application/json
{
  "tenantId": "optional-tenant-id"
}

# Export imediato (usuário autenticado)
POST /api/gdpr/export
Content-Type: application/json
{
  "immediate": true
}

# Status do export
GET /api/gdpr/export?requestId=xxx

# Download
GET /api/gdpr/export?requestId=xxx&download=true

# Verificar e processar
GET /api/gdpr/export?requestId=xxx&token=verification-token
```

### Exclusão de Dados

```bash
# Solicitar exclusão
POST /api/gdpr/delete
Content-Type: application/json
{
  "reason": "Motivo opcional",
  "confirmEmail": "user@email.com"
}

# Confirmar exclusão
POST /api/gdpr/delete
Content-Type: application/json
{
  "requestId": "xxx",
  "verificationToken": "token"
}

# Status da solicitação
GET /api/gdpr/delete?requestId=xxx

# Cancelar solicitação
DELETE /api/gdpr/delete?requestId=xxx
```

## Script de Cleanup (Cron)

O script `scripts/gdpr-cleanup.ts` deve ser executado diariamente:

```bash
# Crontab (3h da manhã)
0 3 * * * cd /path/to/baas-app && npx ts-node scripts/gdpr-cleanup.ts >> /var/log/gdpr-cleanup.log 2>&1
```

### Ações do Script

1. **Expira requests não verificados** (> 7 dias)
2. **Anonimiza usuários** soft-deleted há mais de 30 dias
3. **Hard delete** de usuários anonimizados há mais de 365 dias
4. **Limpa exports expirados** (links válidos por 7 dias)

## Middleware Prisma

O middleware de soft delete intercepta automaticamente operações:

```typescript
// DELETE → UPDATE com deletedAt
await prisma.user.delete({ where: { id } })
// Internamente: UPDATE SET deletedAt = NOW()

// findMany exclui deletados automaticamente
await prisma.user.findMany()
// Internamente: WHERE deletedAt IS NULL
```

### Consultar Registros Deletados

```typescript
import { prismaWithSoftDelete } from '@/lib/prisma-extensions'

// Incluir deletados
const allUsers = await prismaWithSoftDelete.$findWithDeleted('User', {
  where: { tenantId }
})

// Hard delete (usar com cuidado!)
await prismaWithSoftDelete.$hardDelete('User', { id })

// Restaurar
await prismaWithSoftDelete.$restore('User', { id })
```

## Formato do Export

```json
{
  "exportedAt": "2024-01-30T12:00:00.000Z",
  "exportVersion": "1.0.0",
  "user": {
    "profile": {
      "id": "...",
      "name": "...",
      "email": "...",
      "createdAt": "...",
      "..."
    },
    "accounts": [...],
    "sessions": [...],
    "memberships": [...],
    "auditLogs": [...],
    "gdprRequests": [...]
  },
  "tenants": [
    {
      "id": "...",
      "name": "...",
      "workspaces": [
        {
          "channels": [...],
          "personalities": [...],
          "features": [...]
        }
      ]
    }
  ],
  "metadata": {
    "requestId": "...",
    "dataCategories": [...],
    "legalBasis": "LGPD Art. 18 / GDPR Art. 15"
  }
}
```

## Logs de Auditoria

Ações registradas automaticamente:

| Ação | Descrição |
|------|-----------|
| `GDPR_DATA_EXPORT_REQUEST` | Solicitação de export |
| `GDPR_DATA_EXPORT_IMMEDIATE` | Export imediato |
| `GDPR_DATA_DELETION_REQUEST` | Solicitação de exclusão |
| `GDPR_DATA_DELETION_EXECUTED` | Exclusão executada |
| `GDPR_DATA_DELETION_CANCELLED` | Exclusão cancelada |
| `SOFT_DELETE_USER_DATA` | Soft delete de dados |
| `ANONYMIZE_USER` | Anonimização de usuário |
| `RESTORE_USER` | Restauração de usuário |
| `GDPR_CLEANUP_RUN` | Execução do cron de cleanup |

## Segurança

- **Rate Limiting**: 3 requests de export por hora por usuário
- **Verificação em 2 passos**: Todas as ações críticas requerem confirmação
- **Cooldown**: 30 segundos entre confirmações de exclusão
- **Tokens únicos**: Cada request tem um token de verificação único
- **Expiração**: Requests não verificados expiram em 7 dias

## Migração

Após atualizar o schema, execute:

```bash
# Gerar migração
npx prisma migrate dev --name add_lgpd_compliance

# Aplicar em produção
npx prisma migrate deploy
```

## Considerações de Performance

- Índices em `deletedAt` para todas as tabelas
- Soft delete não afeta performance de escrita
- Queries automaticamente filtram deletados (índice parcial recomendado)

### Índice Parcial Recomendado (PostgreSQL)

```sql
CREATE INDEX CONCURRENTLY idx_users_active 
ON "User" (email) 
WHERE "deletedAt" IS NULL;
```

## Suporte

Para dúvidas sobre compliance ou implementação, consulte:
- [LGPD - Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [GDPR - Regulation (EU) 2016/679](https://gdpr-info.eu/)
