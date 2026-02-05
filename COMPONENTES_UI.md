# Análise de Componentes UI - BaaS App

> Mapeamento dos componentes existentes para reuso no Mission Control

## 📊 Resumo Executivo

| Categoria | Componentes | Reuso para MC |
|-----------|-------------|---------------|
| Listas/Tabelas | 4 | ⭐⭐⭐ Alto |
| Chat/Mensagens | 5 | ⭐⭐⭐ Alto |
| Cards | 5 | ⭐⭐⭐ Alto |
| Notificações | 4 | ⭐⭐⭐ Alto |
| UI Base | 23 | ⭐⭐ Médio |

---

## 1️⃣ Componentes de Lista/Tabela → **Task Board**

### `ui/table.tsx` - Tabela Base
- **Tipo:** Componente primitivo (shadcn/ui)
- **Exports:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead`, `TableFooter`, `TableCaption`
- **Features:**
  - Responsivo com overflow horizontal
  - Estilização consistente com design system
  - Suporte a estados (selected, hover)
- **Reuso MC:** Base para Task Board em modo tabela

### `conversations/ConversationList.tsx` - Lista de Conversas
- **Tipo:** Lista interativa complexa (327 linhas)
- **Features:**
  - ✅ Avatar com badge de não lidos
  - ✅ Status badges coloridos (ACTIVE, WAITING, HANDOFF, RESOLVED, ARCHIVED)
  - ✅ Tags com overflow (+N)
  - ✅ Tempo relativo (date-fns)
  - ✅ Skeleton loading
  - ✅ Empty state
  - ✅ Infinite scroll com IntersectionObserver
  - ✅ Dropdown de ações (Arquivar, Deletar, Resolver, Atribuir)
  - ✅ Seleção de item
- **Reuso MC:** 
  - **Activity Feed:** Estrutura de lista com avatares e timestamps
  - **Task Board:** Padrão de status badges e ações por item

### `handoff/HandoffQueue.tsx` - Fila de Atendimento
- **Tipo:** Lista com stats e animações (189 linhas)
- **Features:**
  - ✅ Stats bar com contadores (Pendentes, Em atendimento, Em espera)
  - ✅ Animações Framer Motion (popLayout, stagger)
  - ✅ SLA indicator com tempo restante
  - ✅ Priority badges (URGENT, HIGH)
  - ✅ Status badges coloridos
  - ✅ Empty state animado
  - ✅ Refresh button
  - ✅ Seleção de item
- **Reuso MC:**
  - **Task Board:** Stats bar, SLA tracking, prioridades
  - **Agent Cards:** Indicadores de status/urgência

### `conversations/ConversationFilters.tsx` - Sistema de Filtros
- **Tipo:** Filtros compostos (238 linhas)
- **Features:**
  - ✅ Search com debounce (300ms)
  - ✅ Select filters (Status, Canal, Workspace, Operador, Tag)
  - ✅ Expand/collapse para filtros avançados
  - ✅ Active filter badges removíveis
  - ✅ Sorting options
  - ✅ Clear all filters
- **Reuso MC:** Sistema de filtros para Task Board e Activity Feed

---

## 2️⃣ Componentes de Chat/Mensagens → **Activity Feed**

### `conversations/MessageBubble.tsx` - Bolhas de Mensagem
- **Tipo:** Componente de mensagem completo (282 linhas)
- **Features:**
  - ✅ Roles: USER, BOT, OPERATOR, SYSTEM (layout diferente)
  - ✅ Avatares por role com ícones
  - ✅ Status de entrega: PENDING, SENT, DELIVERED, READ, FAILED
  - ✅ Attachments: Image, Video, Audio, Document, Location, Contact
  - ✅ Preview de mídia (imagem, vídeo, áudio)
  - ✅ Timestamp formatado (ptBR)
  - ✅ AI metadata indicator
  - ✅ Agrupamento por sender (`MessageGroup`, `groupMessagesBySender`)
- **Reuso MC:**
  - **Activity Feed:** Modelo perfeito para eventos com avatares e timestamps

### `bots/BotTestChat.tsx` - Chat de Teste
- **Tipo:** Chat interface completo (222 linhas)
- **Features:**
  - ✅ Header com avatar e reset
  - ✅ Messages com animações Framer Motion
  - ✅ Typing indicator
  - ✅ Error display
  - ✅ Quick replies
  - ✅ Auto-scroll
  - ✅ Metadata (latency, tokens)
  - ✅ Welcome message
- **Reuso MC:** Modelo de chat para comunicação com agentes

### `onboarding/TestChat.tsx` - Chat Simplificado
- **Tipo:** Chat demo (210 linhas)
- **Features:**
  - ✅ Personality-based responses
  - ✅ Typing animation (dots)
  - ✅ CheckCheck status icon
  - ✅ Completion callback
- **Reuso MC:** Modelo para chat em onboarding

### `handoff/ConversationView.tsx` - Visualização de Conversa
- **Tipo:** View completa de atendimento (321 linhas)
- **Features:**
  - ✅ Header com info do cliente (phone, email, tempo)
  - ✅ Action buttons (Assumir, Resolver)
  - ✅ Info banner (motivo, prioridade)
  - ✅ Messages com 3 roles (customer, agent, bot)
  - ✅ Internal notes (sticky notes amarelas)
  - ✅ Note input
  - ✅ Message input com Enter shortcut
- **Reuso MC:**
  - **Activity Feed:** Banner de info, notas internas
  - **Task Detail:** Layout de ações + histórico

### `handoff/QuickReplies.tsx` - Respostas Rápidas
- **Features:** Botões de resposta pré-definidas
- **Reuso MC:** Quick actions no Activity Feed

---

## 3️⃣ Componentes de Cards → **Agent Cards**

### `ui/card.tsx` - Card Base
- **Tipo:** Componente primitivo (shadcn/ui)
- **Exports:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- **Reuso MC:** Base para todos os cards

### `bots/BotCard.tsx` - Card de Bot
- **Tipo:** Card interativo rico (163 linhas)
- **Features:**
  - ✅ Avatar com emoji ou ícone
  - ✅ Badge "Padrão" (estrela dourada)
  - ✅ Status badge (Ativo/Inativo)
  - ✅ Channel count badge
  - ✅ Tags com overflow
  - ✅ Stats: mensagens, conversas
  - ✅ Model badge (monospace)
  - ✅ Dropdown menu (Editar, Duplicar, Ativar/Desativar, Deletar)
  - ✅ Hover animation (y: -2)
  - ✅ Opacity quando inativo
  - ✅ Modo compact
- **Reuso MC:**
  - **Agent Cards:** MODELO PERFEITO! Avatar, status, stats, actions

### `ui/stat-card.tsx` - Card de Estatística
- **Tipo:** Card de métrica (69 linhas)
- **Features:**
  - ✅ Ícone com background colorido
  - ✅ Trend indicator (+/-%)
  - ✅ Sparkline chart
  - ✅ Color variants (blue, green, purple, orange)
  - ✅ Entrada animada (delay stagger)
- **Reuso MC:** Dashboard stats, métricas de agentes

### `templates/TemplateCard.tsx` - Card de Template
- **Tipo:** Card com preview (176 linhas)
- **Features:**
  - ✅ Header gradient colorido
  - ✅ Icon grande centralizado
  - ✅ Badges: Oficial, Destaque
  - ✅ Selection state com check
  - ✅ Tags
  - ✅ Usage stats + Rating (estrelas)
  - ✅ Actions: Preview, Use
  - ✅ Modo compact
  - ✅ Hover animation (y: -4)
- **Reuso MC:** Templates de agentes, galeria

### `conversations/ConversationStats.tsx` - Stats de Conversas
- **Features:** Cards de estatísticas de conversas
- **Reuso MC:** Dashboard stats

---

## 4️⃣ Sistema de Notificações → **Real-time Updates**

### `notifications/NotificationBell.tsx` - Sino de Notificação
- **Tipo:** Wrapper simples
- **Features:** Ícone com badge de contagem
- **Reuso MC:** Header do Mission Control

### `notifications/NotificationDropdown.tsx` - Dropdown de Notificações
- **Tipo:** Dropdown completo (145 linhas)
- **Features:**
  - ✅ Bell icon com badge (unread count, max 99+)
  - ✅ Fetch on open
  - ✅ Periodic refresh (30s) para unread count
  - ✅ Click outside to close
  - ✅ Mark single as read
  - ✅ Mark all as read
  - ✅ Loading state
  - ✅ Error state
  - ✅ Empty state
  - ✅ Link para settings
  - ✅ Link para "View all"
- **Reuso MC:** MODELO PERFEITO para notificações do MC

### `notifications/NotificationItem.tsx` - Item de Notificação
- **Tipo:** Item individual (87 linhas)
- **Features:**
  - ✅ Type icons (HANDOFF_REQUESTED, BOT_ERROR, USAGE_ALERT, etc.)
  - ✅ Color coding por tipo
  - ✅ Read/unread state (dot indicator)
  - ✅ Time ago (formatDistanceToNow)
  - ✅ Mark as read button
  - ✅ Click handler
  - ✅ Line clamp para body
- **Reuso MC:** Items do Activity Feed

### `notifications/NotificationPreferences.tsx` - Preferências
- **Features:** Configuração de notificações por tipo
- **Reuso MC:** Settings do Mission Control

---

## 5️⃣ Componentes UI Base

### Disponíveis em `ui/`:
| Componente | Arquivo | Uso MC |
|------------|---------|--------|
| Alert | `alert.tsx` | Mensagens de sistema |
| AlertDialog | `alert-dialog.tsx` | Confirmações |
| Badge | `badge.tsx` | Status, tags |
| Button | `button.tsx` | Ações |
| Dialog | `dialog.tsx` | Modais |
| Dropdown | `dropdown-menu.tsx` | Menus contextuais |
| Input | `input.tsx` | Formulários |
| Label | `label.tsx` | Formulários |
| Modal | `modal.tsx` | Modais custom |
| Progress | `progress.tsx` | Barras de progresso |
| Select | `select.tsx` | Dropdowns |
| Skeleton | `skeleton.tsx` | Loading states |
| Slider | `slider.tsx` | Controles |
| Sparkline | `sparkline.tsx` | Mini gráficos |
| Switch | `switch.tsx` | Toggles |
| Tabs | `tabs.tsx` | Navegação |
| Textarea | `textarea.tsx` | Texto longo |
| Toast | `toast.tsx` | Notificações toast |
| Tooltip | `tooltip.tsx` | Dicas |
| SkipLink | `skip-link.tsx` | Acessibilidade |

---

## 🎯 Recomendações para Mission Control

### Agent Cards (baseado em BotCard)
```tsx
// Adaptar BotCard.tsx → AgentCard.tsx
- Avatar: emoji/ícone do agente
- Status: online/offline/busy/error
- Stats: tasks completed, uptime, last active
- Tags: capabilities (browser, code, etc)
- Actions: View, Configure, Restart, Disable
```

### Task Board (baseado em HandoffQueue + ConversationList)
```tsx
// Combinar patterns:
- Stats bar do HandoffQueue (contadores)
- Item structure do ConversationList (avatar, badges, actions)
- SLA tracking do HandoffQueue
- Filters do ConversationFilters
```

### Activity Feed (baseado em MessageBubble + NotificationItem)
```tsx
// Combinar patterns:
- Role-based styling do MessageBubble
- Type icons do NotificationItem
- Grouping do MessageGroup
- Time formatting consistente
```

### Real-time Notifications
```tsx
// Copiar NotificationDropdown quase inteiro:
- Mudar tipos de notificação para MC
- Adicionar WebSocket/SSE para real-time
- Integrar com Activity Feed
```

---

## 📁 Estrutura de Arquivos Relevantes

```
src/components/
├── ui/                          # 23 componentes base (shadcn)
│   ├── card.tsx                 # ⭐ Base para Agent Cards
│   ├── table.tsx                # ⭐ Base para Task Board tabela
│   ├── stat-card.tsx            # ⭐ Dashboard metrics
│   └── ...
├── bots/
│   ├── BotCard.tsx              # ⭐⭐⭐ MODELO para Agent Cards
│   └── BotTestChat.tsx          # ⭐⭐ Chat interface
├── conversations/
│   ├── ConversationList.tsx     # ⭐⭐⭐ MODELO para listas
│   ├── ConversationFilters.tsx  # ⭐⭐⭐ MODELO para filtros
│   └── MessageBubble.tsx        # ⭐⭐⭐ MODELO para Activity Feed
├── handoff/
│   ├── HandoffQueue.tsx         # ⭐⭐⭐ MODELO para Task Board
│   └── ConversationView.tsx     # ⭐⭐ Detail view pattern
├── notifications/
│   ├── NotificationDropdown.tsx # ⭐⭐⭐ MODELO para notificações
│   └── NotificationItem.tsx     # ⭐⭐⭐ MODELO para feed items
└── templates/
    └── TemplateCard.tsx         # ⭐⭐ Card com seleção
```

---

## ✅ Próximos Passos

1. **Copiar componentes base** (`ui/`) para o Mission Control
2. **Adaptar BotCard** → AgentCard
3. **Adaptar HandoffQueue** → TaskBoard
4. **Adaptar NotificationDropdown** → MCNotifications
5. **Criar ActivityFeed** baseado em MessageBubble + NotificationItem
6. **Integrar filtros** do ConversationFilters

---

*Gerado em: 2025-01-31*
*Diretório analisado: `/root/clawd/empresas/bot-as-a-service/baas-app/src/components`*
