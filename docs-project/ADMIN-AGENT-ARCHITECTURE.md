# Admin Agent - Arquitetura

## Conceito

Cada cliente/empresa tem um **Admin Agent** que:
- Supervisiona todos os outros agentes da conta
- Monitora saúde e performance
- Aplica correções automáticas
- Escala problemas para humanos quando necessário

```
┌─────────────────────────────────────────────────────┐
│                    EMPRESA X                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────┐                                  │
│   │ ADMIN AGENT  │ ◄── Supervisiona tudo            │
│   │   (Lobo)     │                                  │
│   └──────┬───────┘                                  │
│          │                                          │
│    ┌─────┴─────┬─────────┬─────────┐               │
│    ▼           ▼         ▼         ▼               │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │
│ │ Bot  │  │ Bot  │  │ Bot  │  │ Bot  │            │
│ │Vendas│  │Suport│  │ RH   │  │Custom│            │
│ └──────┘  └──────┘  └──────┘  └──────┘            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Responsabilidades do Admin Agent

### 1. Health Monitoring
- Heartbeat de todos os bots a cada 5 min
- Verifica se estão respondendo
- Monitora latência e erros

### 2. Auto-Healing
- Detecta bot travado → reinicia
- Detecta config inválida → reverte
- Detecta OOM → ajusta limites ou alerta

### 3. Observabilidade
- Dashboard unificado de todos os bots
- Métricas agregadas (msgs/dia, tempo resposta, custos)
- Logs centralizados

### 4. Governança
- Aplica políticas da empresa (horário, tom, limites)
- Audita conversas sensíveis
- Garante compliance

### 5. Escalation
- Problemas críticos → notifica admin humano
- Conversas complexas → handoff inteligente
- Anomalias → alerta imediato

## Implementação no BaaS

### Database Schema (Prisma)

```prisma
model AdminAgent {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  // Config
  name        String   @default("Admin")
  personality Json?    // Personalidade do admin
  
  // Monitored bots
  bots        Bot[]
  
  // Health config
  healthCheckIntervalMs  Int @default(300000) // 5 min
  maxRestartAttempts     Int @default(3)
  alertThresholdMs       Int @default(30000)  // 30s response time
  
  // Notifications
  alertEmail    String?
  alertWhatsApp String?
  alertWebhook  String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model BotHealthLog {
  id        String   @id @default(cuid())
  botId     String
  bot       Bot      @relation(fields: [botId], references: [id])
  
  status    BotHealthStatus
  latencyMs Int?
  error     String?
  action    String?  // "restart", "alert", "auto-fix"
  
  createdAt DateTime @default(now())
}

enum BotHealthStatus {
  HEALTHY
  DEGRADED
  UNHEALTHY
  RESTARTING
  DEAD
}
```

### API Endpoints

```
GET  /api/admin/health           # Status de todos os bots
GET  /api/admin/bots             # Lista bots supervisionados
POST /api/admin/bots/:id/restart # Reinicia bot específico
GET  /api/admin/alerts           # Alertas ativos
POST /api/admin/config           # Atualiza config do admin agent
GET  /api/admin/metrics          # Métricas agregadas
```

### Cron Jobs

```typescript
// Health check a cada 5 min
cron.schedule('*/5 * * * *', async () => {
  const bots = await getBotsByTenant(tenantId)
  
  for (const bot of bots) {
    const health = await checkBotHealth(bot)
    
    if (health.status === 'UNHEALTHY') {
      await attemptAutoHeal(bot)
    }
    
    if (health.status === 'DEAD') {
      await notifyAdmin(bot, 'Bot não responde')
    }
  }
})
```

## Fluxo de Auto-Healing

```
Bot não responde (30s timeout)
         │
         ▼
   Tentar restart
         │
    ┌────┴────┐
    │ Sucesso │──► Log + continua monitorando
    └────┬────┘
         │ Falha (3x)
         ▼
   Analisar causa
         │
    ┌────┴────┐
    │  OOM?   │──► Reduzir limites ou alertar upgrade
    └────┬────┘
         │
    ┌────┴────┐
    │ Config? │──► Reverter última config
    └────┬────┘
         │
    ┌────┴────┐
    │ Unknown │──► Alertar admin humano
    └─────────┘
```

## Aprendizados Integrados

### Do incidente de hoje (2026-01-31):

1. **Validação de Config**
   - Sempre validar JSON/schema antes de aplicar
   - Manter backup da última config funcional
   - Rollback automático se falhar

2. **Monitoramento de Recursos**
   - Detectar OOM antes que mate o processo
   - Alertar quando memória > 80%
   - Limitar processos pesados (Whisper, builds)

3. **Redundância de Acesso**
   - Health check endpoint público
   - Múltiplos canais de alerta (email, WhatsApp, webhook)
   - Terminal de emergência (Tailscale)

4. **Graceful Degradation**
   - Se um bot cair, outros continuam
   - Fallback para respostas simples se AI falhar
   - Queue de mensagens para retry

## Próximos Passos

1. [ ] Criar modelo AdminAgent no Prisma
2. [ ] Implementar health check básico
3. [ ] Dashboard de status dos bots
4. [ ] Sistema de alertas
5. [ ] Auto-restart de bots
6. [ ] Rollback automático de config
7. [ ] Métricas e logs centralizados
