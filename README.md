# BaaS Dashboard

[![API Docs](https://img.shields.io/badge/API%20Docs-OpenAPI%203.1-6366f1?style=flat-square&logo=swagger)](./public/openapi.json)
[![API Reference](https://img.shields.io/badge/API%20Reference-Interactive-10b981?style=flat-square&logo=bookstack)](http://localhost:3000/api/docs/ui)

Bot as a Service - Management Dashboard

## 🔒 LGPD/GDPR Compliance

Este projeto implementa compliance total com LGPD (Lei Geral de Proteção de Dados) e GDPR:

- **Soft Delete**: Todas as exclusões são lógicas (reversíveis)
- **Export de Dados**: Usuários podem exportar todos seus dados
- **Direito ao Esquecimento**: Anonimização após período de retenção
- **Auditoria Completa**: Logs de todas as operações

📚 **Documentação completa**: [docs/LGPD-COMPLIANCE.md](./docs/LGPD-COMPLIANCE.md)

### APIs de Privacidade

```bash
# Exportar dados
POST /api/gdpr/export

# Solicitar exclusão  
POST /api/gdpr/delete

# Cron de cleanup (diário)
npx ts-node scripts/gdpr-cleanup.ts
```

## Features

- **Overview Page**: Stats cards with sparklines, activity chart, recent activity feed, quick actions
- **Channels Page**: List/Grid view toggle, filters, add channel modal
- **Channel Details**: Tabs for Overview, Config, History, Memory with inline editing
- **Behavior Page**: Template picker, personality sliders, system prompt editor, sandbox preview

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Data Fetching**: SWR
- **Charts**: Recharts
- **Animations**: Framer Motion
- **UI Primitives**: Radix UI

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx          # Overview
│   │   ├── channels/
│   │   │   ├── page.tsx      # Channels list
│   │   │   └── [id]/page.tsx # Channel details
│   │   ├── behavior/page.tsx  # Bot personality
│   │   └── settings/page.tsx  # Settings
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── ui/
│       ├── sparkline.tsx
│       ├── stat-card.tsx
│       ├── slider.tsx
│       ├── modal.tsx
│       └── tabs.tsx
├── hooks/
│   ├── use-channels.ts
│   ├── use-analytics.ts
│   └── use-personality.ts
├── lib/
│   ├── utils.ts
│   └── api.ts
└── types/
    └── index.ts
```

## API Documentation

The BaaS Dashboard provides a complete REST API documented with OpenAPI 3.1 specification.

### Interactive Documentation

Once the development server is running, access the interactive API docs at:

- **Scalar UI**: [http://localhost:3000/api/docs/ui](http://localhost:3000/api/docs/ui)
- **Swagger UI**: [http://localhost:3000/api/docs/ui?ui=swagger](http://localhost:3000/api/docs/ui?ui=swagger)
- **OpenAPI JSON**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### Generate Static OpenAPI Spec

```bash
# Generate openapi.json in public folder
npm run openapi:generate

# Validate the spec
npm run openapi:validate
```

### API Endpoints

| Tag | Endpoints | Description |
|-----|-----------|-------------|
| **Tenants** | `/api/tenants` | Organization management |
| **Workspaces** | `/api/workspaces/**` | Workspace CRUD operations |
| **Channels** | `/api/channels/**` | Channel management (WhatsApp, Telegram, etc.) |
| **Personalities** | `/api/personalities/**` | Bot personality templates |
| **Specialists** | `/api/specialists/**` | AI specialist agents |
| **Features** | `/api/features` | Feature flags management |
| **Billing** | `/api/billing` | Billing and usage limits |
| **Analytics** | `/api/analytics/**` | Usage analytics and reports |
| **Clawdbot** | `/api/clawdbot/**` | WhatsApp Gateway integration |

### SDK Generation

Generate a TypeScript SDK from the OpenAPI spec:

```bash
# Using openapi-generator
npx @openapitools/openapi-generator-cli generate \
  -i public/openapi.json \
  -g typescript-fetch \
  -o sdk/typescript

# Using orval (recommended for React)
npx orval --input public/openapi.json --output src/lib/api-client
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=/api
```

## Clawdbot Webhook Integration

The BaaS Dashboard receives real-time events from Clawdbot Gateway via webhooks. These webhooks are secured using HMAC-SHA256 signature verification.

### Setup

1. **Generate a Webhook Secret**

   ```bash
   ./scripts/generate-webhook-secret.sh
   ```

   This will output a secure random secret. Add it to your `.env` file:

   ```env
   CLAWDBOT_WEBHOOK_SECRET="your-generated-secret-here"
   ```

2. **Configure Clawdbot Gateway**

   Add the webhook configuration to your Clawdbot Gateway config (`~/.config/clawdbot/config.yaml`):

   ```yaml
   webhooks:
     - url: https://your-baas-dashboard.com/api/clawdbot/webhook
       secret: your-generated-secret-here
       events:
         - message.received
         - message.sent
         - group.joined
         - group.left
         - status.change
         - agent.response
   ```

3. **Optional: IP Allowlisting**

   For additional security, you can restrict webhooks to known Clawdbot Gateway IPs:

   ```env
   CLAWDBOT_ALLOWED_IPS="1.2.3.4,5.6.7.8"
   CLAWDBOT_STRICT_IP_VALIDATION="true"
   ```

### Security Features

- **Signature Verification**: All webhook requests are verified using HMAC-SHA256 signatures
- **Replay Protection**: Timestamps are validated (max 5 minutes old) to prevent replay attacks
- **Timing-Safe Comparison**: Signature comparison uses constant-time algorithms to prevent timing attacks
- **IP Validation**: Optional source IP verification for additional security

### Webhook Events

| Event | Description |
|-------|-------------|
| `message.received` | Incoming message in a monitored channel |
| `message.sent` | Outgoing message (bot response) |
| `group.joined` | Bot joined a new group/channel |
| `group.left` | Bot left or was removed from a group |
| `status.change` | Connection status changed (online/offline) |
| `agent.response` | AI agent completed processing |

### Webhook Payload Format

```typescript
interface WebhookPayload {
  timestamp: number;      // Unix timestamp (ms)
  event: string;          // Event type
  data: WebhookEvent;     // Event-specific data
  nonce?: string;         // Optional replay protection
  source?: {
    gatewayId?: string;
    version?: string;
  };
}
```

### Headers

| Header | Description |
|--------|-------------|
| `x-clawdbot-signature` | HMAC-SHA256 signature (`sha256=<hex>`) |
| `x-clawdbot-timestamp` | Unix timestamp (fallback) |
| `x-organization-id` | Organization ID (multi-tenant) |
| `x-webhook-secret` | Per-org secret (multi-tenant) |

### Testing Webhooks

You can test webhook signature generation using the included utility:

```typescript
import { createWebhookSignature } from '@/lib/clawdbot/webhook-security';

const payload = JSON.stringify({ event: 'test', timestamp: Date.now() });
const signature = createWebhookSignature(payload, 'your-secret');

// Use this signature in x-clawdbot-signature header
```
