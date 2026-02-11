# BaaS Platform Roadmap

## v1 - Single Tenant (Atual) ✅

Sistema funcional para uso individual/empresa única.

### Features
- ✅ Dashboard completo
- ✅ LLM Gateway com múltiplos providers
- ✅ Bot management
- ✅ Templates de conversação
- ✅ Knowledge Base
- ✅ Analytics básico
- ✅ Team management (dentro do tenant)

### Limitações
- Single tenant por instalação
- Sem isolamento de Workers
- Sem billing multi-cliente

---

## v2 - Multi-Tenant + Workers 🚧

Sistema completo para múltiplos clientes com isolamento flexível.

### Features Planejadas
- [ ] Multi-tenant real (múltiplos clientes)
- [ ] Workers isolados por cliente
- [ ] Self-service: cliente cria seus Workers
- [ ] Billing por uso/Worker
- [ ] Resource limits configuráveis

### Arquitetura
Ver: [v2-multi-tenant.md](./architecture/v2-multi-tenant.md)

### Casos de Uso
- **SaaS**: Vender BaaS para múltiplas empresas
- **Enterprise**: Isolamento por departamento
- **Compliance**: Dados sensíveis em Workers separados

---

## v3 - Marketplace (Futuro) 💡

- Marketplace de templates
- Plugins de terceiros
- White-label completo
- API pública

---

*Última atualização: 2026-02-11*
