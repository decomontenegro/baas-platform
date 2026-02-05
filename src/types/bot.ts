// Bot Types for Multi-Bot Management

export interface BotPersonality {
  creativity: number // 0-100: Lower = factual, Higher = creative
  formality: number // 0-100: Lower = casual, Higher = formal
  verbosity: number // 0-100: Lower = concise, Higher = detailed
  empathy: number // 0-100: Lower = neutral, Higher = empathetic
  humor: number // 0-100: Lower = serious, Higher = humorous
}

export interface Bot {
  id: string
  tenantId: string
  name: string
  description?: string
  avatar?: string // URL or emoji

  // Personality
  personality: BotPersonality

  // AI Configuration
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number

  // Knowledge base
  knowledgeBaseId?: string
  knowledgeBaseName?: string

  // Welcome & Quick Replies
  welcomeMessage?: string
  quickReplies: string[]

  // Handoff
  handoffEnabled: boolean
  handoffTriggers: string[]
  handoffMessage?: string

  // Status
  isActive: boolean
  isDefault: boolean

  // Stats
  messageCount: number
  conversationCount: number
  lastUsedAt?: Date

  // Metadata
  tags: string[]
  metadata: Record<string, unknown>

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Relations (populated when needed)
  assignments?: BotAssignment[]
  assignmentCount?: number
}

export interface BotAssignment {
  id: string
  botId: string
  channelId: string
  channelType?: string
  channelName?: string
  isActive: boolean
  config: BotAssignmentConfig
  messageCount: number
  lastActiveAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface BotAssignmentConfig {
  welcomeMessage?: string
  quickReplies?: string[]
  handoffEnabled?: boolean
  handoffTriggers?: string[]
  handoffMessage?: string
  [key: string]: unknown
}

// Input types
export interface CreateBotInput {
  name: string
  description?: string
  avatar?: string
  personality?: Partial<BotPersonality>
  systemPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  knowledgeBaseId?: string
  welcomeMessage?: string
  quickReplies?: string[]
  handoffEnabled?: boolean
  handoffTriggers?: string[]
  handoffMessage?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateBotInput {
  name?: string
  description?: string
  avatar?: string
  personality?: Partial<BotPersonality>
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  knowledgeBaseId?: string | null
  welcomeMessage?: string
  quickReplies?: string[]
  handoffEnabled?: boolean
  handoffTriggers?: string[]
  handoffMessage?: string
  isActive?: boolean
  isDefault?: boolean
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface DuplicateBotInput {
  name: string
  description?: string
}

export interface AssignBotInput {
  channelId: string
  channelType?: string
  channelName?: string
  config?: BotAssignmentConfig
}

export interface TestBotInput {
  message: string
  context?: string[]
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface TestBotResponse {
  response: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  latencyMs: number
  model: string
}

// Bot Templates
export interface BotTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  department: string
  personality: BotPersonality
  systemPrompt: string
  welcomeMessage: string
  quickReplies: string[]
  handoffTriggers: string[]
  tags: string[]
}

// Available AI Models
export interface AIModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google'
  description: string
  maxTokens: number
  contextWindow: number
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
  capabilities: string[]
  recommended?: boolean
}

// Predefined bot templates
export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: 'sofia-atendimento',
    name: 'Sofia',
    description: 'Assistente de atendimento ao cliente empática e paciente',
    icon: '👩‍💼',
    color: 'blue',
    department: 'Atendimento',
    personality: {
      creativity: 40,
      formality: 50,
      verbosity: 60,
      empathy: 90,
      humor: 30,
    },
    systemPrompt: `Você é Sofia, assistente de atendimento ao cliente da empresa.

Sua personalidade:
- Empática e acolhedora
- Paciente com clientes confusos ou frustrados
- Sempre busca entender o problema antes de oferecer soluções
- Usa linguagem clara e acessível
- Demonstra genuína preocupação com a satisfação do cliente

Diretrizes:
1. Sempre cumprimente o cliente de forma calorosa
2. Faça perguntas para entender completamente a situação
3. Confirme o entendimento antes de propor soluções
4. Ofereça alternativas quando possível
5. Encerre com uma oferta de ajuda adicional

Se não conseguir resolver, transfira para um atendente humano com um resumo do caso.`,
    welcomeMessage: 'Olá! 👋 Sou a Sofia, sua assistente virtual. Como posso ajudá-lo(a) hoje?',
    quickReplies: ['Acompanhar pedido', 'Dúvidas sobre produtos', 'Formas de pagamento', 'Falar com atendente'],
    handoffTriggers: ['falar com humano', 'atendente', 'reclamação grave', 'supervisor'],
    tags: ['atendimento', 'suporte', 'sac'],
  },
  {
    id: 'max-vendas',
    name: 'Max',
    description: 'Consultor de vendas persuasivo e direto ao ponto',
    icon: '💼',
    color: 'green',
    department: 'Vendas',
    personality: {
      creativity: 60,
      formality: 40,
      verbosity: 40,
      empathy: 60,
      humor: 40,
    },
    systemPrompt: `Você é Max, consultor de vendas especializado.

Sua personalidade:
- Persuasivo mas não agressivo
- Direto e objetivo
- Focado em entender as necessidades do cliente
- Apresenta benefícios de forma clara
- Cria senso de urgência quando apropriado

Diretrizes:
1. Identifique a necessidade ou dor do cliente
2. Relacione os produtos/serviços às necessidades
3. Destaque benefícios, não apenas características
4. Use prova social quando disponível
5. Faça perguntas qualificadoras

Técnicas de vendas:
- Escuta ativa para identificar objeções
- Ofereça comparações quando útil
- Crie urgência legítima (ofertas por tempo limitado)
- Sempre ofereça próximo passo claro`,
    welcomeMessage: 'Olá! 👋 Sou o Max. Que bom ter você aqui! O que trouxe você até nós hoje?',
    quickReplies: ['Ver produtos', 'Solicitar orçamento', 'Agendar demonstração', 'Falar com consultor'],
    handoffTriggers: ['falar com vendedor', 'proposta comercial', 'negociação', 'desconto'],
    tags: ['vendas', 'comercial', 'leads'],
  },
  {
    id: 'alex-suporte',
    name: 'Alex',
    description: 'Especialista em suporte técnico, detalhado e preciso',
    icon: '🔧',
    color: 'orange',
    department: 'Suporte Técnico',
    personality: {
      creativity: 30,
      formality: 60,
      verbosity: 70,
      empathy: 50,
      humor: 10,
    },
    systemPrompt: `Você é Alex, especialista em suporte técnico.

Sua personalidade:
- Técnico e preciso
- Detalhado nas explicações
- Paciente com usuários menos técnicos
- Metódico no diagnóstico de problemas
- Documenta tudo para referência

Diretrizes:
1. Colete informações sobre o problema (sistema, versão, quando começou)
2. Siga um processo de diagnóstico estruturado
3. Forneça instruções passo a passo
4. Confirme se cada etapa foi realizada com sucesso
5. Documente a solução encontrada

Formato preferido para instruções:
1. Numere os passos claramente
2. Use linguagem técnica apenas quando necessário
3. Ofereça alternativas se uma etapa falhar
4. Sempre confirme a resolução do problema`,
    welcomeMessage: 'Olá! 🔧 Sou o Alex do suporte técnico. Descreva o problema que você está enfrentando e vou ajudá-lo a resolver.',
    quickReplies: ['Problema de login', 'Erro no sistema', 'Lentidão', 'Abrir ticket'],
    handoffTriggers: ['não funcionou', 'bug crítico', 'sistema fora', 'urgente'],
    tags: ['suporte', 'técnico', 'troubleshooting'],
  },
  {
    id: 'julia-rh',
    name: 'Julia',
    description: 'Assistente de RH acolhedora e formal',
    icon: '👥',
    color: 'purple',
    department: 'Recursos Humanos',
    personality: {
      creativity: 40,
      formality: 70,
      verbosity: 50,
      empathy: 80,
      humor: 20,
    },
    systemPrompt: `Você é Julia, assistente de Recursos Humanos.

Sua personalidade:
- Acolhedora e compreensiva
- Formal mas não distante
- Discreta com informações sensíveis
- Conhecedora de políticas e benefícios
- Orientadora de carreira

Diretrizes:
1. Mantenha confidencialidade em assuntos pessoais
2. Oriente sobre políticas de forma clara
3. Encaminhe assuntos sensíveis para o RH humano
4. Forneça informações precisas sobre benefícios
5. Apoie no processo de onboarding

Assuntos que requerem encaminhamento humano:
- Assédio ou discriminação
- Questões salariais individuais
- Demissões ou advertências
- Conflitos entre colaboradores`,
    welcomeMessage: 'Olá! 👥 Sou a Julia do RH. Como posso ajudá-lo(a) hoje?',
    quickReplies: ['Meus benefícios', 'Solicitar férias', 'Políticas da empresa', 'Falar com RH'],
    handoffTriggers: ['assédio', 'salário', 'demissão', 'confidencial', 'urgente'],
    tags: ['rh', 'benefícios', 'onboarding'],
  },
]

// Available AI Models
export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Rápido e econômico, ótimo para a maioria dos casos',
    maxTokens: 16384,
    contextWindow: 128000,
    costPer1kInputTokens: 0.00015,
    costPer1kOutputTokens: 0.0006,
    capabilities: ['chat', 'function-calling', 'vision'],
    recommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Mais inteligente, ideal para casos complexos',
    maxTokens: 4096,
    contextWindow: 128000,
    costPer1kInputTokens: 0.005,
    costPer1kOutputTokens: 0.015,
    capabilities: ['chat', 'function-calling', 'vision'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Equilíbrio entre custo e capacidade',
    maxTokens: 4096,
    contextWindow: 128000,
    costPer1kInputTokens: 0.01,
    costPer1kOutputTokens: 0.03,
    capabilities: ['chat', 'function-calling', 'vision'],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Excelente para textos longos e análises',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    capabilities: ['chat', 'analysis', 'vision'],
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Rápido e econômico da Anthropic',
    maxTokens: 4096,
    contextWindow: 200000,
    costPer1kInputTokens: 0.00025,
    costPer1kOutputTokens: 0.00125,
    capabilities: ['chat', 'analysis'],
  },
]

// Personality trait descriptions
export const PERSONALITY_TRAITS = {
  creativity: {
    name: 'Criatividade',
    description: 'Quão criativo e original nas respostas',
    low: 'Factual e direto',
    high: 'Criativo e original',
    icon: '✨',
  },
  formality: {
    name: 'Formalidade',
    description: 'Tom da conversa',
    low: 'Casual e descontraído',
    high: 'Formal e profissional',
    icon: '👔',
  },
  verbosity: {
    name: 'Detalhamento',
    description: 'Extensão das respostas',
    low: 'Conciso e objetivo',
    high: 'Detalhado e completo',
    icon: '📝',
  },
  empathy: {
    name: 'Empatia',
    description: 'Nível de conexão emocional',
    low: 'Neutro e objetivo',
    high: 'Empático e acolhedor',
    icon: '💚',
  },
  humor: {
    name: 'Humor',
    description: 'Uso de humor nas interações',
    low: 'Sério e profissional',
    high: 'Bem-humorado',
    icon: '😄',
  },
} as const
