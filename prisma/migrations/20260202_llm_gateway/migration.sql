-- CreateEnum
CREATE TYPE "LLMProviderType" AS ENUM ('CLAUDE_MAX', 'CLAUDE_API', 'OPENAI_API', 'GOOGLE_API', 'LOCAL');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'RATE_LIMITED', 'CIRCUIT_OPEN', 'MAINTENANCE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LLMRequestType" AS ENUM ('CHAT', 'COMPLETION', 'EMBEDDING', 'FUNCTION_CALL', 'VISION', 'AUDIO');

-- CreateEnum
CREATE TYPE "LLMAlertType" AS ENUM ('BUDGET_WARNING', 'BUDGET_CRITICAL', 'BUDGET_EXCEEDED', 'DAILY_WARNING', 'DAILY_EXCEEDED', 'PROVIDER_ERROR', 'RATE_LIMIT');

-- AlterTable - Add budget fields to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "monthlyBudget" DOUBLE PRECISION;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "dailyLimit" DOUBLE PRECISION;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "alertThresholds" JSONB DEFAULT '[0.2, 0.1, 0.05, 0.01]';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "llmSuspended" BOOLEAN DEFAULT false;

-- CreateTable: LLM Provider Pool
CREATE TABLE "LLMProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LLMProviderType" NOT NULL,
    "endpoint" TEXT,
    "model" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "costPerInputToken" DOUBLE PRECISION NOT NULL DEFAULT 0.000003,
    "costPerOutputToken" DOUBLE PRECISION NOT NULL DEFAULT 0.000015,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Provider Status History (Circuit Breaker)
CREATE TABLE "ProviderStatusHistory" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "fromStatus" "ProviderStatus" NOT NULL,
    "toStatus" "ProviderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Tenant Agents (Alcateia)
CREATE TABLE "TenantAgent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "preferredModel" TEXT,
    "dailyLimit" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Usage (Per-request tracking)
CREATE TABLE "LLMUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestType" "LLMRequestType" NOT NULL DEFAULT 'CHAT',
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "channel" TEXT,
    "groupId" TEXT,
    "sessionId" TEXT,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Usage Alerts
CREATE TABLE "LLMUsageAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "LLMAlertType" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "currentUsage" DOUBLE PRECISION NOT NULL,
    "limitValue" DOUBLE PRECISION NOT NULL,
    "percentUsed" DOUBLE PRECISION NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "slackSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LLMUsageAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Rate Limit Entries
CREATE TABLE "LLMRateLimitEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMRateLimitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LLMProvider_name_key" ON "LLMProvider"("name");
CREATE INDEX "LLMProvider_status_priority_idx" ON "LLMProvider"("status", "priority");

CREATE INDEX "ProviderStatusHistory_providerId_idx" ON "ProviderStatusHistory"("providerId");
CREATE INDEX "ProviderStatusHistory_createdAt_idx" ON "ProviderStatusHistory"("createdAt");

CREATE UNIQUE INDEX "TenantAgent_tenantId_name_key" ON "TenantAgent"("tenantId", "name");
CREATE INDEX "TenantAgent_tenantId_idx" ON "TenantAgent"("tenantId");

CREATE INDEX "LLMUsage_tenantId_idx" ON "LLMUsage"("tenantId");
CREATE INDEX "LLMUsage_agentId_idx" ON "LLMUsage"("agentId");
CREATE INDEX "LLMUsage_providerId_idx" ON "LLMUsage"("providerId");
CREATE INDEX "LLMUsage_createdAt_idx" ON "LLMUsage"("createdAt");
CREATE INDEX "LLMUsage_tenantId_createdAt_idx" ON "LLMUsage"("tenantId", "createdAt");
CREATE INDEX "LLMUsage_model_idx" ON "LLMUsage"("model");

CREATE INDEX "LLMUsageAlert_tenantId_idx" ON "LLMUsageAlert"("tenantId");
CREATE INDEX "LLMUsageAlert_type_idx" ON "LLMUsageAlert"("type");
CREATE INDEX "LLMUsageAlert_createdAt_idx" ON "LLMUsageAlert"("createdAt");
CREATE INDEX "LLMUsageAlert_acknowledged_idx" ON "LLMUsageAlert"("acknowledged");

CREATE UNIQUE INDEX "LLMRateLimitEntry_key_key" ON "LLMRateLimitEntry"("key");
CREATE INDEX "LLMRateLimitEntry_windowEnd_idx" ON "LLMRateLimitEntry"("windowEnd");

-- AddForeignKey
ALTER TABLE "ProviderStatusHistory" ADD CONSTRAINT "ProviderStatusHistory_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LLMProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantAgent" ADD CONSTRAINT "TenantAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LLMUsage" ADD CONSTRAINT "LLMUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LLMUsage" ADD CONSTRAINT "LLMUsage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TenantAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LLMUsage" ADD CONSTRAINT "LLMUsage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LLMProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LLMUsageAlert" ADD CONSTRAINT "LLMUsageAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
