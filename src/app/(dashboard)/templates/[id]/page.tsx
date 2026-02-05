'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Star,
  Users,
  Clock,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
  MessageSquare,
  Settings,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { TemplatePreview, PersonalityBars } from '@/components/templates/TemplatePreview'
import { TemplateCustomizer } from '@/components/templates/TemplateCustomizer'
import { cn } from '@/lib/utils'
import type { Template, TemplateConfig } from '@/types/templates'

// Mock data - in production this would come from API
const mockTemplates: Record<string, Template> = {
  'tpl_atendimento_geral': {
    id: 'tpl_atendimento_geral',
    name: 'Atendimento ao Cliente',
    slug: 'atendimento-cliente-geral',
    description: 'Bot de atendimento completo que responde dúvidas gerais, coleta informações do cliente e escala para humanos quando necessário. Ideal para empresas que precisam de um primeiro contato automatizado eficiente e personalizado.',
    categoryId: 'cat_atendimento',
    icon: '🎧',
    color: 'blue',
    tags: ['atendimento', 'suporte', 'geral', 'escalonamento', 'coleta de dados'],
    usageCount: 12453,
    rating: 4.8,
    ratingCount: 234,
    isPublic: true,
    isOfficial: true,
    isFeatured: true,
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-28T15:30:00Z',
    config: {
      systemPrompt: `Você é um assistente de atendimento ao cliente amigável e profissional.

Suas responsabilidades:
1. Cumprimentar o cliente de forma cordial
2. Identificar a necessidade do cliente
3. Responder dúvidas comuns sobre produtos/serviços
4. Coletar informações relevantes (nome, email, telefone) quando necessário
5. Escalar para um atendente humano se a questão for complexa

Diretrizes:
- Seja sempre educado e paciente
- Use linguagem clara e acessível
- Confirme o entendimento antes de prosseguir
- Nunca invente informações - se não souber, ofereça transferir para um humano
- Proteja dados sensíveis do cliente

Ao identificar que precisa de um humano, diga: "Vou transferir você para um de nossos especialistas que poderá ajudar melhor com essa questão."`,
      personality: { creativity: 30, formality: 60, verbosity: 50, empathy: 80, humor: 20 },
      welcomeMessage: 'Olá! 👋 Bem-vindo(a) ao nosso atendimento. Como posso ajudá-lo(a) hoje?',
      suggestedKnowledge: ['FAQ', 'Políticas da Empresa', 'Catálogo de Produtos/Serviços', 'Informações de Contato'],
      handoffRules: {
        enabled: true,
        triggers: ['falar com humano', 'atendente', 'reclamação', 'problema grave', 'cancelar', 'reembolso'],
        message: 'Entendo que sua questão precisa de atenção especial. Vou transferir você para um de nossos especialistas. Por favor, aguarde um momento.',
        emailNotification: true,
      },
      quickReplies: ['Horário de funcionamento', 'Formas de pagamento', 'Prazo de entrega', 'Falar com atendente'],
      exampleConversations: [
        { role: 'user', content: 'Olá, preciso de ajuda' },
        { role: 'assistant', content: 'Olá! 👋 Fico feliz em ajudar. Sobre qual assunto você gostaria de saber mais?' },
        { role: 'user', content: 'Quais são os horários de atendimento?' },
        { role: 'assistant', content: 'Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 9h às 13h. Precisa de mais alguma informação?' },
        { role: 'user', content: 'E se eu precisar falar com alguém fora do horário?' },
        { role: 'assistant', content: 'Fora do horário comercial, você pode deixar sua mensagem aqui que responderemos assim que possível, ou enviar um email para suporte@empresa.com. Há algo mais em que posso ajudar?' },
      ],
    },
  },
  // Add more mock templates as needed...
}

// Fallback for templates not in mock
const getTemplate = (id: string): Template | null => {
  return mockTemplates[id] || null
}

type Tab = 'preview' | 'customize' | 'details'

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [isApplying, setIsApplying] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  useEffect(() => {
    // Simulate fetching template
    const t = getTemplate(templateId)
    if (t) {
      setTemplate(t)
    } else {
      // For templates not in mock, create a placeholder
      setTemplate({
        id: templateId,
        name: 'Template',
        slug: templateId,
        description: 'Template de bot configurável',
        categoryId: 'cat_atendimento',
        icon: '🤖',
        color: 'blue',
        tags: ['template'],
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
        isPublic: true,
        isOfficial: false,
        isFeatured: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        config: {
          systemPrompt: 'Você é um assistente útil.',
          personality: { creativity: 50, formality: 50, verbosity: 50, empathy: 50, humor: 50 },
          welcomeMessage: 'Olá! Como posso ajudar?',
          suggestedKnowledge: [],
          handoffRules: { enabled: false, triggers: [], message: '' },
          quickReplies: [],
          exampleConversations: [],
        },
      })
    }
  }, [templateId])

  const handleApplyTemplate = async (config: TemplateConfig) => {
    setIsApplying(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsApplying(false)
    setShowSuccess(true)

    // Redirect after success
    setTimeout(() => {
      router.push('/dashboard/behavior')
    }, 2000)
  }

  const handleCopyPrompt = () => {
    if (template) {
      navigator.clipboard.writeText(template.config.systemPrompt)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    }
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-muted-foreground">Carregando template...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Template aplicado com sucesso!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/templates" className="hover:text-foreground transition-colors">
          Templates
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{template.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <Link
            href="/templates"
            className="p-2 hover:bg-muted rounded-lg transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{template.icon}</span>
              <div>
                <h1 className="text-2xl font-bold">{template.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {template.isOfficial && (
                    <Badge variant="secondary">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Oficial
                    </Badge>
                  )}
                  {template.isFeatured && (
                    <Badge className="bg-amber-500 text-white">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Destaque
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl">{template.description}</p>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{template.usageCount.toLocaleString('pt-BR')} usos</span>
              </div>
              {template.rating && template.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{template.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground/60">({template.ratingCount} avaliações)</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Atualizado em {new Date(template.updatedAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
          <button
            onClick={() => setActiveTab('customize')}
            className="flex-1 lg:flex-none px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Usar Template
          </button>
          <button
            onClick={handleCopyPrompt}
            className="px-4 py-3 border rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Prompt
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {[
            { id: 'preview', label: 'Preview', icon: MessageSquare },
            { id: 'customize', label: 'Customizar', icon: Settings },
            { id: 'details', label: 'Detalhes', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        <AnimatePresence mode="wait">
          {activeTab === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid gap-6 lg:grid-cols-2"
            >
              {/* Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Conversa de Exemplo</h3>
                <TemplatePreview template={template} className="h-[500px]" />
              </div>

              {/* Personality */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Personalidade</h3>
                  <div className="p-6 border rounded-xl">
                    <PersonalityBars template={template} />
                  </div>
                </div>

                {/* Handoff Rules */}
                {template.config.handoffRules.enabled && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Escalonamento</h3>
                    <div className="p-6 border rounded-xl space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Gatilhos:</p>
                        <div className="flex flex-wrap gap-2">
                          {template.config.handoffRules.triggers.map((trigger, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs"
                            >
                              {trigger}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Mensagem:</p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                          {template.config.handoffRules.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested Knowledge */}
                {template.config.suggestedKnowledge.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Base de Conhecimento Sugerida</h3>
                    <div className="p-6 border rounded-xl">
                      <div className="flex flex-wrap gap-2">
                        {template.config.suggestedKnowledge.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                          >
                            <BookOpen className="w-3 h-3" />
                            {item}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Faça upload desses documentos para melhor performance do bot.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'customize' && (
            <motion.div
              key="customize"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="border rounded-xl overflow-hidden h-[700px]"
            >
              <TemplateCustomizer
                template={template}
                onSave={handleApplyTemplate}
                onCancel={() => setActiveTab('preview')}
                isSaving={isApplying}
              />
            </motion.div>
          )}

          {activeTab === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">System Prompt</h3>
                  <button
                    onClick={handleCopyPrompt}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedPrompt ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="p-6 bg-muted rounded-xl">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {template.config.systemPrompt}
                  </pre>
                </div>
              </div>

              {/* Quick Replies */}
              {template.config.quickReplies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Respostas Rápidas</h3>
                  <div className="flex flex-wrap gap-2">
                    {template.config.quickReplies.map((reply, i) => (
                      <span
                        key={i}
                        className="px-4 py-2 bg-muted rounded-full text-sm"
                      >
                        {reply}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Configurações do Modelo</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="p-4 border rounded-xl">
                    <p className="text-sm text-muted-foreground">Modelo</p>
                    <p className="font-medium">{template.config.model || 'gpt-4o-mini'}</p>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <p className="text-sm text-muted-foreground">Temperatura</p>
                    <p className="font-medium">{template.config.temperature || 0.7}</p>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <p className="text-sm text-muted-foreground">Max Tokens</p>
                    <p className="font-medium">{template.config.maxTokens || 2048}</p>
                  </div>
                </div>
              </div>

              {/* Full Conversation Example */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Exemplo Completo de Conversa</h3>
                <div className="space-y-3 p-6 border rounded-xl">
                  {/* Welcome message */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex-shrink-0 flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]">
                      <p className="text-sm">{template.config.welcomeMessage}</p>
                    </div>
                  </div>

                  {template.config.exampleConversations.map((msg, i) => (
                    <div
                      key={i}
                      className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm',
                          msg.role === 'user' ? 'bg-muted' : 'bg-gradient-to-br from-primary to-primary/60'
                        )}
                      >
                        {msg.role === 'user' ? '👤' : '🤖'}
                      </div>
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-3 max-w-[80%]',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        )}
                      >
                        <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
