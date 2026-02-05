'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Bot,
  Sparkles,
  Settings2,
  MessageSquare,
  Brain,
  Loader2,
} from 'lucide-react'
import { BotTemplateSelector, TemplatePreview } from '@/components/bots/BotTemplateSelector'
import { PersonalitySliders } from '@/components/bots/PersonalitySliders'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  BOT_TEMPLATES,
  AI_MODELS,
  type BotTemplate,
  type BotPersonality,
  type CreateBotInput,
} from '@/types/bot'

const STEPS = [
  { id: 'template', title: 'Template', icon: Sparkles },
  { id: 'basic', title: 'Informações', icon: Bot },
  { id: 'personality', title: 'Personalidade', icon: Settings2 },
  { id: 'prompts', title: 'Configuração', icon: MessageSquare },
  { id: 'review', title: 'Revisão', icon: Check },
]

const DEFAULT_PERSONALITY: BotPersonality = {
  creativity: 50,
  formality: 50,
  verbosity: 50,
  empathy: 70,
  humor: 30,
}

export default function NewBotPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null)
  const [formData, setFormData] = useState<CreateBotInput>({
    name: '',
    description: '',
    avatar: '',
    personality: DEFAULT_PERSONALITY,
    systemPrompt: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    welcomeMessage: '',
    quickReplies: [],
    handoffEnabled: true,
    handoffTriggers: ['falar com humano', 'atendente', 'pessoa'],
    handoffMessage: 'Vou transferir você para um atendente humano.',
    tags: [],
  })

  // Apply template
  const handleSelectTemplate = (template: BotTemplate | null) => {
    setSelectedTemplate(template)
    if (template) {
      setFormData({
        ...formData,
        name: template.name,
        description: template.description,
        avatar: template.icon,
        personality: template.personality,
        systemPrompt: template.systemPrompt,
        welcomeMessage: template.welcomeMessage,
        quickReplies: template.quickReplies,
        handoffTriggers: template.handoffTriggers,
        tags: template.tags,
      })
    } else {
      // Reset to defaults
      setFormData({
        ...formData,
        name: '',
        description: '',
        avatar: '',
        personality: DEFAULT_PERSONALITY,
        systemPrompt: '',
        welcomeMessage: '',
        quickReplies: [],
        handoffTriggers: ['falar com humano', 'atendente', 'pessoa'],
        tags: [],
      })
    }
  }

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 0: // Template
        return true
      case 1: // Basic info
        return formData.name.trim().length > 0
      case 2: // Personality
        return true
      case 3: // Prompts
        return formData.systemPrompt.trim().length > 0
      case 4: // Review
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao criar bot')
      }

      toast.success('Bot criado com sucesso!')
      router.push(`/bots/${result.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar bot')
    } finally {
      setIsCreating(false)
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Template
        return (
          <div className="space-y-6">
            <BotTemplateSelector
              selectedId={selectedTemplate?.id ?? null}
              onSelect={handleSelectTemplate}
            />
            {selectedTemplate && (
              <div className="mt-8 p-6 bg-muted/50 rounded-xl">
                <TemplatePreview template={selectedTemplate} />
              </div>
            )}
          </div>
        )

      case 1: // Basic info
        return (
          <div className="max-w-xl space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nome do bot *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Sofia, Max, Alex..."
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descrição</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva brevemente a função deste bot..."
                rows={3}
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Avatar (emoji)</label>
              <input
                type="text"
                value={formData.avatar || ''}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                placeholder="Ex: 👩‍💼, 🤖, 💼..."
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={4}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use um emoji para representar seu bot
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <input
                type="text"
                value={formData.tags?.join(', ') || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="atendimento, vendas, suporte..."
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Separe as tags por vírgula
              </p>
            </div>
          </div>
        )

      case 2: // Personality
        return (
          <div className="max-w-xl space-y-6">
            <p className="text-muted-foreground">
              Ajuste os traços de personalidade para definir como o bot irá se comportar nas conversas.
            </p>
            <PersonalitySliders
              personality={formData.personality || DEFAULT_PERSONALITY}
              onChange={(personality) => setFormData({ ...formData, personality })}
            />
          </div>
        )

      case 3: // Prompts & Config
        return (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">System Prompt *</label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Você é um assistente de atendimento ao cliente..."
                rows={8}
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Defina a personalidade, comportamento e instruções do bot
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Modelo</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {AI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Temperatura: {formData.temperature}
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preciso</span>
                  <span>Criativo</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem de boas-vindas</label>
              <textarea
                value={formData.welcomeMessage || ''}
                onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                placeholder="Olá! Como posso ajudá-lo?"
                rows={2}
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Respostas rápidas</label>
              <input
                type="text"
                value={formData.quickReplies?.join(', ') || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quickReplies: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="Horário de funcionamento, Preços, Falar com atendente..."
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Transferência para humano</p>
                  <p className="text-sm text-muted-foreground">
                    Permitir que o bot transfira para um atendente
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, handoffEnabled: !formData.handoffEnabled })
                  }
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    formData.handoffEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                      formData.handoffEnabled ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {formData.handoffEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Palavras-chave de transferência
                    </label>
                    <input
                      type="text"
                      value={formData.handoffTriggers?.join(', ') || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          handoffTriggers: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="falar com humano, atendente, pessoa..."
                      className="w-full px-4 py-2 bg-background rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Mensagem de transferência
                    </label>
                    <input
                      type="text"
                      value={formData.handoffMessage || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, handoffMessage: e.target.value })
                      }
                      placeholder="Vou transferir você para um atendente..."
                      className="w-full px-4 py-2 bg-background rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )

      case 4: // Review
        return (
          <div className="max-w-2xl space-y-6">
            <div className="p-6 bg-muted/50 rounded-xl space-y-6">
              {/* Bot preview */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
                  {formData.avatar || <Bot className="w-8 h-8 text-primary" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{formData.name}</h2>
                  <p className="text-muted-foreground">{formData.description}</p>
                </div>
              </div>

              {/* Config summary */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-background rounded-lg">
                  <p className="text-sm text-muted-foreground">Modelo</p>
                  <p className="font-medium">
                    {AI_MODELS.find((m) => m.id === formData.model)?.name || formData.model}
                  </p>
                </div>
                <div className="p-4 bg-background rounded-lg">
                  <p className="text-sm text-muted-foreground">Temperatura</p>
                  <p className="font-medium">{formData.temperature}</p>
                </div>
              </div>

              {/* Personality preview */}
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">Personalidade</p>
                <PersonalitySliders
                  personality={formData.personality || DEFAULT_PERSONALITY}
                  readonly
                  compact
                />
              </div>

              {/* System prompt preview */}
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">System Prompt</p>
                <p className="text-sm font-mono whitespace-pre-wrap line-clamp-5">
                  {formData.systemPrompt}
                </p>
              </div>

              {/* Tags */}
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-background rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/bots')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Criar novo bot</h1>
            <p className="text-muted-foreground">
              Configure um assistente personalizado em poucos passos
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                      : 'text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-1',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      <div className="sticky bottom-0 bg-background border-t py-4 -mx-4 -mb-4 px-4 mt-auto">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              currentStep === 0
                ? 'text-muted-foreground cursor-not-allowed'
                : 'hover:bg-muted'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg transition-colors',
                canGoNext()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Criar Bot
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
