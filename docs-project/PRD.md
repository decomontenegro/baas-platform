# 📋 PRD - Bot-as-a-Service Dashboard

**Versão:** 1.0  
**Data:** 2025-01-29  
**Status:** Draft  
**Owner:** Product

---

## 📑 Índice

1. [Visão do Produto](#1-visão-do-produto)
2. [Personas de Usuário](#2-personas-de-usuário)
3. [User Stories](#3-user-stories-priorizadas)
4. [Requisitos Funcionais](#4-requisitos-funcionais)
5. [Requisitos Não-Funcionais](#5-requisitos-não-funcionais)
6. [Métricas de Sucesso](#6-métricas-de-sucesso)
7. [Riscos e Mitigações](#7-riscos-e-mitigações)

---

## 1. Visão do Produto

### 1.1 Problema

Empresas querem usar IA conversacional em seus grupos de comunicação (WhatsApp, Discord, Telegram), mas:

- **Chatbots tradicionais** são robóticos e não representam a marca
- **Soluções enterprise** são complexas demais (semanas de setup)
- **Ferramentas genéricas** não entendem contexto de negócio
- **Falta controle** sobre comportamento, custos e compliance

### 1.2 Solução

Dashboard self-service que permite empresas configurarem um bot de IA com a **voz da marca** em **5 minutos**, sem código.

### 1.3 Proposta de Valor

> "WhatsApp bot com a voz da sua marca em 5 minutos"

**Diferenciais Únicos:**

| Diferencial | O que é | Por que importa |
|-------------|---------|-----------------|
| **Brand Voice AI** | Personalidade configurável por sliders + texto | Ninguém faz personalidade de marca bem |
| **Simplicidade Radical** | Setup em 5 min, zero código | Vs semanas dos incumbentes |
| **Especialistas On-Demand** | Muda comportamento por contexto | Bot não fica preso a uma persona |
| **Transparência de Custos** | Vê custo por funcionalidade em tempo real | Sem surpresas na fatura |

### 1.4 Clientes Piloto

| Cliente | Segmento | Use Case | Prioridade |
|---------|----------|----------|------------|
| **Liqi** | Fintech (regulada) | Suporte a investidores em grupos | Alta - Enterprise |
| **BI Performance** | Consultoria | Assistente em comunidades de clientes | Alta - Business |
| **R2** | Proptech | Bot em grupos de corretores | Média - Business |
| **Iazis** | AI/Tech | Comunidade de usuários | Média - Starter |
| **Cultura Builder** | RH/Cultura | Facilitação de discussões | Baixa - POC |

### 1.5 Posicionamento de Mercado

**NÃO somos:**
- ❌ Chatbot builder (Botpress, Dialogflow)
- ❌ Help desk (Intercom, Zendesk)
- ❌ WhatsApp marketing (ManyChat, Take Blip)

**SOMOS:**
- ✅ "Brand Voice AI" — IA que fala como sua marca
- ✅ Para grupos de comunidade/relacionamento, não suporte transacional

---

## 2. Personas de Usuário

### 2.1 Admin da Empresa (Decision Maker)

**Perfil:**
- CEO, CTO, Head de Produto ou Marketing
- Decide adoção da ferramenta
- Preocupado com ROI, segurança, compliance

**Goals:**
- Demonstrar inovação para stakeholders
- Reduzir carga operacional de community management
- Manter controle sobre o que a IA diz em nome da marca

**Pain Points:**
- Medo de IA falar algo errado publicamente
- Dificuldade de medir valor de bots
- Ferramentas que exigem equipe técnica dedicada

**Contexto de Uso:**
- Acessa 1-2x por semana para overview
- Configura políticas e limites
- Revisa relatórios de uso

---

### 2.2 Operador (Day-to-Day Manager)

**Perfil:**
- Community Manager, Social Media, Customer Success
- Opera o bot diariamente
- Skill técnico médio-baixo

**Goals:**
- Configurar bot rapidamente sem depender de TI
- Ajustar comportamento quando algo dá errado
- Provar valor do bot para liderança

**Pain Points:**
- Interfaces complexas demais
- Não saber se bot está funcionando bem
- Dificuldade de explicar comportamento do bot

**Contexto de Uso:**
- Acessa diariamente
- Monitora grupos e ajusta configs
- Responde quando bot não consegue

---

### 2.3 Usuário Final (End User)

**Perfil:**
- Membro do grupo onde o bot está
- Não sabe/não importa que é bot
- Interage naturalmente na conversa

**Goals:**
- Ter perguntas respondidas rapidamente
- Não ser incomodado por spam
- Interação natural, não robótica

**Pain Points:**
- Bots que não entendem contexto
- Respostas genéricas e inúteis
- Ser "vendido" constantemente

**Contexto de Uso:**
- Interage organicamente no grupo
- Espera respostas em segundos
- Pode mencionar bot diretamente ou não

---

## 3. User Stories Priorizadas

### 3.1 MVP (4-6 semanas)

#### Autenticação & Onboarding
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| AUTH-01 | Como admin, quero fazer login com magic link para não gerenciar senha | P0 | Baixa |
| AUTH-02 | Como admin, quero um wizard de 4 passos para configurar meu primeiro bot em <10 min | P0 | Média |
| AUTH-03 | Como operador, quero ser convidado por email para acessar workspace do meu time | P1 | Baixa |

#### Grupos & Canais
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| GRP-01 | Como operador, quero ver lista de grupos conectados com status on/off | P0 | Baixa |
| GRP-02 | Como operador, quero pausar/ativar bot em um grupo com um clique | P0 | Baixa |
| GRP-03 | Como operador, quero ver últimas 10 mensagens do bot em cada grupo | P1 | Média |

#### Comportamento Básico
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| BHV-01 | Como operador, quero descrever a personalidade do bot em texto livre | P0 | Baixa |
| BHV-02 | Como operador, quero ajustar formalidade do bot (informal ↔ formal) | P1 | Baixa |
| BHV-03 | Como operador, quero definir coisas que o bot NUNCA deve falar | P1 | Baixa |

#### Funcionalidades
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| FEAT-01 | Como operador, quero ligar/desligar funcionalidades com toggle simples | P0 | Baixa |
| FEAT-02 | Como operador, quero ver custo estimado de cada funcionalidade ativada | P1 | Média |

---

### 3.2 V1 (8-12 semanas)

#### Home & Overview
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| HOME-01 | Como admin, quero dashboard com métricas das últimas 24h ao abrir o app | P0 | Média |
| HOME-02 | Como admin, quero ver alertas (bot parado, limite próximo, erro) | P0 | Média |
| HOME-03 | Como operador, quero ver "saúde" geral dos bots (% uptime, msgs/dia) | P1 | Média |

#### Hierarquia & Workspaces
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| WKS-01 | Como admin, quero organizar grupos em workspaces (ex: Suporte, Vendas) | P0 | Alta |
| WKS-02 | Como admin, quero definir configs no workspace que herdam para grupos | P1 | Alta |
| WKS-03 | Como operador, quero override de config em grupo específico | P1 | Média |

#### Comportamento Avançado
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| BHV-04 | Como operador, quero preview do bot antes de ativar mudanças | P0 | Alta |
| BHV-05 | Como operador, quero criar "especialistas" que ativam por gatilho | P1 | Alta |
| BHV-06 | Como operador, quero definir horários de funcionamento do bot | P1 | Baixa |

#### Analytics
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| ANL-01 | Como admin, quero ver volume de mensagens por dia/semana/mês | P0 | Média |
| ANL-02 | Como admin, quero ver quais tópicos geram mais perguntas | P1 | Alta |
| ANL-03 | Como operador, quero ver mensagens onde bot não soube responder | P1 | Média |

#### Billing
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| BILL-01 | Como admin, quero ver custo atual do mês vs plano contratado | P0 | Média |
| BILL-02 | Como admin, quero alerta quando chegar em 70%/90% do limite | P0 | Baixa |
| BILL-03 | Como admin, quero upgrade de plano self-service (Stripe) | P1 | Média |

---

### 3.3 V2 - Enterprise (12-16 semanas)

#### SSO & Compliance
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| SEC-01 | Como admin enterprise, quero login via SSO (Azure AD, Okta, Google) | P0 | Alta |
| SEC-02 | Como admin, quero forçar MFA para todos os usuários | P0 | Média |
| SEC-03 | Como compliance officer, quero audit logs de todas as ações | P0 | Alta |
| SEC-04 | Como DPO, quero atender requisições LGPD (export, delete) | P1 | Alta |

#### Integrações
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| INT-01 | Como admin, quero conectar bot a APIs externas (CRM, Helpdesk) | P0 | Alta |
| INT-02 | Como desenvolvedor, quero API REST documentada para automações | P0 | Alta |
| INT-03 | Como desenvolvedor, quero webhooks para eventos do bot | P1 | Média |
| INT-04 | Como operador, quero ver status das integrações conectadas | P1 | Baixa |

#### Multi-tenant Avançado
| ID | Story | Prioridade | Complexidade |
|----|-------|------------|--------------|
| MT-01 | Como admin enterprise, quero ambientes separados (prod, staging) | P1 | Alta |
| MT-02 | Como admin, quero SLA dashboard com métricas de disponibilidade | P1 | Média |

---

## 4. Requisitos Funcionais

### 4.1 Home/Overview

**Objetivo:** Visão consolidada do estado dos bots em <5 segundos.

#### RF-HOME-01: Dashboard Principal
**Descrição:** Tela inicial com métricas agregadas e status.

**Componentes:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🏠 Home                                         [Settings]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  12 grupos   │ │ 2.4k msgs    │ │ R$ 847       │        │
│  │  ● 10 ativos │ │ últimas 24h  │ │ este mês     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ⚠️ Alertas (2)                                            │
│  ├─ Grupo "Investidores Liqi" inativo há 2h               │
│  └─ 87% do limite de mensagens usado                       │
│                                                             │
│  📊 Atividade (7 dias)                                     │
│  [gráfico de área: msgs/dia]                               │
│                                                             │
│  🔥 Top Grupos                                             │
│  1. Suporte Premium    │ 423 msgs │ ● ativo               │
│  2. Comunidade Geral   │ 312 msgs │ ● ativo               │
│  3. Vendas Externas    │ 89 msgs  │ ○ pausado             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Métricas Exibidas:**
- Total de grupos (ativos/pausados)
- Volume de mensagens (24h, 7d, 30d)
- Custo acumulado do mês
- % do limite do plano usado

**Alertas Automáticos:**
| Tipo | Condição | Severidade |
|------|----------|------------|
| Inatividade | Grupo sem msg há >2h (horário comercial) | Warning |
| Limite 70% | Uso >70% do plano | Info |
| Limite 90% | Uso >90% do plano | Warning |
| Limite 100% | Plano excedido | Critical |
| Erro conexão | Perda de conexão com canal | Critical |
| Bot reportado | Usuário denunciou mensagem | Warning |

---

### 4.2 Grupos & Canais

**Objetivo:** Gerenciar onde o bot está presente e seu estado.

#### RF-GRP-01: Lista de Grupos
**Descrição:** Visualização de todos os grupos conectados.

**Campos por Grupo:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome | string | Nome do grupo no WhatsApp/Discord |
| Canal | enum | whatsapp, discord, telegram |
| Status | enum | active, paused, error |
| Membros | number | Quantidade de participantes |
| Msgs/24h | number | Mensagens do bot nas últimas 24h |
| Última atividade | datetime | Timestamp da última interação |
| Workspace | FK | Workspace pai (opcional) |

**Ações:**
- ▶️ Ativar / ⏸️ Pausar bot
- ⚙️ Configurar (abre drawer)
- 📊 Ver histórico
- 🗑️ Desconectar (com confirmação)

#### RF-GRP-02: Conectar Novo Grupo
**Descrição:** Wizard para adicionar grupo.

**Fluxo WhatsApp:**
1. Selecionar "WhatsApp"
2. Escanear QR code (se nova conexão) ou selecionar conexão existente
3. Bot envia link de convite OU admin adiciona bot ao grupo
4. Confirmação de conexão
5. Configuração inicial (personalidade, features)

**Fluxo Discord:**
1. Selecionar "Discord"
2. OAuth: autorizar bot no servidor
3. Selecionar canais específicos
4. Configuração inicial

#### RF-GRP-03: Hierarquia de Grupos
**Descrição:** Organização em Workspace > Grupos.

```
📁 Workspace: Liqi Investidores
├── 💬 Grupo: Premium TOP 100
├── 💬 Grupo: Premium TOP 500  
└── 💬 Grupo: Geral Investidores

📁 Workspace: Liqi Interno
├── 💬 Grupo: Suporte Time
└── 💬 Grupo: Operações
```

**Regras de Herança:**
1. Configurações no Workspace aplicam a todos os grupos filhos
2. Grupo pode fazer override de qualquer config
3. Visualização clara de "herdado" vs "customizado"

---

### 4.3 Comportamento (Personalidade + Especialistas)

**Objetivo:** Definir como o bot fala e se comporta.

#### RF-BHV-01: Personalidade Base
**Descrição:** Configuração do comportamento padrão.

**Campos:**
| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| Nome do bot | string | Como quer ser chamado | "Liqi Bot" |
| Descrição | textarea | Quem é, como se comporta | "Assistente da Liqi..." |
| Tom de voz | slider 1-5 | Informal ↔ Formal | 3 |
| Tecnicidade | slider 1-5 | Simples ↔ Técnico | 4 |
| Proatividade | slider 1-5 | Reativo ↔ Proativo | 2 |
| Tamanho resposta | slider 1-5 | Conciso ↔ Detalhado | 3 |
| Idioma | select | Idioma principal | Português BR |

**Interface de Sliders:**
```
Tom de voz
😎 Descontraído ├──────●──────┤ 👔 Formal
                      [3]

Tecnicidade  
🎯 Direto ao ponto ├────●────────┤ 📚 Detalhado
                        [2]

Proatividade
🤫 Só quando chamado ├──────────●┤ 💬 Participa ativamente
                                [4]
```

#### RF-BHV-02: Guardrails (Restrições)
**Descrição:** O que o bot NUNCA deve fazer.

**Campos:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Tópicos proibidos | tags | Lista de assuntos a evitar |
| Frases proibidas | array | Expressões específicas banidas |
| Nunca recomendar | tags | Concorrentes, produtos, etc |
| Limite de escopo | textarea | "Só responde sobre X, Y, Z" |
| Resposta padrão fora do escopo | textarea | O que dizer quando não sabe |

**Exemplo:**
```yaml
topicos_proibidos:
  - política
  - religião
  - concorrentes (XP, BTG)
  
frases_proibidas:
  - "não sei"  # Substituir por resposta padrão
  - "talvez"
  
limite_escopo: |
  Só responde sobre:
  - Produtos Liqi (tokens, fundos)
  - Dúvidas sobre a plataforma
  - Informações públicas do mercado
  
resposta_fora_escopo: |
  Essa pergunta foge do meu escopo! 
  Para assuntos fora de investimentos Liqi, 
  fale com suporte@liqi.com.br
```

#### RF-BHV-03: Especialistas (Personas Contextuais)
**Descrição:** Comportamentos alternativos ativados por contexto.

**Estrutura de Especialista:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome | string | Identificador interno |
| Gatilho | rule | Quando ativar |
| Personalidade | object | Override das configs base |
| Conhecimento | file/url | Documentos específicos |
| Duração | enum | mensagem, conversa, manual |

**Tipos de Gatilho:**
```yaml
# Por palavra-chave
gatilho:
  tipo: keyword
  palavras: ["suporte", "ajuda", "problema"]
  
# Por menção
gatilho:
  tipo: mention
  pattern: "@suporte"
  
# Por horário
gatilho:
  tipo: schedule
  horario: "18:00-08:00"  # Fora do horário comercial
  
# Por sentimento
gatilho:
  tipo: sentiment
  condicao: negative  # Usuário frustrado
```

**Exemplo de Especialista:**
```yaml
nome: "Modo Suporte Técnico"
gatilho:
  tipo: keyword
  palavras: ["erro", "bug", "não funciona", "travou"]
  
personalidade:
  tom: 5  # Mais formal
  proatividade: 5  # Mais ativo
  
resposta_inicial: |
  Percebi que você está com um problema técnico.
  Pode me dar mais detalhes? Vou tentar ajudar!
  
escalacao: |
  Se não resolver em 3 mensagens, 
  perguntar se quer falar com humano.
```

#### RF-BHV-04: Preview/Sandbox
**Descrição:** Testar comportamento antes de ativar.

**Interface:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🧪 Sandbox - Testar Personalidade                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Configuração Atual          │  Preview da Conversa        │
│  ─────────────────────────   │  ─────────────────────────  │
│  Tom: ████░░░░░░ Formal      │  👤 Usuário: Oi, tudo bem?  │
│  Tecnicidade: ██████░░░░     │                             │
│  Proatividade: ████░░░░░░    │  🤖 Bot: Olá! Tudo ótimo   │
│                              │  por aqui. Como posso       │
│  [Ajustar] [Resetar]         │  ajudar hoje?               │
│                              │                             │
│                              │  👤 Usuário: Quero saber    │
│                              │  sobre os tokens            │
│                              │                             │
│                              │  🤖 Bot: [digitando...]     │
│                              │                             │
│                              │  ─────────────────────────  │
│                              │  [Digite uma mensagem...]   │
│                              │  [Enviar]                   │
│                              │                             │
└─────────────────────────────────────────────────────────────┘
│                [Descartar]              [Aplicar Mudanças] │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.4 Funcionalidades (Toggles)

**Objetivo:** Controle granular de features do bot.

#### RF-FEAT-01: Lista de Funcionalidades
**Descrição:** Toggles para cada capacidade.

**Funcionalidades MVP:**
| Feature | Descrição | Custo/unidade |
|---------|-----------|---------------|
| Resposta a menções | Responde quando @mencionado | 1 crédito |
| Resposta contextual | Responde msgs relevantes sem menção | 2 créditos |
| Transcrição de áudio | Converte áudio em texto | 5 créditos/min |
| Análise de imagens | Descreve/analisa imagens | 10 créditos |
| Busca na web | Pesquisa informações online | 5 créditos |
| Memória de contexto | Lembra conversas anteriores | 3 créditos |

**Funcionalidades V1:**
| Feature | Descrição | Custo/unidade |
|---------|-----------|---------------|
| Geração de imagens | Cria imagens via DALL-E | 20 créditos |
| Resumo de conversas | Sumariza discussões longas | 15 créditos |
| Agendamento | Agenda lembretes no grupo | 1 crédito |
| Enquetes inteligentes | Cria polls baseado em contexto | 5 créditos |
| Tradução automática | Traduz mensagens | 3 créditos |

#### RF-FEAT-02: Interface de Toggles
**Descrição:** Visualização clara com herança.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Funcionalidades                    📁 Workspace: Suporte │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Core                                                       │
│  ────────────────────────────────────────────────────────  │
│  ☑️ Resposta a menções                    ~R$0.01/msg      │
│     └─ [●] Herdado do Workspace                            │
│                                                             │
│  ☑️ Resposta contextual                   ~R$0.02/msg      │
│     └─ [●] Herdado do Workspace                            │
│                                                             │
│  ☐ Transcrição de áudio                  ~R$0.05/min       │
│     └─ [Override] Desativado neste grupo                   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  Avançado                                                   │
│  ────────────────────────────────────────────────────────  │
│  ☐ Análise de imagens                    ~R$0.10/img       │
│  ☐ Busca na web                          ~R$0.05/busca     │
│  ☑️ Memória de contexto                  ~R$0.03/msg       │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  💰 Custo estimado: R$ 120-180/mês (baseado em uso médio)  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### RF-FEAT-03: Configuração por Feature
**Descrição:** Opções específicas quando feature é ativada.

**Exemplo - Transcrição de Áudio:**
```yaml
transcrição:
  ativo: true
  config:
    max_duracao: 300  # segundos
    idiomas: ["pt-BR", "en-US"]
    resposta_automatica: true  # Responde sobre o conteúdo
    privacidade: "processar_e_deletar"  # Não guarda áudio
```

---

### 4.5 Integrações

**Objetivo:** Conectar bot a sistemas externos.

#### RF-INT-01: Hub de Integrações
**Descrição:** Catálogo de integrações disponíveis.

**Categorias:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔌 Integrações                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Conectadas (2)                                             │
│  ┌────────────┐ ┌────────────┐                             │
│  │ 🟢 HubSpot │ │ 🟢 Notion  │                             │
│  │ CRM sync   │ │ Knowledge  │                             │
│  │ [Config]   │ │ [Config]   │                             │
│  └────────────┘ └────────────┘                             │
│                                                             │
│  Disponíveis                                                │
│  ────────────────────────────────────────────────────────  │
│  CRM                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Salesforce │ │ Pipedrive  │ │ RD Station │             │
│  │ [Conectar] │ │ [Conectar] │ │ [Conectar] │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                             │
│  Knowledge Base                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Confluence │ │ Google     │ │ Zendesk    │             │
│  │            │ │ Drive      │ │ Guide      │             │
│  │ [Conectar] │ │ [Conectar] │ │ [Conectar] │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                             │
│  Comunicação                                                │
│  ┌────────────┐ ┌────────────┐                             │
│  │ Slack      │ │ Email      │                             │
│  │ [Conectar] │ │ [Conectar] │                             │
│  └────────────┘ └────────────┘                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### RF-INT-02: OAuth Manager
**Descrição:** Gerenciamento seguro de conexões.

**Fluxo:**
1. Admin clica "Conectar"
2. Redirect para OAuth do provider
3. Autorização com scopes mínimos necessários
4. Token armazenado com encryption at rest
5. Refresh automático de tokens

**Status de Conexão:**
| Status | Significado | Ação |
|--------|-------------|------|
| 🟢 Conectado | Funcionando | - |
| 🟡 Expirando | Token expira em <7d | Reconectar |
| 🔴 Erro | Falha de autenticação | Reconectar |
| ⚪ Desconectado | Não configurado | Conectar |

#### RF-INT-03: Webhooks
**Descrição:** Eventos do bot para sistemas externos.

**Eventos Disponíveis:**
| Evento | Payload | Uso |
|--------|---------|-----|
| `message.received` | msg, user, group | Log externo |
| `message.sent` | msg, group, tokens_used | Billing externo |
| `user.first_interaction` | user, group | CRM sync |
| `escalation.requested` | conversation, user | Helpdesk ticket |
| `limit.reached` | type, current, max | Alertas |

**Configuração:**
```yaml
webhooks:
  - url: "https://api.cliente.com/bot-events"
    events: ["message.sent", "escalation.requested"]
    secret: "whsec_..." # HMAC signature
    retry: 3
    timeout: 10s
```

#### RF-INT-04: API REST
**Descrição:** API para automações e integrações custom.

**Endpoints MVP:**
```
GET    /api/v1/groups              # Lista grupos
GET    /api/v1/groups/:id          # Detalhes do grupo
PATCH  /api/v1/groups/:id          # Atualiza configs
POST   /api/v1/groups/:id/pause    # Pausa bot
POST   /api/v1/groups/:id/resume   # Resume bot

GET    /api/v1/messages            # Histórico (paginado)
POST   /api/v1/messages            # Enviar mensagem proativa

GET    /api/v1/usage               # Métricas de uso
GET    /api/v1/usage/costs         # Custos detalhados
```

**Autenticação:**
- API Key por workspace
- Rate limit: 100 req/min (Starter), 1000 req/min (Enterprise)
- Logs de todas as chamadas

---

### 4.6 Billing & Analytics

**Objetivo:** Transparência total de custos e valor gerado.

#### RF-BILL-01: Dashboard de Uso
**Descrição:** Visualização de consumo em tempo real.

```
┌─────────────────────────────────────────────────────────────┐
│ 💰 Uso & Billing                          Janeiro 2025     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Plano Atual: Business (R$ 1.497/mês)                      │
│  ═══════════════════════════════════════════════           │
│  Uso: ████████████░░░░░░░░ 67%                             │
│  6.700 de 10.000 créditos usados                           │
│                                                             │
│  📅 Renova em: 15 dias                                     │
│  📈 Projeção fim do mês: ~8.900 créditos (89%)             │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  Breakdown por Funcionalidade                               │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  Respostas GPT-4        │████████████████░░│ 4.200 (63%)   │
│  Transcrição de áudio   │████████░░░░░░░░░░│ 1.800 (27%)   │
│  Análise de imagens     │███░░░░░░░░░░░░░░░│   500 (7%)    │
│  Busca web              │█░░░░░░░░░░░░░░░░░│   200 (3%)    │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  Breakdown por Grupo                                        │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  Suporte Premium        │████████████░░░░░░│ 3.100 (46%)   │
│  Comunidade Geral       │████████░░░░░░░░░░│ 2.200 (33%)   │
│  Outros (3 grupos)      │████░░░░░░░░░░░░░░│ 1.400 (21%)   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  [Ver detalhes] [Exportar CSV] [Upgrade de plano]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### RF-BILL-02: Sistema de Alertas de Custo
**Descrição:** Notificações proativas sobre limites.

**Níveis de Alerta:**
| Nível | Threshold | Canal | Ação Automática |
|-------|-----------|-------|-----------------|
| Info | 70% | Dashboard, Email | Nenhuma |
| Warning | 90% | Dashboard, Email, Push | Email ao admin |
| Critical | 100% | Todos + SMS | Pausa features não-core |

**Configuração:**
```yaml
alertas:
  email: ["admin@empresa.com", "financeiro@empresa.com"]
  slack_webhook: "https://hooks.slack.com/..."
  custom_thresholds: [50, 75, 90, 100]  # Override padrão
  acao_100:
    tipo: "pausar_features"
    manter: ["resposta_mencoes"]  # Core sempre ativo
```

#### RF-BILL-03: Planos e Upgrade
**Descrição:** Self-service para mudança de plano.

**Tiers:**
| Tier | Preço | Créditos | Grupos | Features |
|------|-------|----------|--------|----------|
| **Free** | R$ 0 | 500/mês | 1 | Core apenas |
| **Starter** | R$ 497/mês | 3.000 | 3 | + Transcrição |
| **Business** | R$ 1.497/mês | 10.000 | 15 | + Analytics, API |
| **Enterprise** | Custom | Ilimitado | Ilimitado | + SSO, SLA, Suporte |

**Upgrade Flow:**
1. Admin vê comparativo de planos
2. Seleciona novo plano
3. Preview do valor pro-rata
4. Checkout Stripe (card já salvo ou novo)
5. Upgrade imediato
6. Email de confirmação

#### RF-ANL-01: Analytics de Valor
**Descrição:** Métricas que mostram ROI do bot.

**Métricas Principais:**
| Métrica | Cálculo | Por que importa |
|---------|---------|-----------------|
| Msgs respondidas | Total de respostas do bot | Volume básico |
| Tempo médio resposta | Média de segundos até reply | SLA |
| Taxa de resolução | % conversas sem escalação | Eficácia |
| Perguntas únicas | Topics distintos respondidos | Amplitude |
| NPS estimado | Baseado em sentimento | Satisfação |

**Dashboard Analytics:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Analytics                          Últimos 30 dias      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Resumo                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ 2.847      │ │ 3.2s       │ │ 89%        │ │ +12      │ │
│  │ mensagens  │ │ tempo resp │ │ resolução  │ │ NPS est  │ │
│  │ ↑ 23%      │ │ ↓ 0.8s     │ │ ↑ 4%       │ │ ↑ 3      │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│                                                             │
│  🔥 Insights Automáticos                                   │
│  ─────────────────────────────────────────────────────────  │
│  💡 "Suporte Premium" teve 40% mais perguntas sobre        │
│     "resgates" esta semana - considere criar FAQ           │
│                                                             │
│  💡 Horário de pico: 14h-16h (32% das msgs) - bot está     │
│     respondendo bem nesse período                          │
│                                                             │
│  ⚠️ 12 mensagens não respondidas por falta de contexto -   │
│     revise a base de conhecimento                          │
│                                                             │
│  📈 Tópicos Mais Perguntados                               │
│  ─────────────────────────────────────────────────────────  │
│  1. Como resgatar tokens      │ 312 │ 89% resolvido       │
│  2. Taxas e custos            │ 187 │ 94% resolvido       │
│  3. Prazo de liquidação       │ 143 │ 78% resolvido       │
│  4. Problemas de login        │ 98  │ 45% resolvido ⚠️    │
│  5. Novos produtos            │ 76  │ 92% resolvido       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.7 Admin & Compliance

**Objetivo:** Segurança, controle de acesso e conformidade regulatória.

#### RF-ADM-01: RBAC (Role-Based Access Control)
**Descrição:** Papéis e permissões granulares.

**Papéis Pré-definidos:**
| Papel | Descrição | Permissões |
|-------|-----------|------------|
| **Owner** | Dono da conta | Tudo, incluindo billing e delete |
| **Admin** | Administrador | Tudo exceto billing e delete conta |
| **Editor** | Gerente de grupos | CRUD grupos, configs, analytics read |
| **Viewer** | Visualizador | Read-only em tudo |
| **Billing** | Financeiro | Apenas billing e usage |

**Permissões Granulares:**
```yaml
permissions:
  groups:
    - groups.list
    - groups.create
    - groups.update
    - groups.delete
    - groups.pause
    
  behavior:
    - behavior.view
    - behavior.edit
    - behavior.specialists.manage
    
  billing:
    - billing.view
    - billing.manage
    - billing.upgrade
    
  admin:
    - admin.users.invite
    - admin.users.remove
    - admin.roles.manage
    - admin.audit.view
    - admin.compliance.manage
```

#### RF-ADM-02: SSO/SAML (Enterprise)
**Descrição:** Single Sign-On para empresas.

**Providers Suportados:**
- Azure Active Directory
- Okta
- Google Workspace
- OneLogin
- Auth0 (genérico SAML 2.0)

**Configuração:**
```yaml
sso:
  provider: "azure_ad"
  tenant_id: "xxx-xxx-xxx"
  client_id: "yyy-yyy-yyy"
  domain: "@liqi.com.br"
  auto_provision: true  # Cria usuário no primeiro login
  default_role: "viewer"
  mfa_required: true
```

#### RF-ADM-03: Audit Logs
**Descrição:** Registro imutável de todas as ações.

**Eventos Logados:**
| Categoria | Eventos |
|-----------|---------|
| Auth | login, logout, login_failed, mfa_enabled |
| Groups | created, updated, deleted, paused, resumed |
| Behavior | personality_changed, specialist_added, guardrail_updated |
| Users | invited, removed, role_changed |
| Billing | plan_upgraded, payment_failed, limit_reached |
| API | key_created, key_revoked, rate_limit_exceeded |

**Formato do Log:**
```json
{
  "id": "evt_abc123",
  "timestamp": "2025-01-29T14:32:18Z",
  "actor": {
    "id": "usr_xyz",
    "email": "admin@liqi.com.br",
    "ip": "189.1.2.3"
  },
  "action": "groups.behavior.updated",
  "resource": {
    "type": "group",
    "id": "grp_123",
    "name": "Suporte Premium"
  },
  "changes": {
    "personality.tom": {"old": 3, "new": 4}
  },
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "session_id": "sess_abc"
  }
}
```

**Retenção:**
- Starter: 30 dias
- Business: 90 dias
- Enterprise: 1 ano (ou custom)

**Exportação:**
- CSV/JSON download
- Webhook para SIEM (Splunk, Datadog)
- API para compliance tools

#### RF-ADM-04: LGPD Compliance
**Descrição:** Ferramentas para conformidade com LGPD.

**Funcionalidades:**
| Feature | Descrição | Obrigatório |
|---------|-----------|-------------|
| Data Inventory | Lista dados pessoais coletados | Sim |
| Consent Management | Registro de consentimentos | Sim |
| DSAR Portal | Portal para direitos dos titulares | Sim |
| Data Retention | Política de retenção configurável | Sim |
| DPA Generator | Gera DPA para assinar | Enterprise |
| Privacy Dashboard | Métricas de compliance | Enterprise |

**DSAR (Data Subject Access Request):**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Requisições LGPD                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pendentes (2)                                              │
│  ─────────────────────────────────────────────────────────  │
│  │ #123 │ Acesso │ joao@email.com │ 3 dias restantes │    │
│  │ #124 │ Exclusão │ maria@... │ 12 dias restantes │       │
│                                                             │
│  [Nova Requisição] [Exportar Relatório]                    │
│                                                             │
│  Histórico                                                  │
│  ─────────────────────────────────────────────────────────  │
│  │ #122 │ Acesso │ Concluído │ 2025-01-15 │               │
│  │ #121 │ Retificação │ Concluído │ 2025-01-10 │          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tipos de Requisição:**
1. **Acesso** - Exportar todos os dados do titular
2. **Retificação** - Corrigir dados incorretos
3. **Exclusão** - Apagar dados (com limitações legais)
4. **Portabilidade** - Exportar em formato estruturado
5. **Oposição** - Opt-out de processamento específico

---

## 5. Requisitos Não-Funcionais

### 5.1 Performance

| Métrica | Target MVP | Target V1 | Target Enterprise |
|---------|------------|-----------|-------------------|
| Latência API (p95) | <500ms | <200ms | <100ms |
| Latência resposta bot | <3s | <2s | <1.5s |
| Uptime | 99% | 99.5% | 99.9% |
| Concurrent users | 100 | 1.000 | 10.000 |
| Msgs processadas/min | 1.000 | 10.000 | 100.000 |

### 5.2 Segurança

| Requisito | Implementação | Prioridade |
|-----------|---------------|------------|
| Encryption at rest | AES-256 para dados sensíveis | P0 |
| Encryption in transit | TLS 1.3 obrigatório | P0 |
| Auth tokens | JWT com refresh, 15min expiry | P0 |
| API Keys | Scoped, rotatable, revogável | P0 |
| Rate limiting | Por IP, por user, por API key | P0 |
| SQL Injection | Prepared statements, ORM | P0 |
| XSS | CSP headers, sanitização | P0 |
| CSRF | Token validation | P0 |
| Secrets management | Vault/KMS, nunca em código | P0 |
| Penetration testing | Trimestral (Enterprise) | P1 |
| SOC 2 Type 1 | Certificação (V3) | P2 |

### 5.3 Escalabilidade

| Componente | Estratégia |
|------------|------------|
| **API** | Horizontal scaling, stateless, load balancer |
| **Database** | PostgreSQL + read replicas, connection pooling |
| **Cache** | Redis cluster, invalidação por pub/sub |
| **Queue** | BullMQ para processamento assíncrono |
| **Files** | S3/R2 para mídia, CDN para assets |
| **Logs** | ELK ou Datadog, retention tiered |

### 5.4 Multi-tenancy

**Modelo:** Row Level Security (RLS) no PostgreSQL

```sql
-- Estrutura básica
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name TEXT,
  plan TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT
);

CREATE TABLE groups (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  channel TEXT,
  external_id TEXT
);

-- RLS Policy
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON groups
  USING (workspace_id IN (
    SELECT id FROM workspaces WHERE tenant_id = current_tenant_id()
  ));
```

### 5.5 Disponibilidade

| Cenário | Estratégia |
|---------|------------|
| Falha de região | Multi-region standby (Enterprise) |
| Pico de tráfego | Auto-scaling, queue buffering |
| Falha de integração | Circuit breaker, graceful degradation |
| Manutenção | Rolling deploys, zero downtime |
| Disaster recovery | Backup diário, RPO <1h, RTO <4h |

### 5.6 Observability

**Stack:**
- **Metrics:** Prometheus + Grafana
- **Logs:** Structured logging (JSON) + Loki
- **Traces:** OpenTelemetry + Jaeger
- **Alerts:** PagerDuty/OpsGenie integration

**Dashboards:**
1. API Health (latency, errors, throughput)
2. Bot Performance (msgs/s, queue depth)
3. Business Metrics (MAU, revenue, churn)
4. Cost Tracking (infra, AI APIs)

---

## 6. Métricas de Sucesso

### 6.1 Métricas de Produto

| Métrica | Meta MVP | Meta V1 | Meta V2 |
|---------|----------|---------|---------|
| **Time to first bot** | <10 min | <5 min | <3 min |
| **Activation rate** | 50% | 70% | 80% |
| **Weekly active users** | 60% | 70% | 75% |
| **Feature adoption** | 3+ features | 5+ features | 7+ features |
| **NPS** | >30 | >50 | >60 |

**Definições:**
- **Time to first bot:** Tempo do signup até bot respondendo
- **Activation rate:** % que configura pelo menos 1 grupo ativo
- **Feature adoption:** Features únicas usadas por tenant/mês

### 6.2 Métricas de Negócio

| Métrica | Meta Q1 | Meta Q2 | Meta Q4 |
|---------|---------|---------|---------|
| **MRR** | R$ 10k | R$ 50k | R$ 200k |
| **Paying customers** | 5 | 20 | 50 |
| **Churn mensal** | <10% | <7% | <5% |
| **CAC** | - | <R$ 2k | <R$ 1.5k |
| **LTV** | - | >R$ 10k | >R$ 15k |
| **LTV/CAC** | - | >3 | >5 |

### 6.3 Métricas Técnicas

| Métrica | Target |
|---------|--------|
| **Uptime** | >99.5% |
| **MTTR** | <30 min |
| **Deploy frequency** | >1/dia |
| **Lead time** | <2 dias |
| **Bug escape rate** | <5% |
| **Test coverage** | >80% |

### 6.4 North Star Metric

> **"Mensagens valiosas por semana"**
> 
> Definição: Mensagens do bot que receberam reação positiva, 
> foram seguidas de "obrigado", ou resolveram uma pergunta 
> sem escalação.
> 
> Meta: 10.000 mensagens valiosas/semana até Q4.

---

## 7. Riscos e Mitigações

### 7.1 Riscos de Produto

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Bot fala algo inadequado** | Alta | Alto | Guardrails rígidos, review humano inicial, kill switch |
| **Usuários não entendem configs** | Alta | Médio | Wizard simplificado, defaults inteligentes, tooltips |
| **Personalidade não funciona** | Média | Alto | A/B testing, feedback loop, ajuste por grupo |
| **Feature creep** | Alta | Alto | PRD como contrato, priorização brutal |
| **Churn por falta de valor** | Média | Alto | Onboarding assistido, health checks, CS proativo |

### 7.2 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Custo de IA explode** | Alta | Alto | Rate limiting, cache de respostas similares, alertas |
| **WhatsApp bane número** | Média | Crítico | Múltiplos números, compliance com ToS, warm-up gradual |
| **Vazamento de dados** | Baixa | Crítico | Encryption, RLS, pentests, bug bounty |
| **Downtime prolongado** | Baixa | Alto | Multi-region, runbooks, on-call rotation |
| **Dependência de API externa** | Média | Alto | Circuit breakers, fallback models, cache |

### 7.3 Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Concorrente com mais funding** | Alta | Alto | Velocidade de execução, nicho específico, relacionamento |
| **Liqi desiste do piloto** | Baixa | Alto | Contrato mínimo, entregas incrementais, múltiplos pilotos |
| **Regulação de IA** | Média | Médio | Compliance proativo, transparência, human-in-the-loop |
| **Pricing errado** | Média | Médio | Experimentos de preço, tiers flexíveis, feedback constante |
| **Time não escala** | Média | Alto | Documentação, processos, contratação antecipada |

### 7.4 Matriz de Risco

```
           IMPACTO
         Alto    │ Crítico
                 │
    WhatsApp ban │ Vazamento
    Custo IA     │ dados
    Concorrente  │
                 │
    ─────────────┼─────────────
                 │
    UX confusa   │ Bot fala
    Pricing      │ inadequado
    Time         │
                 │
         Médio   │ Alto
                 │
          Média     Alta
              PROBABILIDADE
```

### 7.5 Plano de Contingência

**Se WhatsApp banir:**
1. Comunicar clientes imediatamente
2. Ativar número backup (já provisionado)
3. Migrar grupos em <4h
4. Post-mortem e ajuste de práticas

**Se custo de IA explodir:**
1. Ativar rate limiting emergencial
2. Comunicar clientes sobre limitações temporárias
3. Negociar com provider (OpenAI, Anthropic)
4. Avaliar modelos alternativos (Claude, Llama)

**Se vazamento de dados:**
1. Acionar plano de resposta a incidentes
2. Notificar ANPD em <72h (LGPD)
3. Notificar clientes afetados
4. Investigação forense
5. Remediação e relatório público

---

## Apêndices

### A. Glossário

| Termo | Definição |
|-------|-----------|
| **Tenant** | Empresa/organização cliente |
| **Workspace** | Agrupamento lógico de grupos (ex: departamento) |
| **Group/Channel** | Grupo de WhatsApp/Discord/Telegram |
| **Crédito** | Unidade de consumo para billing |
| **Especialista** | Persona contextual do bot |
| **Guardrail** | Restrição de comportamento |
| **DSAR** | Data Subject Access Request (LGPD) |
| **RLS** | Row Level Security (PostgreSQL) |

### B. Stack Técnica Proposta

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Frontend | Next.js 14 + Tailwind | SSR, DX, ecosystem |
| Backend | Hono (Cloudflare Workers) | Edge-first, baixa latência |
| Database | PostgreSQL (Neon/Supabase) | RLS nativo, maturidade |
| Cache | Redis (Upstash) | Serverless, global |
| Queue | BullMQ / Cloudflare Queues | Processamento async |
| Auth | Clerk / Auth.js | SSO ready, magic links |
| Payments | Stripe | Padrão de mercado |
| AI | OpenAI + Anthropic | Redundância, qualidade |
| **LLM Gateway** | Custom (ver `LLM-GATEWAY.md`) | Multi-tenancy, tracking, fallback |
| Observability | Axiom + Sentry | Serverless-friendly |

### C. Referências

- [Avaliação Consolidada do Dashboard](../EVAL-DASHBOARD-2026-01-29.md)
- [LLM Gateway Specification](./LLM-GATEWAY.md) - Hub centralizado de LLM para multi-tenancy
- WhatsApp Business API Guidelines
- LGPD - Lei 13.709/2018
- OpenAI Usage Policies

---

**Changelog:**

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | 2025-01-29 | Product | Versão inicial |

---

*Este documento é vivo e será atualizado conforme aprendizados dos pilotos.*
