# Estimativa de Esforço - Mission Control UI/Frontend

**Data:** 2025-02-02  
**Baseado em:** MISSION-CONTROL-PAGES.md  
**Stack:** Next.js 14 + TypeScript + Tailwind + shadcn/ui

---

## 📊 Resumo Executivo

| Componente | Horas | Complexidade | Prioridade |
|------------|-------|--------------|------------|
| 1. Dashboard Principal | 24-32h | Média | P0 |
| 2. Task Board (Kanban) | 40-56h | Alta | P0 |
| 3. Activity Feed | 16-24h | Média | P1 |
| 4. Agent Cards | 12-16h | Baixa | P0 |
| 5. Memory Viewer | 20-28h | Média-Alta | P2 |
| 6. Standup View | 16-24h | Média | P2 |
| **TOTAL** | **128-180h** | - | - |

**Estimativa realista:** 150-200h incluindo testes, bugs e refinamentos  
**Em semanas (1 dev full-time):** 4-5 semanas

---

## 1. 📊 Dashboard Principal (`/mission-control`)

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| Layout base (sidebar + header) | 4h | Baixa |
| Quick Stats Bar (4 cards) | 3h | Baixa |
| Agent Cards Grid | 6h | Média |
| Activity Feed (versão simplificada) | 5h | Média |
| Responsividade | 3h | Média |
| Real-time updates (WebSocket) | 6h | Alta |
| Testes | 3h | - |

**Subtotal:** 24-32h

### Detalhamento
- **Layout base:** shadcn/ui já tem sidebar, mas precisa customização
- **Quick Stats:** Componentes simples, mas precisam de API integration
- **Agent Cards Grid:** CSS Grid responsivo + estado dinâmico de status
- **Real-time:** WebSocket para status updates - maior complexidade

### Dependências
- API: `/api/mission-control/stats`
- API: `/api/mission-control/activity`
- WebSocket server ou polling interval

---

## 2. 📋 Task Board (Kanban com Drag-Drop)

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| Kanban layout (4 colunas) | 4h | Média |
| Task Card component | 6h | Média |
| Drag-and-drop (react-beautiful-dnd ou dnd-kit) | 12h | Alta |
| Filtros e busca | 6h | Média |
| Quick Add inline | 4h | Média |
| Modal criar/editar task | 8h | Média-Alta |
| Task Detail page | 10h | Alta |
| Comments system | 8h | Média-Alta |
| Testes | 6h | - |

**Subtotal:** 40-56h

### Detalhamento
- **Drag-drop:** Maior complexidade do projeto. `@dnd-kit/core` recomendado
- **Task Cards:** Precisam mostrar muita info em espaço pequeno (priority border, tags, assignee, due date)
- **Task Detail:** Página completa com sidebar de metadados, área principal com markdown, comments
- **Comments:** Timeline com diferenciação user/agent, markdown support, reactions

### Riscos
- DnD libraries têm curva de aprendizado
- Optimistic updates para UX fluida
- Sync de estado entre board e detail

### Dependências
- API CRUD completa de tasks
- API de comments
- Sistema de tags

---

## 3. 📜 Activity Feed (Real-time)

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| Lista virtualizada | 4h | Média |
| Activity item component | 3h | Baixa |
| Filtros por tipo | 3h | Baixa |
| Auto-scroll com pausar | 4h | Média |
| Real-time via WebSocket | 5h | Alta |
| Timestamps relativos | 1h | Baixa |
| Testes | 2h | - |

**Subtotal:** 16-24h

### Detalhamento
- **Virtualização:** `react-virtual` para performance com muitos items
- **Auto-scroll:** UX importante - deve pausar quando usuário scrolla manualmente
- **Tipos de atividade:** task_complete, task_start, error, message, system

### Dependências
- WebSocket connection compartilhada com Dashboard
- API: `/api/mission-control/activity`

---

## 4. 🤖 Agent Cards

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| Card component base | 3h | Baixa |
| Status indicator (com pulse) | 2h | Baixa |
| Agents list page | 4h | Média |
| Agent detail page | 6h | Média |
| Tabs (Overview, Memory, Tasks, Logs) | 4h | Média |
| Testes | 2h | - |

**Subtotal:** 12-16h (sem Memory Viewer e Logs detalhados)

### Detalhamento
- **Status colors:** 6 estados com animações (online pulse, thinking pulse)
- **Agent detail:** Múltiplas tabs, cada uma com sub-componentes
- **Quick Chat widget:** Incluído aqui como P2 (+8h se implementado)

### Dependências
- API: `/api/agents`
- API: `/api/agents/:id`

---

## 5. 🧠 Memory Viewer

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| File tree navegável | 6h | Média |
| Markdown viewer | 4h | Média |
| Code/JSON syntax highlight | 3h | Média |
| Edit mode (monaco-editor) | 8h | Alta |
| Preview lado a lado | 4h | Média |
| Testes | 3h | - |

**Subtotal:** 20-28h

### Detalhamento
- **File tree:** Expandable tree para `memory/`, SOUL.md, MEMORY.md etc
- **Viewer:** Renderizar markdown + JSON com syntax highlighting
- **Editor:** Monaco editor é pesado mas oferece a melhor experiência
- **Alternativa mais leve:** Textarea + preview (reduz para 12-16h)

### Riscos
- Monaco editor aumenta bundle size significativamente
- Sincronização de edits com filesystem

### Dependências
- API: `/api/agents/:id/memory`
- Permissões de escrita

---

## 6. 📅 Standup View

### Componentes
| Item | Horas | Complexidade |
|------|-------|--------------|
| Date navigator | 2h | Baixa |
| Agent standup cards | 6h | Média |
| Yesterday/Today/Blockers layout | 4h | Média |
| Team summary | 3h | Baixa |
| Share/Export actions | 4h | Média |
| Auto-generate standup | 4h | Média |
| Testes | 2h | - |

**Subtotal:** 16-24h

### Detalhamento
- **Cards:** Layout two-column por agente
- **Auto-generate:** Backend analisa tasks do dia anterior e gera summary
- **Share:** Markdown export, email, Slack integration

### Dependências
- API: `/api/standup?date=`
- API: `/api/standup/generate`
- Integrações opcionais (Slack, email)

---

## 🏗️ Infraestrutura Adicional

| Item | Horas | Notas |
|------|-------|-------|
| Setup inicial (shadcn, tailwind) | 2h | Já parcialmente feito |
| Sistema de autenticação | 8h | Lucia já configurado |
| WebSocket server | 6h | Ou usar polling como fallback |
| API routes base | 8h | CRUD básico |
| Estado global (Zustand/Jotai) | 4h | Para real-time sync |
| Error boundaries | 3h | UX de erros |
| Loading states | 4h | Skeletons, spinners |
| **Subtotal** | **35h** | |

---

## 📈 Cronograma Sugerido

### Fase 1 - MVP (2 semanas)
- [ ] Dashboard básico (sem real-time)
- [ ] Agent Cards + List
- [ ] Task list (tabela, não kanban)
- [ ] Task detail (view only)

**Esforço:** 50-60h

### Fase 2 - Core (2 semanas)
- [ ] Kanban com drag-drop
- [ ] Task create/edit
- [ ] Activity Feed
- [ ] Real-time updates

**Esforço:** 50-60h

### Fase 3 - Polish (1 semana)
- [ ] Memory Viewer
- [ ] Standup View
- [ ] Comments system
- [ ] Mobile responsivo

**Esforço:** 40-50h

---

## ⚠️ Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| DnD complexidade | Alta | Médio | Usar dnd-kit (melhor docs) |
| Real-time bugs | Média | Alto | Fallback para polling |
| Bundle size (Monaco) | Média | Baixo | Code-split ou usar alternativa |
| API delays | Média | Alto | Definir contratos cedo |
| Scope creep | Alta | Alto | Stick to MVP first |

---

## 💰 Custo Estimado

Considerando dev senior (R$150-200/h):

| Cenário | Horas | Custo |
|---------|-------|-------|
| Otimista | 130h | R$19.500 - R$26.000 |
| Realista | 170h | R$25.500 - R$34.000 |
| Pessimista | 220h | R$33.000 - R$44.000 |

**Recomendação:** Budget para cenário realista (170h)

---

## 📝 Notas Adicionais

1. **shadcn/ui acelera:** Muitos componentes base já prontos (Dialog, Dropdown, Tabs, Card)
2. **Real-time é opcional no MVP:** Pode usar polling de 30s inicialmente
3. **Memory Viewer pode ser simplificado:** Read-only primeiro, edit depois
4. **Quick Chat:** Considerar remover do MVP (pode interagir via channel existente)

---

*Estimativa gerada em 2025-02-02*
