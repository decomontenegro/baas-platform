# Routes Audit Report - BaaS Dashboard

**Generated:** 2026-01-31  
**App:** Next.js 15 App Router  
**URL:** http://localhost:3001

---

## 📁 Directory Structure

```
src/app/
├── layout.tsx                          # Root layout
├── page.tsx                            # Redirects to /dashboard
├── (auth)/
│   ├── layout.tsx                      # Auth layout (dark gradient bg)
│   ├── login/page.tsx                  # ✅ Login page
│   └── verify/page.tsx                 # ✅ Email verification page
├── (dashboard)/
│   ├── layout.tsx                      # Dashboard layout (sidebar + header)
│   ├── page.tsx                        # ✅ Overview page (main dashboard)
│   ├── dashboard/page.tsx              # ⚠️ DUPLICATE - another dashboard
│   ├── behavior/page.tsx               # ✅ Personality config
│   ├── channels/
│   │   ├── page.tsx                    # ✅ Channels list
│   │   └── [id]/page.tsx               # ✅ Channel detail
│   └── settings/page.tsx               # ✅ Settings page
└── api/
    ├── auth/[...nextauth]/route.ts     # ✅ NextAuth endpoints
    ├── auth/magic-link/route.ts        # ✅ Magic link
    ├── channels/route.ts               # ✅ Channels CRUD
    ├── channels/[id]/route.ts          # ✅ Channel by ID
    ├── channels/[id]/test/route.ts     # ✅ Channel test
    ├── personalities/route.ts          # ✅ Personalities CRUD
    ├── personalities/[id]/route.ts     # ✅ Personality by ID
    ├── personalities/[id]/preview/route.ts # ✅ Preview
    ├── workspaces/route.ts             # ✅ Workspaces
    ├── workspaces/[id]/route.ts        # ✅ Workspace by ID
    ├── tenants/route.ts                # ✅ Tenants
    ├── analytics/overview/route.ts     # ✅ Analytics overview
    ├── analytics/usage/route.ts        # ✅ Analytics usage
    ├── billing/route.ts                # ✅ Billing
    ├── features/route.ts               # ✅ Features
    ├── specialists/route.ts            # ✅ Specialists
    ├── gdpr/delete/route.ts            # ✅ GDPR delete
    ├── gdpr/export/route.ts            # ✅ GDPR export
    ├── docs/route.ts                   # ✅ API docs
    ├── docs/ui/route.ts                # ✅ Docs UI
    └── clawdbot/
        ├── webhook/route.ts            # ✅ Clawdbot webhook
        ├── groups/route.ts             # ✅ Groups list
        └── groups/[id]/config/route.ts # ✅ Group config
```

---

## 🧪 HTTP Route Tests (curl -sI)

| Route | Status | Notes |
|-------|--------|-------|
| `/` | **307** | Redirects to /dashboard ✅ |
| `/login` | **200** | OK ✅ |
| `/verify` | **200** | OK ✅ |
| `/dashboard` | **307** | Redirects to /app ⚠️ (unexpected) |
| `/channels` | **307** | Redirects (auth required) ✅ |
| `/channels/test-123` | **307** | Redirects (auth required) ✅ |
| `/behavior` | **307** | Redirects (auth required) ✅ |
| `/settings` | **307** | Redirects (auth required) ✅ |
| `/api/auth/providers` | **400** | Bad Request ⚠️ |
| `/api/channels` | **307** | Redirects (auth required) ✅ |
| `/api/personalities` | **307** | Redirects (auth required) ✅ |

### Legend
- **200**: Route works correctly
- **307**: Temporary redirect (usually auth middleware)
- **400**: Bad request (potential issue)
- **404**: Not found (route missing)

---

## ⚠️ Issues Found

### 1. Duplicate Dashboard Route
- **`/(dashboard)/page.tsx`** - Overview page (main dashboard)
- **`/(dashboard)/dashboard/page.tsx`** - Another dashboard page

The `/dashboard` route redirects to `/app` which doesn't exist in the route structure. This suggests:
- Either middleware is redirecting incorrectly
- Or there's a leftover redirect from old code

**Recommendation:** Remove `/(dashboard)/dashboard/page.tsx` or consolidate.

### 2. `/api/auth/providers` Returns 400
This is a NextAuth endpoint that should return available auth providers. A 400 response might indicate:
- Missing or invalid `NEXTAUTH_URL` environment variable
- Configuration issue in NextAuth setup

### 3. TypeScript Errors (30 errors total)

**Critical (breaking):**
```
src/app/api/channels/[id]/route.ts(3,10): error TS2614: Module '"@/lib/auth"' has no exported member 'auth'. Did you mean to use 'import auth from "@/lib/auth"' instead?
src/app/api/channels/[id]/test/route.ts(3,10): error TS2614: Module '"@/lib/auth"' has no exported member 'auth'.
src/app/api/channels/route.ts(3,10): error TS2614: Module '"@/lib/auth"' has no exported member 'auth'.
src/app/api/tenants/route.ts(3,10): error TS2614: Module '"@/lib/auth"' has no exported member 'auth'.
```

**Auth module export issue:** The `@/lib/auth` module uses default export but is being imported as named export.

**Prisma JSON type issues:**
```
src/app/api/channels/[id]/route.ts: Type '{ [x: string]: unknown; }' is not assignable to type 'JsonNull | InputJsonValue'
src/app/api/channels/route.ts: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue'
src/app/api/tenants/route.ts: Type '{ [x: string]: unknown; }' is not assignable to type 'JsonNull | InputJsonValue'
```

**Unused variables (warnings):**
```
src/app/(auth)/verify/page.tsx: 'type' declared but never read
src/app/(dashboard)/channels/[id]/page.tsx: 'router' declared but never read
src/app/(dashboard)/channels/page.tsx: 'Filter', 'Trash2', 'Edit' declared but never read
src/app/api/clawdbot/webhook/route.ts: Multiple unused variables
```

---

## ✅ Components Verified

All imported components exist:

**Dashboard Components (`/components/dashboard/`):**
- ✅ header.tsx
- ✅ sidebar.tsx
- ✅ mobile-sidebar.tsx

**Layout Components (`/components/layout/`):**
- ✅ header.tsx
- ✅ sidebar.tsx

**UI Components (`/components/ui/`):**
- ✅ badge.tsx
- ✅ button.tsx
- ✅ card.tsx
- ✅ dialog.tsx
- ✅ dropdown-menu.tsx
- ✅ input.tsx
- ✅ modal.tsx
- ✅ select.tsx
- ✅ skeleton.tsx
- ✅ slider.tsx
- ✅ sparkline.tsx
- ✅ stat-card.tsx
- ✅ tabs.tsx
- ✅ toast.tsx
- ✅ skip-link.tsx

**Hooks (`/hooks/`):**
- ✅ use-analytics.ts
- ✅ use-channels.ts
- ✅ use-current-user.ts
- ✅ use-personality.ts

---

## 📊 Summary

| Category | Count |
|----------|-------|
| Page routes | 8 |
| API routes | 20 |
| TypeScript errors | 30 |
| Routes working (200) | 2 |
| Routes with auth redirect (307) | 8 |
| Routes with issues | 1 (400) |

---

## 🔧 Recommended Fixes

### Priority 1: Fix Auth Module Import
```typescript
// Change from:
import { auth } from "@/lib/auth"

// To:
import auth from "@/lib/auth"
```

### Priority 2: Fix Prisma JSON Types
Cast JSON objects properly:
```typescript
// Instead of:
config: body.config

// Use:
config: body.config as Prisma.InputJsonValue
```

### Priority 3: Remove Unused Variables
Clean up unused imports and variables flagged by TypeScript.

### Priority 4: Investigate /dashboard Route
Check middleware or remove duplicate `/(dashboard)/dashboard/page.tsx`.

---

*Report generated by Clawdbot audit subagent*
