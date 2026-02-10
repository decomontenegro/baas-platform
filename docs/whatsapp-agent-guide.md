# Guia do Agente WhatsApp - BaaS Platform

## Visão Geral

Este guia documenta como configurar e operar agentes de IA no WhatsApp através da plataforma BaaS, baseado na experiência operacional do agente "Lobo".

---

## 1. Arquitetura de Sessões

### Sessões Isoladas por Contexto
Cada conversa tem sua própria sessão isolada:

```
agent:main:whatsapp:dm:5585988177777@s.whatsapp.net     # DM individual
agent:main:whatsapp:group:120363426193097717@g.us       # Grupo específico
```

**Benefícios:**
- Contexto de um grupo não interfere em outro
- Privacidade entre conversas
- Controle granular de limites

### Identificadores
- **DMs:** `{numero}@s.whatsapp.net`
- **Grupos:** `{id}@g.us`

---

## 2. Configuração de Grupos

### requireMention

Controla quando o agente processa mensagens:

```json
{
  "channels": {
    "whatsapp": {
      "groups": {
        "120363426193097717@g.us": {
          "requireMention": true
        }
      }
    }
  }
}
```

| Valor | Comportamento |
|-------|---------------|
| `true` | Só responde quando mencionado (@agente) |
| `false` | Lê e pode responder a todas mensagens |

### ⚠️ Cuidado com requireMention: false

**Problema:** Cada mensagem do grupo é adicionada ao contexto do agente. Grupos ativos podem estourar o limite de tokens rapidamente.

**Exemplo real:**
- Grupo com ~100 msgs/dia
- Limite do modelo: 200k tokens
- Resultado: Contexto estoura em 1-2 dias

**Recomendação:** Use `requireMention: false` apenas em:
- Grupos pequenos e focados
- Grupos com baixo volume de mensagens
- Casos onde participação ativa é essencial

---

## 3. Gerenciamento de Contexto

### Limites de Tokens por Modelo

| Modelo | Limite | Recomendação |
|--------|--------|--------------|
| Claude Sonnet | 200k | Usar compactação |
| Claude Opus | 200k | Usar compactação |
| GPT-4 | 128k | Mais restrito |

### Compactação Automática

O Clawdbot pode compactar automaticamente o contexto:

```json
{
  "agents": {
    "main": {
      "contextLimit": 150000,
      "compactionThreshold": 0.7
    }
  }
}
```

**Como funciona:**
1. Quando contexto atinge 70% do limite
2. Mensagens antigas são resumidas
3. Contexto recente é preservado
4. Agente continua funcionando

**Verificar status:**
```bash
clawdbot status
# Mostra: 📚 Context: 92k/200k (46%) · 🧹 Compactions: 3
```

### Reset Manual de Sessão

Se o contexto estourar:

```bash
# Listar sessões
clawdbot sessions list

# Resetar sessão específica
clawdbot sessions delete <session_key>
```

---

## 4. Boas Práticas

### Para Grupos Corporativos

1. **Use requireMention: true** por padrão
2. **Instrua usuários** a mencionar o agente
3. **Monitore** o uso de contexto regularmente

### Para Grupos de Suporte Ativo

Se precisa de `requireMention: false`:

1. **Limite a poucos grupos** (máx 3-5)
2. **Configure compactação** agressiva
3. **Monitore diariamente** o contexto
4. **Tenha alertas** para 80%+ de uso

### Formatação de Mensagens

O WhatsApp tem limitações de formatação:

| ✅ Funciona | ❌ Evitar |
|-------------|-----------|
| *itálico* | Tabelas markdown |
| **negrito** | Headers # |
| `código` | Links com markdown |
| Listas com - | Imagens inline |

**Links:** Não usar `[texto](url)` - quebra o clique. Enviar URL direta.

---

## 5. Monitoramento

### Métricas Importantes

```bash
clawdbot status
```

Observar:
- **Context %** - Manter abaixo de 80%
- **Compactions** - Se aumentando rápido, volume alto
- **Session age** - Sessões muito antigas podem ter contexto grande

### Alertas Recomendados

Configurar alertas para:
- Contexto > 80%
- Erros de "context limit exceeded"
- Taxa de compactação alta

---

## 6. Troubleshooting

### Erro: "context limit exceeded"

**Causa:** Contexto da sessão estourou o limite do modelo.

**Solução imediata:**
```bash
clawdbot sessions delete <session_key>
```

**Prevenção:**
- Ativar compactação automática
- Reduzir grupos com `requireMention: false`
- Monitorar uso de contexto

### Agente não responde no grupo

**Verificar:**
1. Agente está no grupo?
2. `requireMention` está correto?
3. Sessão não está com erro?

```bash
clawdbot sessions list | grep <group_id>
```

### Respostas lentas

**Possíveis causas:**
- Contexto muito grande (compactação demorada)
- Modelo sobrecarregado
- Rate limiting da API

---

## 7. Configuração Exemplo

### Configuração Conservadora (Recomendada)

```json
{
  "channels": {
    "whatsapp": {
      "groups": {
        "GRUPO_SUPORTE": {
          "requireMention": true
        },
        "GRUPO_VIP": {
          "requireMention": false
        }
      }
    }
  },
  "agents": {
    "main": {
      "model": "anthropic/claude-sonnet-4",
      "contextLimit": 150000,
      "compactionThreshold": 0.7
    }
  }
}
```

### Configuração Agressiva (Alto Volume)

```json
{
  "channels": {
    "whatsapp": {
      "groups": {
        "TODOS_GRUPOS": {
          "requireMention": true
        }
      }
    }
  },
  "agents": {
    "main": {
      "contextLimit": 100000,
      "compactionThreshold": 0.5,
      "maxSessionAge": "24h"
    }
  }
}
```

---

## 8. Comandos Úteis

```bash
# Status geral
clawdbot status

# Listar sessões ativas
clawdbot sessions list

# Ver histórico de sessão
clawdbot sessions history <session_key>

# Deletar sessão (reset contexto)
clawdbot sessions delete <session_key>

# Ver config atual
clawdbot config get

# Reiniciar gateway
clawdbot gateway restart
```

---

## Changelog

- **2026-02-10:** Documentação inicial baseada em experiência operacional
