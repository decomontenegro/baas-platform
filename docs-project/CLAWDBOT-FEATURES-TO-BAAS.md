# Features Clawdbot → BaaS

Mapeamento completo de funcionalidades do Clawdbot que devem virar opções configuráveis no BaaS Dashboard.

---

## 1. 🤖 CONFIGURAÇÃO DE AGENTES

### Clawdbot tem:
```json
{
  "identity": { "name": "Lobo", "emoji": "🐺" },
  "models": { "anthropic/claude-opus-4-5": { "alias": "opus" } },
  "compaction": { "mode": "safeguard" },
  "maxConcurrent": 4,
  "subagents": { "maxConcurrent": 8 },
  "groupChat": { "mentionPatterns": ["@lobo", "\\blobo\\b"] }
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| Nome do bot | Input text | 🔴 Alta |
| Emoji/Avatar | Emoji picker + upload | 🔴 Alta |
| Modelo padrão | Dropdown (opus, sonnet, haiku) | 🔴 Alta |
| Alias de modelos | Key-value pairs | 🟡 Média |
| Modo compactação | Radio (safeguard, auto, off) | 🟡 Média |
| Max concurrent | Number input | 🟡 Média |
| Max subagents | Number input | 🟡 Média |
| Mention patterns | Tags input (array) | 🔴 Alta |

---

## 2. 📱 CONFIGURAÇÃO DE CANAIS

### Clawdbot tem:
```json
{
  "whatsapp": {
    "dmPolicy": "allowlist",
    "selfChatMode": true,
    "allowFrom": ["+55XXXXXXXXXXX"],
    "groupPolicy": "open",
    "groupAllowFrom": ["*"],
    "mediaMaxMb": 50,
    "debounceMs": 0,
    "groups": {
      "EXAMPLE_GROUP_ID@g.us": { "requireMention": false }
    }
  }
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| DM Policy | Radio (open, allowlist, block) | 🔴 Alta |
| Self Chat Mode | Toggle | 🟡 Média |
| Allow From (números) | Phone input + list | 🔴 Alta |
| Group Policy | Radio (open, allowlist, block) | 🔴 Alta |
| Media Max MB | Slider (1-100) | 🟡 Média |
| Debounce MS | Number input | 🟢 Baixa |
| **Grupos individuais** | Table com toggles | 🔴 Alta |
| - Nome do grupo | Display | - |
| - Require Mention | Toggle | - |
| - Enabled | Toggle | - |
| - Prefixo customizado | Input | - |

---

## 3. 🔧 SKILLS (Capacidades)

### Clawdbot tem:
```json
{
  "goplaces": { "apiKey": "..." },
  "nano-banana-pro": { "apiKey": "..." },  // Image gen
  "sag": { "apiKey": "..." },               // TTS
  "coding-agent": { "enabled": true },
  "openai-whisper-api": { "apiKey": "..." } // Transcrição
}
```

### BaaS deve ter:
| Skill | Config UI | Prioridade |
|-------|-----------|------------|
| **Busca de lugares** | Toggle + API key | 🟡 Média |
| **Geração de imagem** | Toggle + provider select + API key | 🔴 Alta |
| **Text-to-Speech** | Toggle + voice select + API key | 🔴 Alta |
| **Transcrição de áudio** | Toggle + provider select + API key | 🔴 Alta |
| **Coding Agent** | Toggle | 🟡 Média |
| **Web Search** | Toggle + API key | 🔴 Alta |
| **Web Fetch** | Toggle | 🟡 Média |

---

## 4. 🔗 BINDINGS (Roteamento)

### Clawdbot tem:
```json
{
  "agentId": "bi-performance",
  "match": {
    "channel": "whatsapp",
    "peer": { "kind": "group", "id": "EXAMPLE_GROUP_ID_2@g.us" }
  }
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| Criar binding | Modal wizard | 🔴 Alta |
| Selecionar agente | Dropdown | - |
| Selecionar canal | Dropdown (whatsapp, telegram, etc) | - |
| Tipo de peer | Radio (group, dm, all) | - |
| ID específico | Input ou dropdown de grupos | - |
| Condições extras | Advanced (regex, horário, etc) | 🟢 Baixa |

**Exemplo UI:**
```
┌─────────────────────────────────────────┐
│ Novo Binding                            │
├─────────────────────────────────────────┤
│ Agente: [Bi - Performance    ▼]        │
│ Canal:  [WhatsApp            ▼]        │
│ Tipo:   ○ Todos  ● Grupo  ○ DM         │
│ Grupo:  [Cultura Builder     ▼]        │
│                                         │
│            [Cancelar] [Salvar]          │
└─────────────────────────────────────────┘
```

---

## 5. 🪝 HOOKS (Automações)

### Clawdbot tem:
```json
{
  "session-memory": { "enabled": true },
  "command-logger": { "enabled": true },
  "boot-md": { "enabled": true }
}
```

### BaaS deve ter:
| Hook | Descrição | UI |
|------|-----------|-----|
| Session Memory | Salva contexto entre sessões | Toggle |
| Command Logger | Log de comandos executados | Toggle |
| Boot MD | Carrega arquivos MD no boot | Toggle + file picker |
| **Webhooks customizados** | Envia eventos para URL externa | URL + eventos |
| **Auto-responder** | Respostas automáticas | Rules builder |

---

## 6. 💬 CONFIGURAÇÃO DE MENSAGENS

### Clawdbot tem:
```json
{
  "ackReactionScope": "group-mentions"
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| Ack Reaction Scope | Dropdown (all, group-mentions, none) | 🟡 Média |
| Reaction Emoji | Emoji picker | 🟢 Baixa |
| Typing Indicator | Toggle | 🟡 Média |
| Read Receipts | Toggle | 🟡 Média |
| Max Message Length | Number input | 🟡 Média |
| Auto-split messages | Toggle | 🟢 Baixa |

---

## 7. 🔐 AUTENTICAÇÃO

### Clawdbot tem:
```json
{
  "profiles": {
    "anthropic:default": { "provider": "anthropic", "mode": "api_key" },
    "anthropic:claude-cli": { "provider": "anthropic", "mode": "oauth" }
  }
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| Auth Profiles | List + add/remove | 🔴 Alta |
| Provider select | Dropdown (anthropic, openai, google) | - |
| Mode select | Radio (api_key, oauth) | - |
| API Key input | Password field | - |
| OAuth connect | Button + flow | 🟡 Média |
| Fallback config | Secondary profile | 🟡 Média |

---

## 8. ⚙️ CONFIGURAÇÕES AVANÇADAS

### Do Gateway Clawdbot:
```json
{
  "port": 18789,
  "mode": "local",
  "bind": "loopback",
  "controlUi": { "allowInsecureAuth": true },
  "tailscale": { "mode": "off" }
}
```

### BaaS deve ter:
| Feature | UI Component | Prioridade |
|---------|--------------|------------|
| Port | Number (readonly em cloud) | 🟢 Baixa |
| Bind mode | Radio (loopback, public) | 🟢 Baixa |
| Tailscale | Toggle + config | 🟡 Média |
| Rate limits | Number inputs | 🔴 Alta |
| Timeout configs | Number inputs | 🟡 Média |

---

## 9. 📊 MULTI-AGENTE

### Clawdbot tem:
- Lista de agentes (`agents.list`)
- Cada agente com sua identidade
- Bindings para rotear mensagens

### BaaS deve ter:

**Página "Meus Bots":**
```
┌─────────────────────────────────────────────────────┐
│ 🤖 Meus Bots                        [+ Novo Bot]   │
├─────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐         │
│ │ 🐺        │ │ 📊        │ │ 🎯        │         │
│ │ Lobo      │ │ Bi        │ │ Sales Bot │         │
│ │ Principal │ │ Analytics │ │ Vendas    │         │
│ │ ● Online  │ │ ● Online  │ │ ○ Offline │         │
│ │ [Config]  │ │ [Config]  │ │ [Config]  │         │
│ └───────────┘ └───────────┘ └───────────┘         │
└─────────────────────────────────────────────────────┘
```

---

## 10. 🎨 PERSONALIZAÇÃO

### BaaS deve adicionar:
| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| System Prompt | Editor de prompt do sistema | 🔴 Alta |
| Knowledge Base | Upload de docs (RAG) | 🔴 Alta |
| Personality | Sliders (formal↔casual, etc) | 🟡 Média |
| Forbidden topics | Lista de tópicos bloqueados | 🟡 Média |
| Response templates | Templates de resposta | 🟡 Média |
| Language | Idioma principal | 🔴 Alta |
| Tone of voice | Dropdown (profissional, amigável, etc) | 🟡 Média |

---

## Resumo de Prioridades

### 🔴 Alta (MVP)
1. Identidade do bot (nome, emoji)
2. Modelo padrão
3. Mention patterns
4. DM/Group policies
5. Configuração de grupos
6. Skills principais (TTS, STT, Image, Search)
7. Bindings básicos
8. Auth profiles
9. System prompt
10. Knowledge base

### 🟡 Média (v1.1)
1. Compaction mode
2. Concurrent limits
3. Media max size
4. Hooks
5. Message configs
6. OAuth flow
7. Personality config
8. Multi-agente completo

### 🟢 Baixa (v2.0)
1. Debounce
2. Advanced bindings
3. Port/bind configs
4. Auto-split messages
5. Reaction customization

---

## Próximos Passos

1. **Criar páginas no dashboard:**
   - `/bots` - Lista de bots
   - `/bots/[id]` - Configuração do bot
   - `/bots/[id]/channels` - Canais do bot
   - `/bots/[id]/skills` - Skills do bot
   - `/bots/[id]/bindings` - Roteamento

2. **Criar APIs:**
   - `POST /api/bots` - Criar bot
   - `PATCH /api/bots/[id]` - Atualizar config
   - `POST /api/bots/[id]/sync` - Sync com Clawdbot

3. **Sync bidirecional:**
   - BaaS → Clawdbot (aplicar configs)
   - Clawdbot → BaaS (importar estado)

---

*Documento criado em 31/01/2026 | Lobo 🐺*
