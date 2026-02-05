# Security & Compliance - Bot-as-a-Service

> Versão: 1.0  
> Data: Janeiro 2025  
> Status: Draft  
> Classificação: Interno/Confidencial

---

## Sumário

1. [Arquitetura de Segurança](#1-arquitetura-de-segurança)
2. [Multi-Tenancy Security](#2-multi-tenancy-security)
3. [Autenticação & Autorização](#3-autenticação--autorização)
4. [LGPD Compliance](#4-lgpd-compliance)
5. [Audit & Logging](#5-audit--logging)
6. [Incident Response](#6-incident-response)
7. [Roadmap para Certificações](#7-roadmap-para-certificações)
8. [Checklist de Segurança](#8-checklist-de-segurança)

---

## 1. Arquitetura de Segurança

### 1.1 Diagrama de Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/TLS 1.3
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER (Cloudflare)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  WAF Rules  │  │  DDoS Prot  │  │   Rate      │  │   Bot       │         │
│  │             │  │             │  │   Limiting  │  │   Detection │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ TLS (internal)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        LOAD BALANCER                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                    │                              │                          │
│                    ▼                              ▼                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│  │     API GATEWAY             │  │     DASHBOARD (Next.js)     │           │
│  │  ┌────────────────────┐     │  │  ┌────────────────────┐     │           │
│  │  │ Auth Middleware    │     │  │  │ Next-Auth Session  │     │           │
│  │  │ Rate Limit/Tenant  │     │  │  │ CSRF Protection    │     │           │
│  │  │ Request Validation │     │  │  │ CSP Headers        │     │           │
│  │  └────────────────────┘     │  │  └────────────────────┘     │           │
│  └─────────────────────────────┘  └─────────────────────────────┘           │
│                    │                              │                          │
└────────────────────┼──────────────────────────────┼──────────────────────────┘
                     │                              │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│  │     SUPABASE                │  │     REDIS                   │           │
│  │  ┌────────────────────┐     │  │  ┌────────────────────┐     │           │
│  │  │ PostgreSQL         │     │  │  │ Session Cache      │     │           │
│  │  │ Row Level Security │     │  │  │ Rate Limit Counters│     │           │
│  │  │ Encrypted at Rest  │     │  │  │ TLS in Transit     │     │           │
│  │  │ Connection Pooling │     │  │  │ Encrypted (option) │     │           │
│  │  └────────────────────┘     │  │  └────────────────────┘     │           │
│  └─────────────────────────────┘  └─────────────────────────────┘           │
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│  │     BLOB STORAGE            │  │     SECRETS MANAGER         │           │
│  │  ┌────────────────────┐     │  │  ┌────────────────────┐     │           │
│  │  │ S3/R2              │     │  │  │ Vault / AWS SM     │     │           │
│  │  │ Server-Side Enc    │     │  │  │ API Keys           │     │           │
│  │  │ Pre-signed URLs    │     │  │  │ OAuth Tokens       │     │           │
│  │  │ Lifecycle Policies │     │  │  │ Encryption Keys    │     │           │
│  │  └────────────────────┘     │  │  └────────────────────┘     │           │
│  └─────────────────────────────┘  └─────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTEGRATIONS                                │
│                                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ WhatsApp │  │ Telegram │  │ OpenAI   │  │ Anthropic│  │ Webhooks │       │
│  │   API    │  │   API    │  │   API    │  │   API    │  │ (Custom) │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       │              │             │             │             │             │
│       └──────────────┴─────────────┴─────────────┴─────────────┘             │
│                                    │                                         │
│                           mTLS / API Keys                                    │
│                           IP Allowlisting                                    │
│                           Request Signing                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Pontos de Encriptação

#### Em Trânsito (Encryption in Transit)

| Conexão | Protocolo | Cipher Suite | Certificado |
|---------|-----------|--------------|-------------|
| Cliente → Edge | TLS 1.3 | CHACHA20-POLY1305 / AES-256-GCM | Let's Encrypt / Cloudflare |
| Edge → API | TLS 1.2+ | AES-256-GCM | Internal CA |
| API → Database | TLS 1.2+ | AES-256-GCM | Supabase Managed |
| API → Redis | TLS 1.2+ | AES-256-GCM | Provider Managed |
| API → External APIs | TLS 1.3 | Provider Dependent | Provider Managed |

**Configuração mínima TLS:**
```nginx
# Nginx/Edge config
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_stapling on;
ssl_stapling_verify on;
```

#### Em Repouso (Encryption at Rest)

| Dado | Local | Algoritmo | Key Management |
|------|-------|-----------|----------------|
| Banco de Dados | Supabase/AWS | AES-256 | Provider KMS |
| Blobs/Arquivos | S3/R2 | AES-256-GCM | SSE-S3/SSE-KMS |
| Backups | S3 | AES-256-GCM | Customer Managed Key |
| Logs | CloudWatch/S3 | AES-256 | Provider KMS |
| Secrets | Vault/SM | AES-256-GCM | HSM-backed |

**Campos com criptografia adicional (application-level):**
```typescript
// Campos sensíveis com encriptação no nível da aplicação
const ENCRYPTED_FIELDS = [
  'api_tokens',           // Tokens de API de clientes
  'webhook_secrets',      // Secrets de webhooks
  'oauth_refresh_tokens', // Tokens OAuth
  'pii_custom_fields',    // Campos PII customizados
];

// Implementação usando libsodium
import { secretbox, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

function encrypt(plaintext: string, key: Uint8Array): string {
  const nonce = randomBytes(secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(plaintext);
  const box = secretbox(messageUint8, nonce, key);
  
  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);
  
  return encodeBase64(fullMessage);
}
```

### 1.3 Gerenciamento de Secrets

#### Hierarquia de Secrets

```
┌─────────────────────────────────────────────────────────────┐
│                    SECRETS HIERARCHY                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Level 1: Infrastructure (Terraform/IaC)                     │
│  ├── DATABASE_URL                                            │
│  ├── REDIS_URL                                               │
│  ├── AWS_ACCESS_KEY                                          │
│  └── CLOUDFLARE_API_TOKEN                                    │
│                                                              │
│  Level 2: Application (Runtime)                              │
│  ├── SUPABASE_SERVICE_KEY                                    │
│  ├── JWT_SECRET                                              │
│  ├── ENCRYPTION_KEY                                          │
│  └── SESSION_SECRET                                          │
│                                                              │
│  Level 3: Integration (Per-Service)                          │
│  ├── OPENAI_API_KEY                                          │
│  ├── ANTHROPIC_API_KEY                                       │
│  ├── WHATSAPP_TOKEN                                          │
│  └── TELEGRAM_BOT_TOKEN                                      │
│                                                              │
│  Level 4: Tenant (Per-Customer)                              │
│  ├── tenant.api_key                                          │
│  ├── tenant.webhook_secret                                   │
│  ├── tenant.oauth_tokens                                     │
│  └── tenant.custom_llm_key                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Políticas de Secret Management

```yaml
# secrets-policy.yaml
policies:
  rotation:
    infrastructure_secrets:
      frequency: 90_days
      automated: true
      notification: 14_days_before
    
    application_secrets:
      frequency: 30_days
      automated: true
      zero_downtime: true
    
    tenant_secrets:
      frequency: on_demand
      automated: false
      user_triggered: true

  access:
    principle: least_privilege
    audit: all_access_logged
    human_access: break_glass_only
    
  storage:
    primary: hashicorp_vault  # ou AWS Secrets Manager
    backup: encrypted_s3
    never_in:
      - git_repository
      - environment_files
      - logs
      - error_messages
```

#### Implementação no Código

```typescript
// lib/secrets.ts
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

class SecretManager {
  private cache = new Map<string, { value: string; expiry: number }>();
  private client: SecretsManager;
  
  constructor() {
    this.client = new SecretsManager({
      region: process.env.AWS_REGION,
    });
  }
  
  async getSecret(name: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    // Fetch from Secrets Manager
    const response = await this.client.getSecretValue({
      SecretId: name,
    });
    
    const value = response.SecretString!;
    
    // Cache for 5 minutes
    this.cache.set(name, {
      value,
      expiry: Date.now() + 5 * 60 * 1000,
    });
    
    return value;
  }
  
  // Tenant-specific secrets (stored encrypted in DB)
  async getTenantSecret(tenantId: string, key: string): Promise<string> {
    const encryptedValue = await db
      .selectFrom('tenant_secrets')
      .where('tenant_id', '=', tenantId)
      .where('key', '=', key)
      .select('encrypted_value')
      .executeTakeFirst();
    
    if (!encryptedValue) {
      throw new Error('Secret not found');
    }
    
    const masterKey = await this.getSecret('TENANT_ENCRYPTION_KEY');
    return decrypt(encryptedValue.encrypted_value, masterKey);
  }
}

export const secrets = new SecretManager();
```

---

## 2. Multi-Tenancy Security

### 2.1 Row Level Security (RLS) - Implementação

#### Estrutura de Tenant Isolation

```sql
-- ============================================
-- MULTI-TENANCY SECURITY SCHEMA
-- ============================================

-- 1. Tabela de Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Membros da Organização
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    permissions JSONB DEFAULT '[]',
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(organization_id, user_id)
);

-- 3. Index para performance de RLS
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- ============================================
-- FUNÇÕES DE SEGURANÇA
-- ============================================

-- Função para obter o tenant atual do JWT
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
        NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para verificar se usuário pertence ao tenant
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = tenant_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para obter role do usuário no tenant
CREATE OR REPLACE FUNCTION user_role_in_tenant(tenant_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM organization_members
        WHERE organization_id = tenant_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- TABELAS COM RLS
-- ============================================

-- Bots (recurso principal)
CREATE TABLE bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT,
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    settings JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft', -- draft, active, paused, archived
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

-- RLS Policies para Bots
CREATE POLICY "Users can view bots in their organizations"
ON bots FOR SELECT
USING (user_belongs_to_tenant(organization_id));

CREATE POLICY "Admins can create bots"
ON bots FOR INSERT
WITH CHECK (
    user_belongs_to_tenant(organization_id)
    AND user_role_in_tenant(organization_id) IN ('owner', 'admin')
);

CREATE POLICY "Admins can update bots"
ON bots FOR UPDATE
USING (
    user_belongs_to_tenant(organization_id)
    AND user_role_in_tenant(organization_id) IN ('owner', 'admin')
);

CREATE POLICY "Only owners can delete bots"
ON bots FOR DELETE
USING (
    user_belongs_to_tenant(organization_id)
    AND user_role_in_tenant(organization_id) = 'owner'
);

-- Conversations (dados sensíveis)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- whatsapp, telegram, web
    external_id TEXT, -- ID externo do canal
    contact_info JSONB, -- Informações do contato (PII - encriptado)
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations in their org"
ON conversations FOR SELECT
USING (user_belongs_to_tenant(organization_id));

-- Messages (alto volume)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    content_encrypted BYTEA, -- Versão encriptada para PII
    tokens_used INTEGER,
    cost_cents INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition por organization_id para melhor isolamento e performance
CREATE INDEX idx_messages_org_conv ON messages(organization_id, conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their org"
ON messages FOR SELECT
USING (user_belongs_to_tenant(organization_id));

-- API Keys (secrets de tenant)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- SHA-256 do key (nunca armazena plain)
    key_prefix TEXT NOT NULL, -- Primeiros 8 chars para identificação
    permissions JSONB DEFAULT '["*"]',
    rate_limit INTEGER DEFAULT 1000, -- requests per minute
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage API keys"
ON api_keys FOR ALL
USING (
    user_belongs_to_tenant(organization_id)
    AND user_role_in_tenant(organization_id) IN ('owner', 'admin')
);

-- ============================================
-- SERVICE ROLE BYPASS (para background jobs)
-- ============================================

-- Funções que rodam como service role precisam bypass explícito
-- NUNCA expor service role para requests de usuário

CREATE OR REPLACE FUNCTION process_message_internal(
    p_org_id UUID,
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS UUID
SECURITY DEFINER -- Roda com permissões do owner da função
SET search_path = public
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    -- Validações internas
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
        RAISE EXCEPTION 'Invalid organization';
    END IF;
    
    INSERT INTO messages (organization_id, conversation_id, role, content)
    VALUES (p_org_id, p_conversation_id, 'assistant', p_content)
    RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Isolamento de Dados

#### Níveis de Isolamento

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA ISOLATION LAYERS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Database Level                                     │
│  ├── Row Level Security (RLS) - ALWAYS ON                   │
│  ├── Separate schemas per tenant (enterprise option)         │
│  └── Connection pooling per tenant (if needed)               │
│                                                              │
│  Layer 2: Application Level                                  │
│  ├── Tenant context in every request                         │
│  ├── Middleware validation                                   │
│  └── Query builders with automatic tenant filter             │
│                                                              │
│  Layer 3: API Level                                          │
│  ├── API keys scoped to tenant                               │
│  ├── JWT claims include tenant_id                            │
│  └── Rate limiting per tenant                                │
│                                                              │
│  Layer 4: Storage Level                                      │
│  ├── S3 prefixes: /{tenant_id}/...                          │
│  ├── Signed URLs with tenant validation                      │
│  └── Separate buckets for enterprise                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Implementação de Tenant Context

```typescript
// middleware/tenant-context.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
}

export async function withTenantContext(
  request: NextRequest,
  handler: (ctx: TenantContext) => Promise<NextResponse>
): Promise<NextResponse> {
  // Extract tenant from subdomain or header
  const tenantSlug = extractTenantSlug(request);
  
  // Verify JWT and extract claims
  const supabase = createServerClient(/* config */);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Verify user belongs to tenant
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role, permissions')
    .eq('user_id', user.id)
    .eq('organizations.slug', tenantSlug)
    .single();
  
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Set tenant context in Supabase session
  await supabase.rpc('set_tenant_context', {
    tenant_id: membership.organization_id
  });
  
  return handler({
    tenantId: membership.organization_id,
    userId: user.id,
    role: membership.role,
    permissions: membership.permissions,
  });
}

// Query builder with automatic tenant filter
class TenantScopedQuery<T> {
  constructor(
    private supabase: SupabaseClient,
    private table: string,
    private tenantId: string
  ) {}
  
  select(columns: string = '*') {
    return this.supabase
      .from(this.table)
      .select(columns)
      .eq('organization_id', this.tenantId); // Always filtered
  }
  
  insert(data: Partial<T>) {
    return this.supabase
      .from(this.table)
      .insert({
        ...data,
        organization_id: this.tenantId, // Always set
      });
  }
}
```

### 2.3 Cross-Tenant Protection

#### Prevenção de Vazamento de Dados

```typescript
// security/cross-tenant-protection.ts

// 1. Validação em todas as operações de leitura
async function validateTenantAccess(
  resourceId: string,
  resourceType: string,
  tenantId: string
): Promise<boolean> {
  const resource = await db
    .selectFrom(resourceType)
    .where('id', '=', resourceId)
    .select('organization_id')
    .executeTakeFirst();
  
  if (!resource) {
    throw new NotFoundError(`${resourceType} not found`);
  }
  
  if (resource.organization_id !== tenantId) {
    // Log tentativa de acesso cross-tenant
    await auditLog.critical({
      event: 'CROSS_TENANT_ACCESS_ATTEMPT',
      tenantId,
      targetTenantId: resource.organization_id,
      resourceType,
      resourceId,
      timestamp: new Date(),
    });
    
    // Retorna 404 (não 403) para não vazar existência
    throw new NotFoundError(`${resourceType} not found`);
  }
  
  return true;
}

// 2. Sanitização de respostas
function sanitizeResponse<T extends { organization_id?: string }>(
  data: T,
  allowedTenantId: string
): Omit<T, 'organization_id'> | null {
  if (data.organization_id && data.organization_id !== allowedTenantId) {
    return null; // Silently filter out
  }
  
  const { organization_id, ...safe } = data;
  return safe;
}

// 3. Proteção em bulk operations
async function bulkOperation(
  ids: string[],
  tenantId: string,
  operation: (ids: string[]) => Promise<void>
): Promise<{ success: string[]; denied: string[] }> {
  // Verify all IDs belong to tenant BEFORE operation
  const resources = await db
    .selectFrom('resources')
    .where('id', 'in', ids)
    .select(['id', 'organization_id'])
    .execute();
  
  const allowed = resources
    .filter(r => r.organization_id === tenantId)
    .map(r => r.id);
  
  const denied = ids.filter(id => !allowed.includes(id));
  
  if (denied.length > 0) {
    await auditLog.warn({
      event: 'BULK_CROSS_TENANT_ATTEMPT',
      tenantId,
      deniedIds: denied,
    });
  }
  
  if (allowed.length > 0) {
    await operation(allowed);
  }
  
  return { success: allowed, denied };
}

// 4. Proteção de webhooks
async function validateWebhookTarget(
  url: string,
  tenantId: string
): Promise<boolean> {
  // Prevent SSRF
  const parsed = new URL(url);
  
  // Block internal IPs
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /metadata\.google/i,
    /169\.254\.169\.254/,
  ];
  
  if (blockedPatterns.some(p => p.test(parsed.hostname))) {
    throw new SecurityError('Invalid webhook URL');
  }
  
  return true;
}
```

#### Testes de Segurança Multi-Tenant

```typescript
// tests/security/cross-tenant.test.ts
describe('Cross-Tenant Security', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  
  beforeAll(async () => {
    tenantA = await createTestTenant('tenant-a');
    tenantB = await createTestTenant('tenant-b');
  });
  
  test('User from Tenant A cannot access Tenant B resources', async () => {
    // Create resource in Tenant B
    const resource = await createBotInTenant(tenantB);
    
    // Try to access from Tenant A
    const response = await api
      .asUser(tenantA.user)
      .get(`/bots/${resource.id}`);
    
    expect(response.status).toBe(404); // Not 403!
  });
  
  test('Bulk operations filter cross-tenant IDs', async () => {
    const botA = await createBotInTenant(tenantA);
    const botB = await createBotInTenant(tenantB);
    
    const response = await api
      .asUser(tenantA.user)
      .post('/bots/bulk-delete', {
        ids: [botA.id, botB.id]
      });
    
    expect(response.body.deleted).toContain(botA.id);
    expect(response.body.deleted).not.toContain(botB.id);
    
    // Verify botB still exists
    const botBExists = await db.bots.findById(botB.id);
    expect(botBExists).toBeTruthy();
  });
  
  test('RLS prevents direct DB access cross-tenant', async () => {
    const botB = await createBotInTenant(tenantB);
    
    // Direct query with Tenant A context
    const result = await supabase
      .from('bots')
      .select('*')
      .eq('id', botB.id)
      .single();
    
    // RLS should filter it out
    expect(result.data).toBeNull();
  });
});
```

---

## 3. Autenticação & Autorização

### 3.1 Magic Link Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAGIC LINK AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

     User                    Frontend                  Backend                  Email Service
       │                        │                        │                           │
       │  1. Enter email        │                        │                           │
       │───────────────────────>│                        │                           │
       │                        │  2. POST /auth/magic   │                           │
       │                        │───────────────────────>│                           │
       │                        │                        │  3. Generate token        │
       │                        │                        │     (32 bytes random)     │
       │                        │                        │                           │
       │                        │                        │  4. Store in DB:          │
       │                        │                        │     - token_hash (SHA256) │
       │                        │                        │     - email               │
       │                        │                        │     - expires_at (15min)  │
       │                        │                        │     - ip_address          │
       │                        │                        │     - user_agent          │
       │                        │                        │                           │
       │                        │                        │  5. Send email            │
       │                        │                        │───────────────────────────>│
       │                        │                        │                           │
       │                        │  6. { success: true }  │                           │
       │                        │<───────────────────────│                           │
       │  7. "Check your email" │                        │                           │
       │<───────────────────────│                        │                           │
       │                        │                        │                           │
       │  8. Click link in email│                        │                           │
       │<──────────────────────────────────────────────────────────────────────────────
       │                        │                        │                           │
       │  9. GET /auth/verify?token=xxx                  │                           │
       │────────────────────────────────────────────────>│                           │
       │                        │                        │  10. Validate:            │
       │                        │                        │      - Token exists       │
       │                        │                        │      - Not expired        │
       │                        │                        │      - Not used           │
       │                        │                        │      - Same IP (optional) │
       │                        │                        │                           │
       │                        │                        │  11. Create session       │
       │                        │                        │      - JWT (15min access) │
       │                        │                        │      - Refresh (7 days)   │
       │                        │                        │                           │
       │                        │                        │  12. Mark token used      │
       │                        │                        │                           │
       │  13. Set cookies + redirect                     │                           │
       │<────────────────────────────────────────────────│                           │
       │                        │                        │                           │
```

#### Implementação

```typescript
// auth/magic-link.ts
import { createHash, randomBytes } from 'crypto';

interface MagicLinkToken {
  id: string;
  email: string;
  token_hash: string;
  expires_at: Date;
  ip_address: string;
  user_agent: string;
  used_at: Date | null;
  created_at: Date;
}

export async function generateMagicLink(
  email: string,
  request: Request
): Promise<{ success: boolean }> {
  // Rate limit: max 3 requests per email per hour
  const recentAttempts = await db
    .selectFrom('magic_link_tokens')
    .where('email', '=', email.toLowerCase())
    .where('created_at', '>', new Date(Date.now() - 60 * 60 * 1000))
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();
  
  if (recentAttempts && recentAttempts.count >= 3) {
    // Return success anyway to prevent email enumeration
    return { success: true };
  }
  
  // Generate secure token
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  
  // Store token
  await db.insertInto('magic_link_tokens').values({
    email: email.toLowerCase(),
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    ip_address: getClientIP(request),
    user_agent: request.headers.get('user-agent') || 'unknown',
  }).execute();
  
  // Send email (async, don't wait)
  sendMagicLinkEmail(email, token).catch(console.error);
  
  return { success: true };
}

export async function verifyMagicLink(
  token: string,
  request: Request
): Promise<{ session: Session } | { error: string }> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  
  // Find and validate token
  const magicLink = await db
    .selectFrom('magic_link_tokens')
    .where('token_hash', '=', tokenHash)
    .where('used_at', 'is', null)
    .where('expires_at', '>', new Date())
    .selectAll()
    .executeTakeFirst();
  
  if (!magicLink) {
    // Log failed attempt
    await auditLog.warn({
      event: 'MAGIC_LINK_INVALID',
      ip: getClientIP(request),
    });
    return { error: 'Invalid or expired link' };
  }
  
  // Optional: verify same IP
  // if (magicLink.ip_address !== getClientIP(request)) {
  //   return { error: 'Please use the same device' };
  // }
  
  // Mark as used (atomic operation)
  const updated = await db
    .updateTable('magic_link_tokens')
    .set({ used_at: new Date() })
    .where('id', '=', magicLink.id)
    .where('used_at', 'is', null) // Prevent race condition
    .returning('id')
    .executeTakeFirst();
  
  if (!updated) {
    return { error: 'Link already used' };
  }
  
  // Find or create user
  let user = await db
    .selectFrom('users')
    .where('email', '=', magicLink.email)
    .selectAll()
    .executeTakeFirst();
  
  if (!user) {
    user = await db
      .insertInto('users')
      .values({
        email: magicLink.email,
        email_verified_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst();
  }
  
  // Create session
  const session = await createSession(user!);
  
  await auditLog.info({
    event: 'USER_LOGIN',
    userId: user!.id,
    method: 'magic_link',
    ip: getClientIP(request),
  });
  
  return { session };
}
```

### 3.2 SSO/SAML (Enterprise)

#### Especificação para Enterprise SSO

```yaml
# sso-specification.yaml
saml:
  version: "2.0"
  binding: "HTTP-POST"
  
  service_provider:
    entity_id: "https://app.botservice.com/saml/metadata"
    acs_url: "https://app.botservice.com/saml/acs"
    slo_url: "https://app.botservice.com/saml/slo"
    
  required_attributes:
    - name: "email"
      format: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      required: true
    
    - name: "firstName"
      format: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      required: false
    
    - name: "lastName"
      format: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      required: false
    
    - name: "groups"
      format: "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      required: false
      description: "For automatic role mapping"

  supported_idps:
    - okta
    - azure_ad
    - google_workspace
    - onelogin
    - custom

oidc:
  supported: true
  flows:
    - authorization_code
    - authorization_code_with_pkce
  
  required_scopes:
    - openid
    - email
    - profile
  
  endpoints:
    authorization: "https://app.botservice.com/oauth/authorize"
    token: "https://app.botservice.com/oauth/token"
    userinfo: "https://app.botservice.com/oauth/userinfo"
```

#### Configuração por Tenant

```typescript
// types/sso.ts
interface SSOConfiguration {
  id: string;
  organization_id: string;
  provider: 'saml' | 'oidc';
  enabled: boolean;
  
  // SAML config
  saml?: {
    idp_entity_id: string;
    idp_sso_url: string;
    idp_certificate: string; // X.509 certificate
    attribute_mapping: {
      email: string;
      firstName?: string;
      lastName?: string;
      groups?: string;
    };
    role_mapping?: {
      [idpGroup: string]: 'owner' | 'admin' | 'member' | 'viewer';
    };
  };
  
  // OIDC config
  oidc?: {
    client_id: string;
    client_secret_encrypted: string;
    issuer_url: string;
    authorization_url?: string;
    token_url?: string;
    userinfo_url?: string;
  };
  
  // Enforcement
  enforce_sso: boolean; // Block magic link for this domain
  allowed_domains: string[]; // Only allow emails from these domains
  auto_provision: boolean; // Auto-create users on first login
  
  created_at: Date;
  updated_at: Date;
}
```

### 3.3 RBAC Detalhado

#### Modelo de Roles e Permissions

```typescript
// types/rbac.ts

// Roles hierárquicos
type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'api_only';

// Recursos do sistema
type Resource = 
  | 'organization'
  | 'billing'
  | 'members'
  | 'bots'
  | 'conversations'
  | 'analytics'
  | 'integrations'
  | 'api_keys'
  | 'webhooks'
  | 'audit_logs';

// Ações possíveis
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

// Scopes para granularidade
type Scope = 
  | '*'           // Todos os recursos
  | 'own'         // Apenas próprios recursos
  | 'team'        // Recursos do time
  | 'bot:{id}'    // Bot específico
  | 'channel:{name}'; // Canal específico

// Estrutura de permissão
interface Permission {
  resource: Resource;
  action: Action;
  scope: Scope;
}

// Definição de roles
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    { resource: '*', action: '*', scope: '*' }, // Full access
  ],
  
  admin: [
    { resource: 'organization', action: 'read', scope: '*' },
    { resource: 'organization', action: 'update', scope: '*' },
    { resource: 'billing', action: 'read', scope: '*' },
    { resource: 'members', action: 'manage', scope: '*' },
    { resource: 'bots', action: '*', scope: '*' },
    { resource: 'conversations', action: '*', scope: '*' },
    { resource: 'analytics', action: 'read', scope: '*' },
    { resource: 'integrations', action: '*', scope: '*' },
    { resource: 'api_keys', action: '*', scope: '*' },
    { resource: 'webhooks', action: '*', scope: '*' },
    { resource: 'audit_logs', action: 'read', scope: '*' },
  ],
  
  member: [
    { resource: 'organization', action: 'read', scope: '*' },
    { resource: 'members', action: 'read', scope: '*' },
    { resource: 'bots', action: 'read', scope: '*' },
    { resource: 'bots', action: 'create', scope: 'own' },
    { resource: 'bots', action: 'update', scope: 'own' },
    { resource: 'conversations', action: 'read', scope: '*' },
    { resource: 'analytics', action: 'read', scope: '*' },
  ],
  
  viewer: [
    { resource: 'organization', action: 'read', scope: '*' },
    { resource: 'bots', action: 'read', scope: '*' },
    { resource: 'conversations', action: 'read', scope: '*' },
    { resource: 'analytics', action: 'read', scope: '*' },
  ],
  
  api_only: [
    { resource: 'bots', action: 'read', scope: '*' },
    { resource: 'conversations', action: '*', scope: '*' },
  ],
};
```

#### Middleware de Autorização

```typescript
// middleware/authorize.ts
import { Permission, Role, ROLE_PERMISSIONS } from '@/types/rbac';

interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  customPermissions?: Permission[];
}

export function authorize(
  required: Permission | Permission[]
) {
  return async (ctx: AuthContext, next: () => Promise<void>) => {
    const requiredPermissions = Array.isArray(required) ? required : [required];
    
    // Get all permissions for this role
    const rolePermissions = ROLE_PERMISSIONS[ctx.role] || [];
    const allPermissions = [...rolePermissions, ...(ctx.customPermissions || [])];
    
    // Check each required permission
    for (const req of requiredPermissions) {
      const hasPermission = allPermissions.some(perm => 
        matchesPermission(perm, req)
      );
      
      if (!hasPermission) {
        await auditLog.warn({
          event: 'AUTHORIZATION_DENIED',
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          required: req,
          role: ctx.role,
        });
        
        throw new ForbiddenError(
          `Missing permission: ${req.action} on ${req.resource}`
        );
      }
    }
    
    return next();
  };
}

function matchesPermission(
  granted: Permission,
  required: Permission
): boolean {
  // Check resource
  if (granted.resource !== '*' && granted.resource !== required.resource) {
    return false;
  }
  
  // Check action
  if (granted.action !== '*' && 
      granted.action !== 'manage' && 
      granted.action !== required.action) {
    return false;
  }
  
  // Check scope
  if (granted.scope === '*') {
    return true;
  }
  
  if (granted.scope === required.scope) {
    return true;
  }
  
  // Handle scope patterns (e.g., bot:123)
  if (granted.scope.includes(':') && required.scope.includes(':')) {
    const [grantedType, grantedId] = granted.scope.split(':');
    const [requiredType, requiredId] = required.scope.split(':');
    return grantedType === requiredType && grantedId === requiredId;
  }
  
  return false;
}

// Usage in API routes
app.put('/api/bots/:id', 
  authenticate,
  authorize({ resource: 'bots', action: 'update', scope: '*' }),
  updateBotHandler
);
```

### 3.4 MFA Requirements

```typescript
// types/mfa.ts
interface MFAPolicy {
  // When MFA is required
  required_for: {
    all_users: boolean;
    roles: Role[];
    actions: string[]; // e.g., 'billing.update', 'api_keys.create'
  };
  
  // Allowed methods
  allowed_methods: ('totp' | 'sms' | 'email' | 'webauthn')[];
  
  // Grace period for new users
  grace_period_days: number;
  
  // Remember trusted devices
  remember_device_days: number;
}

// Default policy per plan
const MFA_POLICIES: Record<Plan, MFAPolicy> = {
  free: {
    required_for: { all_users: false, roles: [], actions: [] },
    allowed_methods: ['totp'],
    grace_period_days: 0,
    remember_device_days: 30,
  },
  
  pro: {
    required_for: { 
      all_users: false, 
      roles: ['owner', 'admin'], 
      actions: ['billing.update', 'api_keys.create'] 
    },
    allowed_methods: ['totp', 'webauthn'],
    grace_period_days: 7,
    remember_device_days: 30,
  },
  
  enterprise: {
    required_for: { 
      all_users: true, // Enforced for everyone
      roles: [], 
      actions: [] 
    },
    allowed_methods: ['totp', 'webauthn', 'sms'],
    grace_period_days: 0, // No grace
    remember_device_days: 7,
  },
};

// MFA verification flow
async function verifyMFA(
  userId: string,
  method: MFAMethod,
  code: string
): Promise<boolean> {
  const mfaConfig = await db
    .selectFrom('user_mfa')
    .where('user_id', '=', userId)
    .where('method', '=', method)
    .where('verified', '=', true)
    .selectAll()
    .executeTakeFirst();
  
  if (!mfaConfig) {
    throw new Error('MFA not configured');
  }
  
  switch (method) {
    case 'totp':
      return verifyTOTP(mfaConfig.secret, code);
    
    case 'webauthn':
      return verifyWebAuthn(mfaConfig.credential_id, code);
    
    case 'sms':
      return verifySMSCode(userId, code);
    
    default:
      return false;
  }
}
```

---

## 4. LGPD Compliance

### 4.1 Mapeamento de Dados Pessoais

```yaml
# data-mapping.yaml
personal_data_inventory:

  # Dados de Usuários (Dashboard)
  users:
    table: "auth.users"
    data_subjects: "Usuários do dashboard"
    personal_data:
      - field: "email"
        category: "Identificação"
        sensitive: false
        retention: "Enquanto conta ativa + 5 anos"
        
      - field: "name"
        category: "Identificação"
        sensitive: false
        retention: "Enquanto conta ativa"
        
      - field: "phone"
        category: "Contato"
        sensitive: false
        retention: "Enquanto conta ativa"
        
      - field: "ip_address" 
        category: "Técnico"
        sensitive: false
        retention: "90 dias (logs)"
        location: "audit_logs"

  # Dados de Contatos dos Bots
  contacts:
    table: "conversations"
    data_subjects: "Usuários finais (contatos dos bots)"
    personal_data:
      - field: "contact_info.phone"
        category: "Contato"
        sensitive: false
        retention: "Definido por tenant"
        encrypted: true
        
      - field: "contact_info.name"
        category: "Identificação"
        sensitive: false
        retention: "Definido por tenant"
        
      - field: "external_id"
        category: "Identificador externo"
        sensitive: false
        retention: "Definido por tenant"

  # Mensagens (podem conter PII)
  messages:
    table: "messages"
    data_subjects: "Usuários finais"
    personal_data:
      - field: "content"
        category: "Comunicação"
        sensitive: "potencialmente"
        retention: "Definido por tenant"
        notes: "Pode conter dados pessoais inseridos pelo usuário"
        pii_detection: "automated"

  # Dados de Billing
  billing:
    table: "billing_info"
    data_subjects: "Responsáveis por pagamento"
    personal_data:
      - field: "billing_email"
        category: "Contato"
        retention: "5 anos após último pagamento"
        
      - field: "tax_id"
        category: "Fiscal"
        retention: "5 anos após último pagamento"
        encrypted: true
        
      - field: "address"
        category: "Localização"
        retention: "5 anos após último pagamento"

# Fluxo de dados pessoais
data_flows:
  - source: "WhatsApp API"
    destination: "conversations table"
    data: ["phone", "name", "profile_picture"]
    encryption: "TLS in transit, AES at rest"
    
  - source: "conversations table"
    destination: "LLM Provider (OpenAI/Anthropic)"
    data: ["message content"]
    encryption: "TLS in transit"
    notes: "Mensagens são enviadas para processamento"
    
  - source: "Dashboard"
    destination: "Analytics"
    data: ["aggregated metrics only"]
    pii: false
```

### 4.2 Base Legal por Tratamento

```yaml
# legal-basis.yaml
treatments:

  # Autenticação e Conta
  - purpose: "Criação e gerenciamento de conta"
    data: ["email", "nome", "senha_hash"]
    legal_basis: "Execução de contrato"
    article: "Art. 7º, V"
    retention: "Duração do contrato + 5 anos"
    
  - purpose: "Autenticação (login)"
    data: ["email", "IP", "user_agent"]
    legal_basis: "Execução de contrato"
    article: "Art. 7º, V"
    retention: "90 dias (logs de segurança)"

  # Operação do Serviço
  - purpose: "Processamento de mensagens do bot"
    data: ["conteúdo das mensagens", "telefone", "nome do contato"]
    legal_basis: "Execução de contrato"
    article: "Art. 7º, V"
    retention: "Definido pelo cliente (controlador)"
    notes: "Cliente é controlador, nós somos operadores"
    
  - purpose: "Integração com LLMs"
    data: ["conteúdo das mensagens"]
    legal_basis: "Execução de contrato"
    article: "Art. 7º, V"
    third_party: true
    subprocessors: ["OpenAI", "Anthropic"]

  # Billing
  - purpose: "Faturamento e cobrança"
    data: ["email de billing", "CNPJ/CPF", "endereço"]
    legal_basis: "Execução de contrato + Obrigação legal"
    article: "Art. 7º, V e II"
    retention: "5 anos (obrigação fiscal)"

  # Analytics
  - purpose: "Analytics de uso agregado"
    data: ["métricas de uso (sem PII)"]
    legal_basis: "Legítimo interesse"
    article: "Art. 7º, IX"
    lia_performed: true
    opt_out: available

  # Marketing
  - purpose: "Comunicações de marketing"
    data: ["email"]
    legal_basis: "Consentimento"
    article: "Art. 7º, I"
    retention: "Até revogação"
    opt_out: required

  # Segurança
  - purpose: "Detecção de fraude e segurança"
    data: ["IP", "user_agent", "padrões de acesso"]
    legal_basis: "Legítimo interesse"
    article: "Art. 7º, IX"
    lia_performed: true
```

### 4.3 Direitos dos Titulares - Implementação

```typescript
// lgpd/data-subject-rights.ts

interface DataSubjectRequest {
  id: string;
  type: DSRType;
  subject_email: string;
  subject_identity_verified: boolean;
  organization_id?: string; // If request is for specific tenant
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: Date;
  completed_at?: Date;
  response?: any;
}

type DSRType = 
  | 'access'          // Direito de acesso
  | 'rectification'   // Direito de retificação
  | 'erasure'         // Direito de eliminação
  | 'portability'     // Direito de portabilidade
  | 'objection'       // Direito de oposição
  | 'restriction'     // Direito de limitação
  | 'revoke_consent'; // Revogação de consentimento

// 1. DIREITO DE ACESSO (Art. 18, II)
async function handleAccessRequest(
  request: DataSubjectRequest
): Promise<DataAccessResponse> {
  const email = request.subject_email;
  
  // Collect all data
  const userData = await db.selectFrom('users')
    .where('email', '=', email)
    .selectAll()
    .execute();
  
  const orgMemberships = await db.selectFrom('organization_members')
    .innerJoin('organizations', 'organizations.id', 'organization_members.organization_id')
    .where('user_id', 'in', userData.map(u => u.id))
    .select(['organizations.name', 'role', 'invited_at', 'accepted_at'])
    .execute();
  
  const auditLogs = await db.selectFrom('audit_logs')
    .where('user_id', 'in', userData.map(u => u.id))
    .orderBy('created_at', 'desc')
    .limit(1000)
    .execute();
  
  // For end-users (contacts of bots), need to search by phone/identifier
  // This requires coordination with tenant
  
  return {
    personal_data: {
      identity: {
        email: userData[0]?.email,
        name: userData[0]?.name,
        created_at: userData[0]?.created_at,
      },
      memberships: orgMemberships,
      activity_logs: auditLogs.map(l => ({
        event: l.event,
        timestamp: l.created_at,
        // Exclude sensitive details
      })),
    },
    processing_purposes: [
      'Autenticação e acesso à plataforma',
      'Gerenciamento de organizações',
      'Auditoria de segurança',
    ],
    data_recipients: [
      'Supabase (infraestrutura)',
      'Cloudflare (CDN/segurança)',
    ],
    retention_periods: {
      account_data: 'Enquanto conta ativa',
      audit_logs: '90 dias',
    },
    generated_at: new Date(),
  };
}

// 2. DIREITO DE RETIFICAÇÃO (Art. 18, III)
async function handleRectificationRequest(
  request: DataSubjectRequest,
  corrections: Record<string, any>
): Promise<void> {
  const allowedFields = ['name', 'phone']; // Campos que podem ser corrigidos
  
  const validCorrections = Object.entries(corrections)
    .filter(([key]) => allowedFields.includes(key));
  
  if (validCorrections.length === 0) {
    throw new Error('No valid fields to correct');
  }
  
  await db.updateTable('users')
    .set(Object.fromEntries(validCorrections))
    .where('email', '=', request.subject_email)
    .execute();
  
  await auditLog.info({
    event: 'DSR_RECTIFICATION_COMPLETED',
    subject: request.subject_email,
    fields_corrected: validCorrections.map(([k]) => k),
  });
}

// 3. DIREITO DE ELIMINAÇÃO (Art. 18, VI)
async function handleErasureRequest(
  request: DataSubjectRequest
): Promise<ErasureResult> {
  const email = request.subject_email;
  
  // Check for legal retention requirements
  const hasActiveSubscription = await checkActiveSubscription(email);
  const hasPendingInvoices = await checkPendingInvoices(email);
  
  if (hasActiveSubscription || hasPendingInvoices) {
    return {
      status: 'partial',
      reason: 'Dados retidos por obrigação contratual/legal',
      deleted: [],
      retained: ['billing_data', 'contract_data'],
      retention_until: 'Fim do contrato + 5 anos',
    };
  }
  
  // Begin deletion process
  const result: string[] = [];
  
  // 1. Anonymize audit logs (não deletar para compliance)
  await db.updateTable('audit_logs')
    .set({ 
      user_id: null,
      user_email: 'REDACTED',
      ip_address: 'REDACTED',
    })
    .where('user_email', '=', email)
    .execute();
  result.push('audit_logs (anonymized)');
  
  // 2. Delete organization memberships
  await db.deleteFrom('organization_members')
    .where('user_id', 'in', 
      db.selectFrom('users')
        .where('email', '=', email)
        .select('id')
    )
    .execute();
  result.push('organization_members');
  
  // 3. Delete user account
  await db.deleteFrom('users')
    .where('email', '=', email)
    .execute();
  result.push('users');
  
  // 4. Delete from auth provider (Supabase)
  await supabase.auth.admin.deleteUser(userId);
  result.push('auth_account');
  
  await auditLog.info({
    event: 'DSR_ERASURE_COMPLETED',
    subject_email_hash: hashEmail(email), // Log hash, não email real
    deleted_categories: result,
  });
  
  return {
    status: 'completed',
    deleted: result,
    retained: [],
  };
}

// 4. DIREITO DE PORTABILIDADE (Art. 18, V)
async function handlePortabilityRequest(
  request: DataSubjectRequest
): Promise<PortableDataPackage> {
  const email = request.subject_email;
  
  // Collect all data in machine-readable format
  const data = {
    metadata: {
      export_date: new Date().toISOString(),
      format: 'JSON',
      schema_version: '1.0',
    },
    
    user_data: await db.selectFrom('users')
      .where('email', '=', email)
      .select(['email', 'name', 'phone', 'created_at'])
      .executeTakeFirst(),
    
    organizations: await db.selectFrom('organization_members')
      .innerJoin('organizations', 'organizations.id', 'organization_members.organization_id')
      .where('user_id', '=', userId)
      .select([
        'organizations.name',
        'organizations.slug',
        'role',
        'invited_at',
      ])
      .execute(),
    
    // Bots created by user
    bots: await db.selectFrom('bots')
      .where('created_by', '=', userId)
      .select(['name', 'description', 'system_prompt', 'model', 'created_at'])
      .execute(),
  };
  
  // Generate downloadable package
  const jsonData = JSON.stringify(data, null, 2);
  const fileName = `data-export-${Date.now()}.json`;
  
  // Store temporarily for download (24h)
  const downloadUrl = await storeTemporaryFile(jsonData, fileName, '24h');
  
  return {
    format: 'application/json',
    download_url: downloadUrl,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

// 5. DIREITO DE OPOSIÇÃO (Art. 18, IV)
async function handleObjectionRequest(
  request: DataSubjectRequest,
  processingPurpose: string
): Promise<void> {
  // Validate objection is allowed for this purpose
  const objectionAllowed = [
    'marketing_communications',
    'analytics_tracking',
    'personalization',
  ];
  
  if (!objectionAllowed.includes(processingPurpose)) {
    throw new Error(
      'Oposição não aplicável para este tratamento (base legal não é legítimo interesse)'
    );
  }
  
  await db.insertInto('user_preferences')
    .values({
      user_email: request.subject_email,
      preference: `opt_out_${processingPurpose}`,
      value: true,
      updated_at: new Date(),
    })
    .onConflict(['user_email', 'preference'])
    .doUpdateSet({ value: true, updated_at: new Date() })
    .execute();
  
  // Apply immediately
  switch (processingPurpose) {
    case 'marketing_communications':
      await unsubscribeFromMarketing(request.subject_email);
      break;
    case 'analytics_tracking':
      await setAnalyticsOptOut(request.subject_email, true);
      break;
  }
}

// API endpoint for DSR
app.post('/api/lgpd/request', async (req, res) => {
  const { type, email } = req.body;
  
  // 1. Verify identity (enviar código por email)
  await sendVerificationCode(email);
  
  // 2. Create request
  const request = await db.insertInto('dsr_requests')
    .values({
      type,
      subject_email: email,
      status: 'pending_verification',
    })
    .returningAll()
    .executeTakeFirst();
  
  res.json({
    request_id: request.id,
    message: 'Código de verificação enviado para seu email',
    next_step: 'POST /api/lgpd/verify',
  });
});

// SLA: 15 dias para resposta (recomendação LGPD)
const DSR_SLA_DAYS = 15;
```

### 4.4 Política de Retenção

```yaml
# retention-policy.yaml
retention_policies:

  # Dados de Conta
  account_data:
    description: "Dados de usuários do dashboard"
    retention: "Enquanto conta ativa"
    post_deletion: "30 dias em backup, depois eliminado"
    legal_basis: "Execução de contrato"
    
  # Dados de Billing
  billing_data:
    description: "Faturas, transações, dados fiscais"
    retention: "5 anos após último pagamento"
    legal_basis: "Obrigação legal (tributário)"
    exceptions:
      - "Disputas pendentes: até resolução"
      
  # Logs de Auditoria
  audit_logs:
    description: "Logs de acesso e ações"
    retention: "90 dias"
    post_retention: "Anonimização"
    legal_basis: "Legítimo interesse (segurança)"
    
  # Mensagens de Conversação
  conversation_messages:
    description: "Conteúdo das conversas com bots"
    retention: "Definido pelo cliente (tenant)"
    default: "90 dias"
    minimum: "7 dias"
    maximum: "Indefinido (plano enterprise)"
    notes: "Cliente é controlador, define retenção"
    
  # Analytics
  analytics_data:
    description: "Métricas de uso agregadas"
    retention: "2 anos"
    anonymization: "Após 30 dias"
    
  # Backups
  backups:
    description: "Backups de banco de dados"
    retention: "30 dias"
    encryption: "AES-256"
    deletion: "Automática via lifecycle policy"

# Automação de retenção
automation:
  schedule: "daily at 03:00 UTC"
  
  jobs:
    - name: "cleanup_old_audit_logs"
      query: "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'"
      
    - name: "anonymize_old_messages"
      query: |
        UPDATE messages 
        SET content = '[REDACTED]', 
            content_encrypted = NULL,
            metadata = metadata - 'pii_fields'
        WHERE created_at < NOW() - INTERVAL '90 days'
        AND organization_id IN (
          SELECT id FROM organizations 
          WHERE settings->>'retention_days' = '90'
        )
        
    - name: "delete_expired_magic_links"
      query: "DELETE FROM magic_link_tokens WHERE expires_at < NOW() - INTERVAL '1 day'"
      
    - name: "cleanup_temp_files"
      action: "s3_lifecycle_policy"
      bucket: "temp-exports"
      retention: "24 hours"
```

### 4.5 DPA Template (Data Processing Agreement)

```markdown
# ACORDO DE PROCESSAMENTO DE DADOS (DPA)
## Anexo ao Contrato de Prestação de Serviços

**Entre:**
- **CONTROLADOR:** [Nome do Cliente], inscrito no CNPJ/CPF [XXX], doravante denominado "CONTROLADOR"
- **OPERADOR:** [Bot-as-a-Service LTDA], inscrito no CNPJ [XXX], doravante denominado "OPERADOR"

---

### 1. DEFINIÇÕES

1.1. **Dados Pessoais:** Informação relacionada a pessoa natural identificada ou identificável.

1.2. **Tratamento:** Toda operação realizada com dados pessoais.

1.3. **Titular:** Pessoa natural a quem se referem os dados pessoais.

1.4. **LGPD:** Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).

---

### 2. OBJETO

2.1. Este Acordo estabelece as obrigações das partes quanto ao tratamento de dados pessoais realizado pelo OPERADOR em nome do CONTROLADOR na prestação dos serviços de Bot-as-a-Service.

---

### 3. DADOS PROCESSADOS

3.1. O OPERADOR processará os seguintes dados pessoais em nome do CONTROLADOR:

| Categoria | Tipos de Dados | Finalidade |
|-----------|---------------|------------|
| Identificação | Nome, telefone, identificadores de canal | Operação do serviço de chatbot |
| Comunicação | Conteúdo das mensagens | Processamento de conversações |
| Técnicos | IP, timestamps, metadados | Operação e segurança |

3.2. Os titulares dos dados são: usuários finais que interagem com os bots do CONTROLADOR.

---

### 4. OBRIGAÇÕES DO OPERADOR

4.1. Processar dados pessoais apenas conforme instruções documentadas do CONTROLADOR.

4.2. Garantir que pessoas autorizadas a processar dados pessoais estejam sob obrigação de confidencialidade.

4.3. Implementar medidas técnicas e organizacionais apropriadas:
   - Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256)
   - Controle de acesso baseado em funções (RBAC)
   - Logs de auditoria imutáveis
   - Isolamento de dados por cliente (Row Level Security)

4.4. Não subcontratar sem autorização prévia do CONTROLADOR. Subprocessadores atuais:
   - **Supabase Inc.** (infraestrutura de banco de dados)
   - **OpenAI/Anthropic** (processamento de linguagem natural)
   - **Cloudflare Inc.** (CDN e segurança)
   - **AWS/GCP** (infraestrutura cloud)

4.5. Auxiliar o CONTROLADOR no atendimento de solicitações de titulares (acesso, retificação, eliminação, portabilidade).

4.6. Auxiliar o CONTROLADOR no cumprimento de obrigações de segurança e notificação de incidentes.

4.7. Após término do contrato, excluir ou devolver todos os dados pessoais, conforme escolha do CONTROLADOR.

4.8. Disponibilizar informações necessárias para demonstrar conformidade com este Acordo.

---

### 5. OBRIGAÇÕES DO CONTROLADOR

5.1. Garantir base legal para o tratamento dos dados.

5.2. Informar os titulares sobre o tratamento de seus dados.

5.3. Documentar instruções de tratamento fornecidas ao OPERADOR.

5.4. Definir período de retenção de dados.

---

### 6. INCIDENTES DE SEGURANÇA

6.1. O OPERADOR notificará o CONTROLADOR sobre incidentes de segurança envolvendo dados pessoais em até **24 horas** após tomar conhecimento.

6.2. A notificação incluirá:
   - Natureza do incidente
   - Categorias e quantidade aproximada de titulares afetados
   - Categorias e quantidade aproximada de registros afetados
   - Medidas tomadas ou propostas
   - Ponto de contato para informações

---

### 7. TRANSFERÊNCIA INTERNACIONAL

7.1. Dados podem ser processados nos seguintes países/regiões:
   - Estados Unidos (infraestrutura cloud)
   - União Europeia (se aplicável)

7.2. Transferências são realizadas com base em:
   - Cláusulas Contratuais Padrão (SCCs)
   - Certificações do provedor (SOC 2, ISO 27001)

---

### 8. AUDITORIA

8.1. O CONTROLADOR pode, mediante aviso prévio de 30 dias, realizar auditorias para verificar conformidade com este Acordo.

8.2. O OPERADOR fornecerá relatórios de auditoria independente (SOC 2) quando disponíveis.

---

### 9. VIGÊNCIA

9.1. Este Acordo entra em vigor na data de assinatura e permanece vigente durante a prestação dos serviços.

---

### 10. DISPOSIÇÕES GERAIS

10.1. Este Acordo é regido pela legislação brasileira.

10.2. Conflitos serão resolvidos pelo foro da comarca de [Cidade], [Estado].

---

**Assinaturas:**

_______________________________
CONTROLADOR
Nome:
Cargo:
Data:

_______________________________
OPERADOR
Nome:
Cargo:
Data:

---

## ANEXO A - MEDIDAS TÉCNICAS E ORGANIZACIONAIS

### A.1 Segurança de Infraestrutura
- [ ] Criptografia em trânsito (TLS 1.2+)
- [ ] Criptografia em repouso (AES-256)
- [ ] Firewall e WAF configurados
- [ ] DDoS protection ativo

### A.2 Controle de Acesso
- [ ] Autenticação multi-fator para administradores
- [ ] Princípio do menor privilégio
- [ ] Revisão periódica de acessos (trimestral)
- [ ] Logs de acesso mantidos por 90 dias

### A.3 Segurança de Dados
- [ ] Row Level Security habilitado
- [ ] Backups diários criptografados
- [ ] Teste de restauração mensal
- [ ] Segregação de ambientes (prod/staging/dev)

### A.4 Gestão de Incidentes
- [ ] Plano de resposta a incidentes documentado
- [ ] Equipe de resposta definida
- [ ] Testes anuais do plano
- [ ] Canal de comunicação 24/7

### A.5 Desenvolvimento Seguro
- [ ] Code review obrigatório
- [ ] Testes de segurança automatizados
- [ ] Gestão de dependências
- [ ] Penetration testing anual
```

---

## 5. Audit & Logging

### 5.1 O Que Logar

```yaml
# audit-events.yaml
audit_events:

  # AUTENTICAÇÃO (OBRIGATÓRIO)
  authentication:
    - event: "USER_LOGIN"
      fields: [user_id, email, method, ip, user_agent, success]
      retention: 90_days
      
    - event: "USER_LOGOUT"
      fields: [user_id, ip]
      retention: 90_days
      
    - event: "USER_LOGIN_FAILED"
      fields: [email, ip, user_agent, reason]
      retention: 90_days
      alert: true # Alert on 5+ failures
      
    - event: "MFA_VERIFIED"
      fields: [user_id, method]
      retention: 90_days
      
    - event: "MFA_FAILED"
      fields: [user_id, method, ip]
      retention: 90_days
      alert: true
      
    - event: "PASSWORD_CHANGED"
      fields: [user_id, ip]
      retention: 1_year
      
    - event: "MAGIC_LINK_SENT"
      fields: [email, ip]
      retention: 30_days
      
    - event: "MAGIC_LINK_USED"
      fields: [email, ip, success]
      retention: 90_days

  # AUTORIZAÇÃO (OBRIGATÓRIO)
  authorization:
    - event: "AUTHORIZATION_DENIED"
      fields: [user_id, tenant_id, resource, action, ip]
      retention: 90_days
      alert: true
      
    - event: "CROSS_TENANT_ACCESS_ATTEMPT"
      fields: [user_id, source_tenant, target_tenant, resource]
      retention: 1_year
      alert: critical
      
    - event: "ROLE_CHANGED"
      fields: [user_id, target_user_id, old_role, new_role, changed_by]
      retention: 1_year
      
    - event: "PERMISSION_GRANTED"
      fields: [user_id, permission, granted_by]
      retention: 1_year

  # DADOS SENSÍVEIS (OBRIGATÓRIO)
  sensitive_data:
    - event: "PII_ACCESSED"
      fields: [user_id, data_type, record_count, purpose]
      retention: 1_year
      
    - event: "DATA_EXPORTED"
      fields: [user_id, tenant_id, export_type, record_count]
      retention: 1_year
      
    - event: "DATA_DELETED"
      fields: [user_id, tenant_id, data_type, record_count, reason]
      retention: 5_years
      
    - event: "DSR_REQUEST_RECEIVED"
      fields: [request_type, subject_email_hash, tenant_id]
      retention: 5_years
      
    - event: "DSR_REQUEST_COMPLETED"
      fields: [request_id, request_type, outcome]
      retention: 5_years

  # RECURSOS (IMPORTANTE)
  resources:
    - event: "BOT_CREATED"
      fields: [bot_id, tenant_id, created_by, name]
      retention: 1_year
      
    - event: "BOT_UPDATED"
      fields: [bot_id, tenant_id, updated_by, changed_fields]
      retention: 1_year
      
    - event: "BOT_DELETED"
      fields: [bot_id, tenant_id, deleted_by]
      retention: 5_years
      
    - event: "API_KEY_CREATED"
      fields: [key_id, tenant_id, created_by, permissions]
      retention: 1_year
      
    - event: "API_KEY_REVOKED"
      fields: [key_id, tenant_id, revoked_by, reason]
      retention: 1_year

  # BILLING (OBRIGATÓRIO - COMPLIANCE FISCAL)
  billing:
    - event: "SUBSCRIPTION_CREATED"
      fields: [tenant_id, plan, amount, currency]
      retention: 5_years
      
    - event: "SUBSCRIPTION_CHANGED"
      fields: [tenant_id, old_plan, new_plan, changed_by]
      retention: 5_years
      
    - event: "PAYMENT_PROCESSED"
      fields: [tenant_id, amount, currency, status]
      retention: 5_years
      
    - event: "INVOICE_GENERATED"
      fields: [tenant_id, invoice_id, amount]
      retention: 5_years

  # SEGURANÇA (OBRIGATÓRIO)
  security:
    - event: "SECURITY_SETTING_CHANGED"
      fields: [tenant_id, setting, old_value, new_value, changed_by]
      retention: 1_year
      
    - event: "IP_BLOCKED"
      fields: [ip, reason, duration]
      retention: 90_days
      
    - event: "RATE_LIMIT_EXCEEDED"
      fields: [tenant_id, user_id, endpoint, limit]
      retention: 30_days
      alert: true
      
    - event: "SUSPICIOUS_ACTIVITY"
      fields: [tenant_id, user_id, activity_type, details]
      retention: 1_year
      alert: critical

  # SISTEMA (IMPORTANTE)
  system:
    - event: "SYSTEM_CONFIG_CHANGED"
      fields: [config_key, old_value, new_value, changed_by]
      retention: 1_year
      
    - event: "MAINTENANCE_MODE_ENABLED"
      fields: [enabled_by, reason, duration]
      retention: 1_year
      
    - event: "SERVICE_DEGRADATION"
      fields: [service, severity, duration]
      retention: 90_days
```

### 5.2 Formato do Audit Log

```typescript
// types/audit-log.ts
interface AuditLogEntry {
  // Identificação
  id: string;                    // UUID único
  timestamp: string;             // ISO 8601 UTC
  
  // Evento
  event: string;                 // Nome do evento (e.g., "USER_LOGIN")
  category: string;              // Categoria (auth, resource, security, etc.)
  severity: 'info' | 'warn' | 'error' | 'critical';
  
  // Ator
  actor: {
    type: 'user' | 'api_key' | 'system' | 'service';
    id?: string;                 // User ID ou API key ID
    email?: string;              // Email (mascarado em alguns contextos)
    ip?: string;                 // IP address
    user_agent?: string;         // User agent
  };
  
  // Contexto
  tenant_id?: string;            // Organization ID
  resource?: {
    type: string;                // e.g., "bot", "conversation"
    id: string;                  // Resource ID
  };
  
  // Detalhes do evento
  details: Record<string, any>;  // Event-specific data
  
  // Resultado
  outcome: 'success' | 'failure' | 'error';
  error_code?: string;
  error_message?: string;
  
  // Metadados
  request_id?: string;           // Correlation ID
  session_id?: string;           // Session ID
  
  // Integridade
  checksum: string;              // SHA-256 do entry
  previous_checksum?: string;    // Para chain verification
}

// Exemplo de log entry
const exampleLog: AuditLogEntry = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  timestamp: "2025-01-29T14:30:00.000Z",
  
  event: "USER_LOGIN",
  category: "authentication",
  severity: "info",
  
  actor: {
    type: "user",
    id: "user_123",
    email: "j***@example.com", // Mascarado
    ip: "203.0.113.45",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  },
  
  tenant_id: "org_456",
  
  details: {
    method: "magic_link",
    mfa_used: false,
  },
  
  outcome: "success",
  
  request_id: "req_abc123",
  session_id: "sess_xyz789",
  
  checksum: "sha256:a1b2c3d4e5f6...",
  previous_checksum: "sha256:9z8y7x6w5v...",
};
```

### 5.3 Retenção

```typescript
// audit/retention.ts

const RETENTION_POLICIES: Record<string, number> = {
  // Dias de retenção por categoria
  'authentication': 90,
  'authorization': 90,
  'sensitive_data': 365,
  'resources': 365,
  'billing': 1825,      // 5 anos
  'security': 365,
  'system': 365,
  
  // Override por evento específico
  'DATA_DELETED': 1825,
  'DSR_REQUEST_*': 1825,
  'PAYMENT_*': 1825,
};

// Job de limpeza
async function cleanupAuditLogs(): Promise<void> {
  for (const [category, days] of Object.entries(RETENTION_POLICIES)) {
    if (category.includes('*')) continue; // Skip patterns
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Archive before delete (cold storage)
    await archiveToS3({
      category,
      before: cutoffDate,
      bucket: 'audit-archive',
      prefix: `audit/${category}/${cutoffDate.toISOString().split('T')[0]}/`,
    });
    
    // Delete from hot storage
    const deleted = await db
      .deleteFrom('audit_logs')
      .where('category', '=', category)
      .where('timestamp', '<', cutoffDate)
      .execute();
    
    console.log(`Cleaned ${deleted.numDeletedRows} logs from ${category}`);
  }
}
```

### 5.4 Imutabilidade (Append-Only)

```sql
-- ============================================
-- IMMUTABLE AUDIT LOG SCHEMA
-- ============================================

-- 1. Tabela de Audit Logs (append-only)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Event info
    event TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    
    -- Actor
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    actor_email TEXT,
    actor_ip INET,
    actor_user_agent TEXT,
    
    -- Context
    tenant_id UUID,
    resource_type TEXT,
    resource_id TEXT,
    
    -- Details
    details JSONB NOT NULL DEFAULT '{}',
    
    -- Outcome
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'error')),
    error_code TEXT,
    error_message TEXT,
    
    -- Correlation
    request_id TEXT,
    session_id TEXT,
    
    -- Integrity
    checksum TEXT NOT NULL,
    previous_checksum TEXT,
    
    -- Partition key
    created_date DATE NOT NULL DEFAULT CURRENT_DATE
) PARTITION BY RANGE (created_date);

-- 2. Criar partições mensais
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... etc (automatizar via cron)

-- 3. IMPEDIR UPDATE E DELETE (somente INSERT)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER audit_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- 4. Verificar integridade (chain validation)
CREATE OR REPLACE FUNCTION verify_audit_chain(
    start_id UUID,
    end_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    current_row RECORD;
    expected_previous TEXT;
    is_valid BOOLEAN := TRUE;
BEGIN
    expected_previous := NULL;
    
    FOR current_row IN
        SELECT id, checksum, previous_checksum
        FROM audit_logs
        WHERE id >= start_id AND id <= end_id
        ORDER BY timestamp ASC
    LOOP
        IF expected_previous IS NOT NULL AND current_row.previous_checksum != expected_previous THEN
            RAISE WARNING 'Chain broken at %: expected % but got %', 
                current_row.id, expected_previous, current_row.previous_checksum;
            is_valid := FALSE;
        END IF;
        
        expected_previous := current_row.checksum;
    END LOOP;
    
    RETURN is_valid;
END;
$$ LANGUAGE plpgsql;

-- 5. Índices para queries comuns
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_event ON audit_logs(event, timestamp DESC);
CREATE INDEX idx_audit_category ON audit_logs(category, timestamp DESC);
```

```typescript
// audit/writer.ts
import { createHash } from 'crypto';

class ImmutableAuditLog {
  private lastChecksum: string | null = null;
  
  async write(entry: Omit<AuditLogEntry, 'id' | 'checksum' | 'previous_checksum'>): Promise<void> {
    // Calculate checksum
    const dataToHash = JSON.stringify({
      timestamp: entry.timestamp,
      event: entry.event,
      actor: entry.actor,
      details: entry.details,
    });
    
    const checksum = createHash('sha256')
      .update(dataToHash)
      .digest('hex');
    
    // Get previous checksum for chain
    const previousChecksum = this.lastChecksum || await this.getLastChecksum();
    
    // Insert (will fail on UPDATE/DELETE due to triggers)
    await db.insertInto('audit_logs').values({
      ...entry,
      checksum: `sha256:${checksum}`,
      previous_checksum: previousChecksum ? `sha256:${previousChecksum}` : null,
      created_date: new Date().toISOString().split('T')[0],
    }).execute();
    
    this.lastChecksum = checksum;
    
    // Async: send to SIEM if critical
    if (entry.severity === 'critical') {
      this.sendToSIEM(entry).catch(console.error);
    }
  }
  
  private async getLastChecksum(): Promise<string | null> {
    const last = await db
      .selectFrom('audit_logs')
      .orderBy('timestamp', 'desc')
      .select('checksum')
      .limit(1)
      .executeTakeFirst();
    
    return last?.checksum?.replace('sha256:', '') || null;
  }
  
  private async sendToSIEM(entry: any): Promise<void> {
    // Integration with external SIEM (Splunk, Datadog, etc.)
    await fetch(process.env.SIEM_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  }
  
  // Verify chain integrity
  async verifyIntegrity(hours: number = 24): Promise<boolean> {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    
    const logs = await db
      .selectFrom('audit_logs')
      .where('timestamp', '>', since)
      .orderBy('timestamp', 'asc')
      .select(['checksum', 'previous_checksum'])
      .execute();
    
    let expectedPrevious: string | null = null;
    
    for (const log of logs) {
      if (expectedPrevious !== null && log.previous_checksum !== expectedPrevious) {
        console.error('Audit chain integrity violation detected!');
        return false;
      }
      expectedPrevious = log.checksum;
    }
    
    return true;
  }
}

export const auditLog = new ImmutableAuditLog();
```

---

## 6. Incident Response

### 6.1 Playbook de Resposta

```yaml
# incident-response-playbook.yaml
incident_response:

  # Níveis de severidade
  severity_levels:
    P1_CRITICAL:
      description: "Vazamento de dados, breach confirmado, sistema indisponível"
      response_time: "15 minutos"
      escalation: "Imediata para C-level"
      communication: "Externa necessária"
      
    P2_HIGH:
      description: "Vulnerabilidade ativa, tentativa de breach, degradação severa"
      response_time: "1 hora"
      escalation: "Engineering Lead + Security"
      communication: "Interna obrigatória"
      
    P3_MEDIUM:
      description: "Vulnerabilidade identificada, anomalia de segurança"
      response_time: "4 horas"
      escalation: "Security team"
      communication: "Ticket interno"
      
    P4_LOW:
      description: "Best practice violation, minor security issue"
      response_time: "24 horas"
      escalation: "Normal ticket flow"
      communication: "Opcional"

  # Equipe de resposta
  response_team:
    incident_commander:
      role: "Coordena resposta, decisões finais"
      primary: "[CTO Name]"
      backup: "[VP Engineering]"
      contact: "[phone/signal]"
      
    technical_lead:
      role: "Investigação técnica, contenção"
      primary: "[Lead Engineer]"
      backup: "[Senior Engineer]"
      
    communications:
      role: "Comunicação interna/externa"
      primary: "[Head of Customer Success]"
      backup: "[CEO]"
      
    legal:
      role: "Compliance, notificações legais"
      primary: "[Legal/DPO]"
      external: "[Law Firm Contact]"

  # Fases de resposta
  phases:

    # FASE 1: DETECÇÃO E TRIAGEM (0-15 min)
    detection:
      checklist:
        - "[ ] Confirmar que é um incidente real (não falso positivo)"
        - "[ ] Classificar severidade (P1-P4)"
        - "[ ] Identificar sistemas/dados afetados"
        - "[ ] Ativar canal de comunicação de incidentes"
        - "[ ] Notificar Incident Commander se P1/P2"
        
      questions:
        - "O que aconteceu? (fatos conhecidos)"
        - "Quando começou?"
        - "Quais sistemas estão afetados?"
        - "Dados foram expostos/comprometidos?"
        - "O ataque ainda está ativo?"
        
      tools:
        - "Dashboard de monitoramento"
        - "Logs centralizados"
        - "Alertas de segurança (WAF, IDS)"

    # FASE 2: CONTENÇÃO (15 min - 2h)
    containment:
      immediate_actions:
        data_breach:
          - "[ ] Isolar sistemas afetados da rede"
          - "[ ] Revogar credenciais comprometidas"
          - "[ ] Bloquear IPs maliciosos"
          - "[ ] Preservar evidências (snapshots, logs)"
          
        ddos_attack:
          - "[ ] Ativar modo de proteção elevada (Cloudflare)"
          - "[ ] Escalar rate limiting"
          - "[ ] Considerar geo-blocking temporário"
          
        unauthorized_access:
          - "[ ] Terminar sessões suspeitas"
          - "[ ] Rotacionar secrets afetados"
          - "[ ] Habilitar MFA forçado"
          - "[ ] Auditar acessos recentes"
          
        ransomware:
          - "[ ] DESCONECTAR sistemas imediatamente"
          - "[ ] NÃO PAGAR resgate"
          - "[ ] Verificar integridade de backups"
          - "[ ] Contatar autoridades"

    # FASE 3: ERRADICAÇÃO (2h - 24h)
    eradication:
      steps:
        - "[ ] Identificar causa raiz"
        - "[ ] Remover acesso do atacante"
        - "[ ] Patchear vulnerabilidade explorada"
        - "[ ] Verificar persistência (backdoors)"
        - "[ ] Rotacionar todas as credenciais afetadas"
        - "[ ] Atualizar regras de firewall/WAF"
        
      forensics:
        - "[ ] Coletar logs de todos os sistemas afetados"
        - "[ ] Timeline do ataque"
        - "[ ] Vetores de entrada"
        - "[ ] Movimentação lateral"
        - "[ ] Dados exfiltrados (se aplicável)"

    # FASE 4: RECUPERAÇÃO (24h - 72h)
    recovery:
      steps:
        - "[ ] Restaurar sistemas de backups limpos"
        - "[ ] Verificar integridade dos dados"
        - "[ ] Monitoramento intensivo pós-recovery"
        - "[ ] Validar que ameaça foi eliminada"
        - "[ ] Restaurar serviço gradualmente"
        - "[ ] Comunicar clientes afetados"

    # FASE 5: PÓS-INCIDENTE (72h+)
    post_incident:
      steps:
        - "[ ] Documentar timeline completa"
        - "[ ] Post-mortem meeting (blameless)"
        - "[ ] Identificar melhorias"
        - "[ ] Atualizar playbooks"
        - "[ ] Treinar equipe em lições aprendidas"
        - "[ ] Relatório final para stakeholders"
```

### 6.2 Comunicação ANPD (72h)

```typescript
// incident/anpd-notification.ts

interface ANPDNotification {
  // Identificação do controlador
  controller: {
    name: string;
    cnpj: string;
    address: string;
    dpo_name: string;
    dpo_email: string;
    dpo_phone: string;
  };
  
  // Detalhes do incidente
  incident: {
    discovery_date: Date;
    occurrence_date: Date;
    description: string;
    affected_data_types: string[];
    affected_subjects_count: number;
    affected_subjects_categories: string[];
    cause: string;
    international_transfer: boolean;
  };
  
  // Riscos
  risks: {
    potential_consequences: string[];
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // Medidas
  measures: {
    containment_actions: string[];
    mitigation_actions: string[];
    prevention_actions: string[];
  };
  
  // Comunicação aos titulares
  subject_notification: {
    will_notify: boolean;
    notification_date?: Date;
    notification_method?: string;
    justification_if_not?: string;
  };
}

async function prepareANPDNotification(
  incidentId: string
): Promise<ANPDNotification> {
  const incident = await db
    .selectFrom('security_incidents')
    .where('id', '=', incidentId)
    .selectAll()
    .executeTakeFirst();
  
  if (!incident) {
    throw new Error('Incident not found');
  }
  
  return {
    controller: {
      name: "Bot-as-a-Service LTDA",
      cnpj: "XX.XXX.XXX/0001-XX",
      address: "Rua Example, 123 - São Paulo/SP",
      dpo_name: "[DPO Name]",
      dpo_email: "dpo@botservice.com",
      dpo_phone: "+55 11 XXXX-XXXX",
    },
    
    incident: {
      discovery_date: incident.discovered_at,
      occurrence_date: incident.occurred_at,
      description: incident.description,
      affected_data_types: incident.affected_data_types,
      affected_subjects_count: incident.affected_count,
      affected_subjects_categories: ["Usuários finais dos bots"],
      cause: incident.root_cause || "Em investigação",
      international_transfer: true, // Se dados passam por servers fora do Brasil
    },
    
    risks: {
      potential_consequences: incident.potential_consequences,
      risk_level: incident.risk_level,
    },
    
    measures: {
      containment_actions: incident.containment_actions,
      mitigation_actions: incident.mitigation_actions,
      prevention_actions: incident.prevention_actions,
    },
    
    subject_notification: {
      will_notify: incident.risk_level !== 'low',
      notification_date: incident.subject_notification_date,
      notification_method: "Email + Notificação in-app",
    },
  };
}

// Deadline tracker
async function checkANPDDeadline(incidentId: string): Promise<void> {
  const incident = await db
    .selectFrom('security_incidents')
    .where('id', '=', incidentId)
    .select(['discovered_at', 'anpd_notified_at', 'risk_level'])
    .executeTakeFirst();
  
  if (!incident || incident.risk_level === 'low') {
    return; // Low risk doesn't require notification
  }
  
  const deadline = new Date(incident.discovered_at);
  deadline.setHours(deadline.getHours() + 72);
  
  const hoursRemaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  
  if (!incident.anpd_notified_at && hoursRemaining < 24) {
    // Alert: 24h remaining
    await sendSlackAlert({
      channel: '#security-critical',
      message: `⚠️ ANPD notification deadline in ${hoursRemaining.toFixed(1)} hours for incident ${incidentId}`,
    });
  }
  
  if (!incident.anpd_notified_at && hoursRemaining < 0) {
    // CRITICAL: Deadline passed
    await sendSlackAlert({
      channel: '#security-critical',
      message: `🚨 CRITICAL: ANPD 72h deadline PASSED for incident ${incidentId}. Immediate action required!`,
    });
  }
}
```

### 6.3 Template de Notificação

```markdown
# COMUNICADO DE INCIDENTE DE SEGURANÇA

**Data:** [DD/MM/YYYY]
**Referência:** [INC-YYYY-XXXX]

---

## Para: Clientes Afetados

Prezado(a) Cliente,

Estamos entrando em contato para informá-lo sobre um incidente de segurança que pode ter afetado seus dados.

### O que aconteceu?

Em [DATA], identificamos [DESCRIÇÃO BREVE DO INCIDENTE]. Imediatamente iniciamos nossa resposta a incidentes e contivemos a situação em [TEMPO].

### Quais dados foram afetados?

Com base em nossa investigação, os seguintes tipos de dados podem ter sido afetados:

- [TIPO DE DADO 1]
- [TIPO DE DADO 2]
- [TIPO DE DADO 3]

**Dados financeiros (cartões de crédito, senhas bancárias) NÃO foram comprometidos.**

### O que estamos fazendo?

1. **Contenção:** [AÇÃO DE CONTENÇÃO]
2. **Investigação:** [STATUS DA INVESTIGAÇÃO]
3. **Notificação:** Comunicamos a Autoridade Nacional de Proteção de Dados (ANPD)
4. **Melhorias:** [MEDIDAS PREVENTIVAS]

### O que você pode fazer?

Como medida de precaução, recomendamos:

- [ ] Alterar sua senha de acesso ao dashboard
- [ ] Habilitar autenticação de dois fatores (MFA)
- [ ] Monitorar atividades incomuns em sua conta
- [ ] Rotacionar API keys utilizadas

### Precisa de ajuda?

Nossa equipe está disponível para esclarecer dúvidas:

- **Email:** security@botservice.com
- **Telefone:** +55 11 XXXX-XXXX
- **Chat:** app.botservice.com/support

Pedimos sinceras desculpas pelo transtorno. A segurança dos seus dados é nossa prioridade e estamos comprometidos em fortalecer ainda mais nossas defesas.

Atenciosamente,

[Nome]
[Cargo]
Bot-as-a-Service

---

*Esta comunicação está sendo enviada em conformidade com a Lei Geral de Proteção de Dados (LGPD), Lei nº 13.709/2018.*
```

---

## 7. Roadmap para Certificações

### 7.1 SOC 2 Type 1 - Requisitos

```yaml
# soc2-requirements.yaml
soc2:
  overview:
    type: "Type 1" # Point-in-time assessment
    trust_principles:
      - security    # OBRIGATÓRIO
      - availability
      - confidentiality
    timeline: "4-6 meses para Type 1"
    cost_estimate: "$30,000 - $80,000"

  requirements:

    # CC1: Control Environment
    control_environment:
      - name: "CC1.1 - COSO Principle 1"
        requirement: "Demonstrate commitment to integrity and ethical values"
        evidence:
          - "Code of Conduct document"
          - "Employee acknowledgments"
          - "Background check policy"
        status: "NOT_STARTED"
        
      - name: "CC1.2 - COSO Principle 2"
        requirement: "Board independence and oversight"
        evidence:
          - "Board meeting minutes"
          - "Audit committee charter"
        status: "NOT_STARTED"
        notes: "May need to establish formal board structure"

    # CC2: Communication and Information
    communication:
      - name: "CC2.1 - Internal Communication"
        requirement: "Internal communication of security responsibilities"
        evidence:
          - "Security policies communicated to employees"
          - "Security awareness training records"
          - "Policy acknowledgment forms"
        status: "PARTIAL"
        
      - name: "CC2.2 - External Communication"
        requirement: "Communication with external parties"
        evidence:
          - "Privacy policy (public)"
          - "Security whitepaper"
          - "Customer security documentation"
        status: "NOT_STARTED"

    # CC3: Risk Assessment
    risk_assessment:
      - name: "CC3.1 - Risk Identification"
        requirement: "Identify and assess risks"
        evidence:
          - "Risk assessment document"
          - "Risk register"
          - "Annual risk review process"
        status: "NOT_STARTED"
        
      - name: "CC3.2 - Fraud Risk"
        requirement: "Consider fraud risk"
        evidence:
          - "Fraud risk assessment"
          - "Anti-fraud controls"
        status: "NOT_STARTED"

    # CC4: Monitoring Activities
    monitoring:
      - name: "CC4.1 - Ongoing Monitoring"
        requirement: "Continuous monitoring of controls"
        evidence:
          - "Monitoring dashboards"
          - "Automated alerts"
          - "Regular security reviews"
        status: "PARTIAL"
        
      - name: "CC4.2 - Deficiency Evaluation"
        requirement: "Evaluate and remediate deficiencies"
        evidence:
          - "Issue tracking system"
          - "Remediation timelines"
          - "Management review records"
        status: "NOT_STARTED"

    # CC5: Control Activities
    control_activities:
      - name: "CC5.1 - Logical Access"
        requirement: "Restrict logical access"
        evidence:
          - "Access control policy"
          - "User access reviews (quarterly)"
          - "Privileged access management"
          - "MFA implementation"
        status: "IN_PROGRESS"
        
      - name: "CC5.2 - System Development"
        requirement: "Secure development lifecycle"
        evidence:
          - "SDLC documentation"
          - "Code review process"
          - "Security testing in CI/CD"
          - "Change management process"
        status: "PARTIAL"

    # CC6: Logical and Physical Access
    access_controls:
      - name: "CC6.1 - Authentication"
        requirement: "Authenticate users before access"
        evidence:
          - "Authentication policy"
          - "Password requirements"
          - "MFA records"
        status: "IN_PROGRESS"
        
      - name: "CC6.6 - External Threats"
        requirement: "Protect against external threats"
        evidence:
          - "Firewall configurations"
          - "IDS/IPS logs"
          - "Vulnerability scan results"
          - "Penetration test reports"
        status: "PARTIAL"

    # CC7: System Operations
    operations:
      - name: "CC7.1 - Vulnerability Management"
        requirement: "Detect and address vulnerabilities"
        evidence:
          - "Vulnerability management policy"
          - "Scan schedules and results"
          - "Patch management process"
        status: "NOT_STARTED"
        
      - name: "CC7.2 - Anomaly Detection"
        requirement: "Detect anomalies and security events"
        evidence:
          - "SIEM implementation"
          - "Alert configurations"
          - "Incident response procedures"
        status: "PARTIAL"

    # CC8: Change Management
    change_management:
      - name: "CC8.1 - Change Control"
        requirement: "Authorize, test, approve changes"
        evidence:
          - "Change management policy"
          - "Change request records"
          - "Testing documentation"
          - "Approval workflows"
        status: "PARTIAL"

    # CC9: Risk Mitigation
    risk_mitigation:
      - name: "CC9.1 - Vendor Risk"
        requirement: "Assess and manage vendor risk"
        evidence:
          - "Vendor management policy"
          - "Vendor risk assessments"
          - "Vendor contracts with security requirements"
        status: "NOT_STARTED"

  timeline:
    month_1:
      - "Gap assessment"
      - "Policy documentation"
      - "Select auditor"
      
    month_2_3:
      - "Implement missing controls"
      - "Document evidence"
      - "Staff training"
      
    month_4:
      - "Internal audit / readiness assessment"
      - "Remediate findings"
      
    month_5_6:
      - "External audit"
      - "Address audit findings"
      - "Report issuance"

  auditors:
    recommended:
      - name: "Prescient Assurance"
        specialization: "Startups, SaaS"
        cost: "$25,000 - $40,000"
        
      - name: "Vanta"
        specialization: "Automated compliance"
        cost: "$30,000 - $50,000 (includes tooling)"
        
      - name: "Drata"
        specialization: "Automated evidence collection"
        cost: "Similar to Vanta"
```

### 7.2 ISO 27001 - Gap Analysis

```yaml
# iso27001-gap-analysis.yaml
iso27001:
  overview:
    standard: "ISO/IEC 27001:2022"
    certification_body: "Accredited CB (e.g., BSI, DNV)"
    timeline: "8-12 meses"
    cost_estimate: "$50,000 - $150,000 (implementation + audit)"

  gap_analysis:

    # Clause 4: Context of the Organization
    clause_4:
      title: "Context of the Organization"
      
      requirements:
        - id: "4.1"
          title: "Understanding the organization"
          current_state: "NOT_DOCUMENTED"
          gap: "Need to document internal/external issues"
          action: "Create context analysis document"
          effort: "LOW"
          
        - id: "4.2"
          title: "Needs of interested parties"
          current_state: "PARTIAL"
          gap: "Stakeholder requirements not fully documented"
          action: "Document stakeholder requirements matrix"
          effort: "LOW"
          
        - id: "4.3"
          title: "Scope of ISMS"
          current_state: "NOT_DEFINED"
          gap: "ISMS scope not formally defined"
          action: "Define and document ISMS scope"
          effort: "MEDIUM"

    # Clause 5: Leadership
    clause_5:
      title: "Leadership"
      
      requirements:
        - id: "5.1"
          title: "Leadership commitment"
          current_state: "INFORMAL"
          gap: "No formal management commitment"
          action: "Obtain signed commitment from leadership"
          effort: "LOW"
          
        - id: "5.2"
          title: "Security policy"
          current_state: "PARTIAL"
          gap: "Policy exists but not ISO-aligned"
          action: "Review and update information security policy"
          effort: "MEDIUM"
          
        - id: "5.3"
          title: "Roles and responsibilities"
          current_state: "PARTIAL"
          gap: "Security roles not formally assigned"
          action: "Define and document security responsibilities"
          effort: "MEDIUM"

    # Clause 6: Planning
    clause_6:
      title: "Planning"
      
      requirements:
        - id: "6.1"
          title: "Risk assessment"
          current_state: "NOT_FORMAL"
          gap: "Risk assessment process not formalized"
          action: "Implement formal risk assessment methodology"
          effort: "HIGH"
          
        - id: "6.2"
          title: "Security objectives"
          current_state: "NOT_DEFINED"
          gap: "No measurable security objectives"
          action: "Define SMART security objectives"
          effort: "MEDIUM"

    # Clause 7: Support
    clause_7:
      title: "Support"
      
      requirements:
        - id: "7.1"
          title: "Resources"
          current_state: "INFORMAL"
          gap: "Security resources not formally allocated"
          action: "Document resource allocation for ISMS"
          effort: "LOW"
          
        - id: "7.2"
          title: "Competence"
          current_state: "PARTIAL"
          gap: "Training records incomplete"
          action: "Implement competency tracking"
          effort: "MEDIUM"
          
        - id: "7.3"
          title: "Awareness"
          current_state: "MINIMAL"
          gap: "No formal security awareness program"
          action: "Implement security awareness training"
          effort: "MEDIUM"

    # Clause 8: Operation
    clause_8:
      title: "Operation"
      
      requirements:
        - id: "8.1"
          title: "Operational planning"
          current_state: "INFORMAL"
          gap: "Security operations not fully planned"
          action: "Document operational procedures"
          effort: "MEDIUM"
          
        - id: "8.2"
          title: "Risk assessment execution"
          current_state: "NOT_DONE"
          gap: "No formal risk assessment conducted"
          action: "Conduct risk assessment"
          effort: "HIGH"
          
        - id: "8.3"
          title: "Risk treatment"
          current_state: "PARTIAL"
          gap: "Risk treatment plan incomplete"
          action: "Develop risk treatment plan"
          effort: "HIGH"

    # Clause 9: Performance Evaluation
    clause_9:
      title: "Performance Evaluation"
      
      requirements:
        - id: "9.1"
          title: "Monitoring and measurement"
          current_state: "PARTIAL"
          gap: "Security metrics not formalized"
          action: "Define KPIs and monitoring program"
          effort: "MEDIUM"
          
        - id: "9.2"
          title: "Internal audit"
          current_state: "NOT_IMPLEMENTED"
          gap: "No internal audit program"
          action: "Establish internal audit program"
          effort: "HIGH"
          
        - id: "9.3"
          title: "Management review"
          current_state: "NOT_FORMAL"
          gap: "No formal management review process"
          action: "Implement management review meetings"
          effort: "MEDIUM"

    # Clause 10: Improvement
    clause_10:
      title: "Improvement"
      
      requirements:
        - id: "10.1"
          title: "Nonconformity handling"
          current_state: "INFORMAL"
          gap: "No formal NCR process"
          action: "Implement nonconformity management"
          effort: "MEDIUM"
          
        - id: "10.2"
          title: "Continual improvement"
          current_state: "INFORMAL"
          gap: "Improvement not systematic"
          action: "Establish improvement framework"
          effort: "MEDIUM"

  # Annex A Controls Summary
  annex_a_summary:
    total_controls: 93
    
    status:
      implemented: 35
      partial: 28
      not_implemented: 25
      not_applicable: 5
    
    critical_gaps:
      - "A.5.7 - Threat intelligence"
      - "A.5.23 - Cloud security"
      - "A.8.8 - Vulnerability management"
      - "A.8.16 - Monitoring activities"
      - "A.8.28 - Secure coding"

  implementation_roadmap:
    phase_1_foundation: # Months 1-3
      - "Define ISMS scope"
      - "Create/update policies"
      - "Conduct risk assessment"
      - "Define security objectives"
      
    phase_2_implementation: # Months 4-6
      - "Implement critical controls"
      - "Security awareness training"
      - "Document procedures"
      - "Implement monitoring"
      
    phase_3_operation: # Months 7-9
      - "Operate ISMS"
      - "Collect evidence"
      - "Internal audit"
      - "Management review"
      
    phase_4_certification: # Months 10-12
      - "Stage 1 audit (documentation)"
      - "Address findings"
      - "Stage 2 audit (implementation)"
      - "Certification"
```

### 7.3 Timeline Estimado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CERTIFICATION ROADMAP - 18 MONTHS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  YEAR 1                                                                      │
│  ═══════                                                                     │
│                                                                              │
│  Q1 2025 (Jan-Mar)                                                          │
│  ├── Foundation                                                              │
│  │   ├── Security team expansion (hire 1-2)                                 │
│  │   ├── Policy documentation                                                │
│  │   ├── Implement compliance tooling (Vanta/Drata)                         │
│  │   └── Vendor risk assessments                                            │
│  │                                                                           │
│  Q2 2025 (Apr-Jun)                                                          │
│  ├── SOC 2 Type 1 Preparation                                               │
│  │   ├── Gap assessment with auditor                                        │
│  │   ├── Control implementation                                              │
│  │   ├── Evidence collection setup                                           │
│  │   └── Internal audit                                                      │
│  │                                                                           │
│  Q3 2025 (Jul-Sep)                                                          │
│  ├── SOC 2 Type 1 Audit                                                     │
│  │   ├── External audit engagement                                          │
│  │   ├── Remediate findings                                                  │
│  │   └── ✅ SOC 2 TYPE 1 REPORT                                             │
│  │                                                                           │
│  Q4 2025 (Oct-Dec)                                                          │
│  ├── ISO 27001 Preparation                                                  │
│  │   ├── ISMS scope definition                                              │
│  │   ├── Risk assessment                                                     │
│  │   ├── Control mapping (SOC2 → ISO)                                       │
│  │   └── Documentation update                                                │
│  │                                                                           │
│  YEAR 2                                                                      │
│  ═══════                                                                     │
│                                                                              │
│  Q1 2026 (Jan-Mar)                                                          │
│  ├── ISO 27001 Implementation                                               │
│  │   ├── Complete control implementation                                    │
│  │   ├── Internal audit program                                              │
│  │   ├── Management review                                                   │
│  │   └── Pre-audit assessment                                                │
│  │                                                                           │
│  Q2 2026 (Apr-Jun)                                                          │
│  ├── ISO 27001 Certification                                                │
│  │   ├── Stage 1 audit (documentation)                                      │
│  │   ├── Remediation                                                         │
│  │   ├── Stage 2 audit (implementation)                                     │
│  │   └── ✅ ISO 27001 CERTIFICATION                                         │
│  │                                                                           │
│  Q3-Q4 2026                                                                  │
│  ├── SOC 2 Type 2 (observation period starts)                               │
│  │   ├── 6-12 month observation period                                      │
│  │   └── Continuous monitoring                                               │
│  │                                                                           │
│  ✅ SOC 2 TYPE 2 REPORT (End of 2026)                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Checklist de Segurança

### 8.1 Pre-Launch Checklist

```yaml
# pre-launch-security-checklist.yaml
pre_launch_checklist:

  # INFRAESTRUTURA
  infrastructure:
    - id: "INFRA-001"
      item: "TLS 1.2+ em todas as conexões"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "INFRA-002"
      item: "WAF configurado e regras testadas"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "INFRA-003"
      item: "DDoS protection ativo"
      priority: "HIGH"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "INFRA-004"
      item: "Rate limiting implementado"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Backend"
      
    - id: "INFRA-005"
      item: "Secrets não estão em código/repos"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "All"
      
    - id: "INFRA-006"
      item: "Backups automatizados e testados"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "INFRA-007"
      item: "Logs centralizados funcionando"
      priority: "HIGH"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "INFRA-008"
      item: "Alertas de monitoramento configurados"
      priority: "HIGH"
      status: "[ ]"
      owner: "DevOps"

  # APLICAÇÃO
  application:
    - id: "APP-001"
      item: "Autenticação MFA disponível"
      priority: "HIGH"
      status: "[ ]"
      owner: "Backend"
      
    - id: "APP-002"
      item: "Sessions com timeout apropriado"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "Backend"
      
    - id: "APP-003"
      item: "CSRF protection habilitado"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Frontend"
      
    - id: "APP-004"
      item: "CSP headers configurados"
      priority: "HIGH"
      status: "[ ]"
      owner: "Frontend"
      
    - id: "APP-005"
      item: "Input validation em todas as rotas"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Backend"
      
    - id: "APP-006"
      item: "SQL injection prevention (parametrized queries)"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Backend"
      
    - id: "APP-007"
      item: "XSS prevention (output encoding)"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Frontend"
      
    - id: "APP-008"
      item: "File upload validation e sandboxing"
      priority: "HIGH"
      status: "[ ]"
      owner: "Backend"

  # MULTI-TENANCY
  multi_tenancy:
    - id: "MT-001"
      item: "Row Level Security habilitado em TODAS as tabelas"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Backend"
      
    - id: "MT-002"
      item: "Tenant isolation testado (unit + integration)"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "QA"
      
    - id: "MT-003"
      item: "Cross-tenant access bloqueado (pen test)"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Security"
      
    - id: "MT-004"
      item: "API keys scoped por tenant"
      priority: "HIGH"
      status: "[ ]"
      owner: "Backend"

  # COMPLIANCE
  compliance:
    - id: "COMP-001"
      item: "Privacy Policy publicada"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Legal"
      
    - id: "COMP-002"
      item: "Terms of Service publicados"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Legal"
      
    - id: "COMP-003"
      item: "Cookie banner implementado"
      priority: "HIGH"
      status: "[ ]"
      owner: "Frontend"
      
    - id: "COMP-004"
      item: "DPA template disponível"
      priority: "HIGH"
      status: "[ ]"
      owner: "Legal"
      
    - id: "COMP-005"
      item: "Processo DSR (LGPD) documentado"
      priority: "HIGH"
      status: "[ ]"
      owner: "Legal/Backend"
      
    - id: "COMP-006"
      item: "Data retention policies definidas"
      priority: "HIGH"
      status: "[ ]"
      owner: "Product"

  # INCIDENT RESPONSE
  incident_response:
    - id: "IR-001"
      item: "Playbook de incidentes documentado"
      priority: "HIGH"
      status: "[ ]"
      owner: "Security"
      
    - id: "IR-002"
      item: "Contatos de emergência definidos"
      priority: "HIGH"
      status: "[ ]"
      owner: "Management"
      
    - id: "IR-003"
      item: "Canal de comunicação de incidentes"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "IR-004"
      item: "Template de notificação ANPD pronto"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "Legal"

  # TESTES DE SEGURANÇA
  security_testing:
    - id: "TEST-001"
      item: "SAST (static analysis) no CI/CD"
      priority: "HIGH"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "TEST-002"
      item: "Dependency scanning configurado"
      priority: "HIGH"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "TEST-003"
      item: "DAST (dynamic testing) executado"
      priority: "HIGH"
      status: "[ ]"
      owner: "Security"
      
    - id: "TEST-004"
      item: "Penetration test realizado"
      priority: "CRITICAL"
      status: "[ ]"
      owner: "Security"
      notes: "Recomendado antes do launch"

  # DOCUMENTAÇÃO
  documentation:
    - id: "DOC-001"
      item: "Security whitepaper para clientes"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "Security"
      
    - id: "DOC-002"
      item: "Runbook de operações"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "DevOps"
      
    - id: "DOC-003"
      item: "Guia de segurança para desenvolvedores"
      priority: "MEDIUM"
      status: "[ ]"
      owner: "Security"

### 8.2 Ongoing Security Tasks

```yaml
# ongoing-security-tasks.yaml
ongoing_tasks:

  # DIÁRIO
  daily:
    - task: "Review security alerts"
      owner: "On-call engineer"
      automation: "PagerDuty/Slack alerts"
      
    - task: "Check failed login attempts"
      owner: "Automated"
      automation: "Dashboard alert if > threshold"
      
    - task: "Monitor rate limiting triggers"
      owner: "Automated"
      automation: "Alert on anomalies"

  # SEMANAL
  weekly:
    - task: "Review audit logs for anomalies"
      owner: "Security team"
      checklist:
        - "Unusual access patterns"
        - "Failed auth spikes"
        - "Cross-tenant attempts"
        - "Privilege escalations"
      
    - task: "Dependency vulnerability scan"
      owner: "Automated (Dependabot/Snyk)"
      action: "Review and merge patches"
      
    - task: "Check backup integrity"
      owner: "DevOps"
      action: "Verify backup completion and test restore"

  # MENSAL
  monthly:
    - task: "User access review"
      owner: "Engineering Lead + Security"
      checklist:
        - "Review admin access list"
        - "Remove inactive accounts"
        - "Verify role assignments"
        - "Check API key usage"
      
    - task: "Security metrics review"
      owner: "Security team"
      metrics:
        - "Mean time to detect (MTTD)"
        - "Mean time to respond (MTTR)"
        - "Vulnerabilities open/closed"
        - "Security training completion"
      
    - task: "Secret rotation check"
      owner: "DevOps"
      action: "Verify secrets are within rotation schedule"
      
    - task: "Cloud security posture review"
      owner: "DevOps"
      action: "Review cloud security settings, IAM policies"

  # TRIMESTRAL
  quarterly:
    - task: "Vulnerability assessment"
      owner: "Security team / External"
      scope:
        - "Infrastructure scan"
        - "Application scan"
        - "Container scan"
      
    - task: "Disaster recovery test"
      owner: "DevOps"
      action: "Full restore test from backups"
      
    - task: "Incident response drill"
      owner: "Security team"
      action: "Tabletop exercise or simulation"
      
    - task: "Vendor security review"
      owner: "Security team"
      action: "Review vendor SOC2 reports and security updates"
      
    - task: "Policy review and update"
      owner: "Security team + Legal"
      action: "Review all security policies for accuracy"

  # ANUAL
  annual:
    - task: "Penetration test"
      owner: "External firm"
      scope:
        - "External pentest"
        - "Internal pentest"
        - "Social engineering (optional)"
      
    - task: "Full risk assessment"
      owner: "Security team"
      action: "Review and update risk register"
      
    - task: "Security awareness training refresh"
      owner: "HR + Security"
      action: "Mandatory training for all employees"
      
    - task: "Business continuity plan review"
      owner: "Management"
      action: "Update BCP based on changes"
      
    - task: "Compliance audit preparation"
      owner: "Security team"
      action: "Prepare for SOC2/ISO audits"

  # BASEADO EM EVENTOS
  event_driven:
    - event: "New employee onboarding"
      tasks:
        - "Security training"
        - "Access provisioning"
        - "NDA signing"
        - "Acceptable use policy acknowledgment"
      
    - event: "Employee offboarding"
      tasks:
        - "Revoke all access (same day)"
        - "Transfer ownership of resources"
        - "Exit interview (security)"
        - "Collect company devices"
      
    - event: "Security incident"
      tasks:
        - "Follow incident response playbook"
        - "Post-incident review"
        - "Update playbook if needed"
      
    - event: "Major release"
      tasks:
        - "Security review"
        - "Penetration test (for major features)"
        - "Update threat model"
      
    - event: "New vendor/integration"
      tasks:
        - "Vendor security assessment"
        - "Data flow analysis"
        - "Contract security review"
        - "Update subprocessor list"
```

---

## Apêndice A: Security Contacts

```yaml
security_contacts:
  internal:
    security_team: security@botservice.com
    dpo: dpo@botservice.com
    incident_hotline: +55 11 XXXX-XXXX
    
  external:
    responsible_disclosure: security@botservice.com
    bug_bounty: "via HackerOne (quando disponível)"
    
  authorities:
    anpd: 
      email: "anpd@anpd.gov.br"
      portal: "https://www.gov.br/anpd"
      prazo: "72 horas para notificação de incidentes"
```

---

## Apêndice B: Version History

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | 2025-01-29 | [Author] | Documento inicial |

---

*Este documento deve ser revisado trimestralmente ou quando houver mudanças significativas na arquitetura ou regulamentação.*