# Admin Agent - Cron Service

## Setup

Instale a dependência necessária:

```bash
npm install node-cron
npm install -D @types/node-cron
```

## Arquivos Criados

1. **`src/lib/admin-agent/cron.ts`** - Serviço de cron job
2. **`src/app/api/admin/cron/route.ts`** - API REST para controle

## Uso da API

### Verificar status
```bash
GET /api/admin/cron
```

### Iniciar scheduler
```bash
POST /api/admin/cron
{ "action": "start" }

# Com schedule customizado (padrão: */5 * * * *)
POST /api/admin/cron
{ "action": "start", "schedule": "*/10 * * * *" }
```

### Parar scheduler
```bash
POST /api/admin/cron
{ "action": "stop" }
```

### Executar manualmente
```bash
POST /api/admin/cron
{ "action": "run" }
```

## Inicialização Automática

Para iniciar o cron automaticamente com a aplicação, adicione em `src/app/layout.tsx` ou crie um arquivo de inicialização:

```typescript
// src/lib/admin-agent/init.ts
import { startCron } from './cron'

// Só inicia em produção e no servidor
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  startCron()
}
```

## Configuração

O cron roda a cada 5 minutos (`*/5 * * * *`) por padrão.

Só processa tenants com:
- `AdminAgent.status = 'ACTIVE'`
- `AdminAgent.healthCheckEnabled = true`
- `Tenant.status = 'ACTIVE'`
- `Tenant.deletedAt = null`

## Logs

Os logs aparecem no console com prefixo `[Cron]`:

```
[Cron] Starting health check for 3 tenants
[Cron] Tenant acme-corp: H=5 D=1 U=0 X=0 (234ms)
[Cron] Tenant beta-inc: H=3 D=0 U=0 X=0 (156ms)
[Cron] Completed health check cycle in 412ms
```
