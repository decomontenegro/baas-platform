# 🔐 Auth System Evaluation - BaaS Dashboard

**Avaliado em:** 2025-01-24  
**Versão:** NextAuth v5 + Resend Magic Links + Prisma  
**Nota Geral:** 6.5/10

---

## 📊 Resumo Executivo

O sistema usa NextAuth v5 com magic links (Resend) e JWT sessions. É uma base sólida, mas há gaps significativos em rate limiting, CSRF explícito, e invalidação completa de sessões.

---

## 1. Segurança do Magic Link

### ✅ Pontos Positivos
- **Single-use tokens**: NextAuth/PrismaAdapter garante uso único (`VerificationToken` é deletado após uso)
- **Expiration**: UI mostra "24 hours" (NextAuth default é 24h)
- **Provider confiável**: Resend é um provedor email robusto

### ❌ Gaps Críticos
- **SEM rate limiting** para requisições de magic link
  - Atacante pode fazer email bombing
  - Custo de emails pode disparar
- **Expiration muito longa**: 24h é excessivo para magic links

### 🛠️ Hardening Recomendado

```typescript
// lib/auth.ts - Adicionar rate limiting
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "5m"), // 3 emails por 5 min
})

// No callback signIn:
async signIn({ user, email }) {
  if (email?.verificationRequest) {
    const { success } = await ratelimit.limit(user.email!)
    if (!success) return false // Rate limited
  }
  return true
}
```

```typescript
// Reduzir expiração para 15 minutos
providers: [
  Resend({
    maxAge: 15 * 60, // 15 min
    // ...
  }),
],
```

**Score: 5/10**

---

## 2. Session Management

### ✅ Pontos Positivos
- **JWT strategy** bem configurado
- **30 dias de sessão** razoável para dashboard
- **Token contém tenant/role** - bom para multi-tenancy
- **Session update** funciona para troca de tenant

### ❌ Gaps
- **SEM refresh token rotation**
- **SEM blacklist de tokens** (logout não invalida JWT)
- **JWT não tem `jti`** (impossível revogar tokens específicos)

### 🛠️ Hardening Recomendado

```typescript
// Adicionar jti para revogação
async jwt({ token, user }) {
  if (user) {
    token.jti = crypto.randomUUID()
    // Salvar jti no Redis/DB para permitir revogação
  }
  return token
}

// Verificar blacklist em cada request
async session({ session, token }) {
  const isBlacklisted = await redis.get(`blacklist:${token.jti}`)
  if (isBlacklisted) throw new Error("Token revoked")
  // ...
}
```

**Score: 6/10**

---

## 3. CSRF Protection

### ✅ Pontos Positivos
- NextAuth usa **CSRF tokens internamente** para forms
- Cookies com `SameSite` (default NextAuth)

### ❌ Gaps
- **Nenhuma proteção CSRF explícita** nas API routes
- API routes aceitam requests sem verificação de origin
- Falta header `Origin` validation

### 🛠️ Hardening Recomendado

```typescript
// middleware.ts - Adicionar validação de origin para mutations
const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL,
  "https://app.baas.dev"
]

export default auth((req) => {
  if (req.method !== "GET") {
    const origin = req.headers.get("origin")
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      )
    }
  }
  // ...
})
```

**Score: 5/10**

---

## 4. Token Storage

### ✅ Pontos Positivos
- NextAuth usa **httpOnly cookies** por default
- Cookies têm `Secure` flag em produção
- `SameSite=Lax` por default

### ❌ Gaps
- **Falta verificar** se `NEXTAUTH_URL` está HTTPS em prod
- Nenhum **cookie prefix** (`__Host-` ou `__Secure-`)

### 🛠️ Hardening Recomendado

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
]

// .env.production
NEXTAUTH_URL=https://app.baas.dev
```

```typescript
// auth.ts - Cookie prefixes
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    },
  },
},
```

**Score: 7/10**

---

## 5. Multi-Tenancy / Tenant Isolation

### ✅ Pontos Positivos
- **Tenant ID no JWT** - presente em cada request
- **Queries filtradas por tenant** (`where: { tenantId }`)
- **Middleware verifica tenant** para rotas protegidas
- **Onboarding flow** para usuários sem tenant

### ❌ Gaps
- **Falta membership model** - código referencia `memberships` mas schema não tem
- Usuário só tem **1 tenant direto** (não suporta múltiplos)
- **Sem verificação de tenant no callback JWT** - confia no DB

### 🛠️ Hardening Recomendado

```typescript
// Adicionar ao schema.prisma
model TenantMembership {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  role      UserRole @default(MEMBER)
  status    String   @default("active")
  
  @@unique([userId, tenantId])
}
```

```typescript
// API routes - sempre verificar tenant
export async function GET(request: NextRequest) {
  const session = await requireAuth()
  const tenantId = session.user.tenantId
  
  // CRÍTICO: Verificar que o recurso pertence ao tenant
  const workspace = await prisma.workspace.findFirst({
    where: { 
      id: params.id,
      tenantId, // <-- SEMPRE filtrar
    },
  })
  
  if (!workspace) throw new NotFoundError()
}
```

**Score: 7/10**

---

## 6. Error Handling

### ✅ Pontos Positivos
- **Errors genéricos** - não vaza stack traces
- **handleApiError** sanitiza respostas
- **Prisma errors mapeados** corretamente
- **Login errors** traduzidos para mensagens user-friendly

### ❌ Gaps
- **console.log de debug** em auth events pode vazar emails em logs
- **`debug: true` em dev** - ok, mas verificar prod

### 🛠️ Hardening Recomendado

```typescript
// auth.ts - Remover logs de email
events: {
  async signIn({ user, isNewUser }) {
    // NÃO logar email completo
    console.log(`[Auth] Sign in: user_${user.id?.slice(0, 8)} (new: ${isNewUser})`)
  },
},

// Garantir debug off em prod
debug: process.env.NODE_ENV === "development",
```

**Score: 8/10**

---

## 7. UX do Fluxo de Login

### ✅ Pontos Positivos
- **Loading states** claros (`isPending`, Loader2 spinner)
- **Email sent confirmation** - tela dedicada com instruções
- **Error messages** traduzidas e claras
- **Auto-redirect** após login
- **callbackUrl** preservado
- **Spam folder hint** - boa UX

### ❌ Gaps
- **Sem resend button com cooldown** - usuário tem que clicar "try again"
- **Sem link profundo** - email poderia abrir app diretamente

### 🛠️ Hardening Recomendado

```typescript
// login/page.tsx - Adicionar resend com cooldown
const [resendCooldown, setResendCooldown] = useState(0)

const handleResend = async () => {
  if (resendCooldown > 0) return
  await signIn("resend", { email, redirect: false })
  setResendCooldown(60) // 60 segundos
}

useEffect(() => {
  if (resendCooldown > 0) {
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }
}, [resendCooldown])
```

**Score: 8/10**

---

## 8. Logout Completo

### ✅ Pontos Positivos
- **signOut** limpa cookie de sessão
- **Redirect para /login** após logout

### ❌ Gaps Críticos
- **JWT não é invalidado** - token continua válido até expirar (30 dias!)
- **Sem "logout all devices"**
- **Sem revogação server-side**

### 🛠️ Hardening Recomendado

```typescript
// Opção 1: Usar database sessions (mais seguro)
session: {
  strategy: "database", // <-- Muda de JWT para DB
  maxAge: 30 * 24 * 60 * 60,
},

// Opção 2: JWT com blacklist (se precisa de JWT)
events: {
  async signOut({ token }) {
    if (token?.jti) {
      await redis.set(`blacklist:${token.jti}`, "1", { ex: 30 * 24 * 60 * 60 })
    }
  },
},

// Logout all devices
async function logoutAllDevices(userId: string) {
  // Se usando database sessions:
  await prisma.session.deleteMany({ where: { userId } })
  
  // Se usando JWT com blacklist:
  await redis.set(`user-logout:${userId}`, Date.now())
}
```

**Score: 4/10** ⚠️

---

## 📋 Resumo das Notas

| Critério | Nota | Prioridade |
|----------|------|------------|
| 1. Magic Link Security | 5/10 | 🔴 Alta |
| 2. Session Management | 6/10 | 🟡 Média |
| 3. CSRF Protection | 5/10 | 🟡 Média |
| 4. Token Storage | 7/10 | 🟢 Baixa |
| 5. Multi-Tenancy | 7/10 | 🟡 Média |
| 6. Error Handling | 8/10 | 🟢 Baixa |
| 7. Login UX | 8/10 | 🟢 Baixa |
| 8. Logout Completo | 4/10 | 🔴 Alta |

**Média Ponderada: 6.5/10**

---

## 🎯 Prioridades de Hardening

### 🔴 Crítico (Fazer AGORA)

1. **Rate limiting em magic links**
   - Upstash Ratelimit ou similar
   - 3-5 requests por 5 minutos por email

2. **Logout server-side**
   - Migrar para database sessions OU
   - Implementar JWT blacklist com Redis

### 🟡 Importante (Sprint 2)

3. **CSRF em API routes**
   - Validar Origin header
   - Double-submit cookie pattern

4. **Reduzir expiração do magic link**
   - De 24h para 15-30 minutos

5. **TenantMembership model**
   - Suportar múltiplos tenants por usuário
   - Roles por tenant

### 🟢 Nice to Have

6. **Cookie prefixes** (`__Secure-`)
7. **Resend com cooldown** no UI
8. **Logout de todos os devices**

---

## 🔧 Quick Wins (< 1 hora cada)

```typescript
// 1. Reduzir magic link expiration
providers: [
  Resend({
    maxAge: 15 * 60, // 15 min
  }),
],

// 2. Remover logs de email
events: {
  async signIn({ user }) {
    console.log(`[Auth] Sign in: ${user.id}`)
  },
},

// 3. Forçar HTTPS
// next.config.js
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    ],
  }]
},
```

---

## 📚 Recursos

- [NextAuth Security Best Practices](https://next-auth.js.org/getting-started/security)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)

---

*Avaliação realizada por Claude (subagent eval-auth)*
