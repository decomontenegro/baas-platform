# BaaS v2 - Multi-Tenant Architecture

## Visão Geral

Sistema multi-tenant com isolamento flexível via Workers (VMs).

```
                    BaaS Dashboard
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │Cliente A│     │Cliente B│     │Cliente C│
    │ (Grande)│     │ (Médio) │     │(Pequeno)│
    └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │
    ┌────┼────┐     ┌────┴────┐          │
    │    │    │     │         │          │
    ▼    ▼    ▼     ▼         ▼          ▼
   VM   VM   VM    VM        VM         VM
   Fin  Ops  Atend Fin      Geral      Única
```

## Níveis de Isolamento

### Cliente A - Empresa Grande
Quer separação interna por departamento:
- **VM 1**: Financeiro/Tributário
- **VM 2**: Operações  
- **VM 3**: Atendimento

### Cliente B - Média Empresa
Separação básica:
- **VM 1**: Financeiro (dados sensíveis isolados)
- **VM 2**: Todo o resto

### Cliente C - Pequena Empresa
Simplicidade:
- **VM única** para tudo

## Regras do Dashboard

1. **Cliente vê só os Workers dele** - isolamento completo
2. **Pode criar quantos Workers quiser** - self-service
3. **Escolhe em qual Worker cada bot roda** - flexibilidade
4. **Cliente decide o nível de isolamento** - não é imposto

## Modelo de Dados

```prisma
model Tenant {
  id        String   @id
  name      String
  plan      Plan     // FREE, PRO, ENTERPRISE
  workers   Worker[]
  // ...
}

model Worker {
  id        String   @id
  name      String   // "Financeiro", "Atendimento", etc.
  tenantId  String
  tenant    Tenant   @relation(...)
  bots      Bot[]
  // VM/container config
  resources Json     // CPU, RAM limits
  status    WorkerStatus
}

model Bot {
  id        String   @id
  workerId  String
  worker    Worker   @relation(...)
  // ...
}
```

## Implementação Necessária

### Backend
- [ ] API de CRUD de Workers
- [ ] Worker provisioning (Docker/K8s)
- [ ] Resource allocation por Worker
- [ ] Billing por Worker/uso

### Frontend
- [ ] Worker selector no dashboard
- [ ] Create/manage Workers UI
- [ ] Bot → Worker assignment
- [ ] Usage metrics por Worker

### Infra
- [ ] Container orchestration
- [ ] Worker health monitoring
- [ ] Auto-scaling por demanda
- [ ] Backup/restore por Worker

## Migração v1 → v2

1. Criar Worker "default" para cada Tenant existente
2. Mover todos os Bots para o Worker default
3. Permitir que clientes criem novos Workers
4. Redistribuir Bots conforme necessidade

## Timeline Estimado

- **Fase 1** (2 semanas): Worker CRUD + UI básica
- **Fase 2** (2 semanas): Container orchestration
- **Fase 3** (1 semana): Billing integration
- **Fase 4** (1 semana): Migration + testing

---

*Documentado em: 2026-02-11*
*Autor: Deco Montenegro*
*Status: Spec para v2*
