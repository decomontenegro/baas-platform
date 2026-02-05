'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { Template, TemplateConfig } from '@/types/templates'

interface TemplateCustomizerProps {
  template: Template
  onSave: (config: TemplateConfig) => void
  onCancel: () => void
  isSaving?: boolean
}

export function TemplateCustomizer({
  template,
  onSave,
  onCancel,
  isSaving = false,
}: TemplateCustomizerProps) {
  const [config, setConfig] = useState<TemplateConfig>(template.config)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['personality', 'system'])
  )

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handlePersonalityChange = (key: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      personality: {
        ...prev.personality,
        [key]: value,
      },
    }))
  }

  const handleQuickReplyAdd = () => {
    setConfig((prev) => ({
      ...prev,
      quickReplies: [...prev.quickReplies, ''],
    }))
  }

  const handleQuickReplyChange = (index: number, value: string) => {
    setConfig((prev) => ({
      ...prev,
      quickReplies: prev.quickReplies.map((qr, i) => (i === index ? value : qr)),
    }))
  }

  const handleQuickReplyRemove = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      quickReplies: prev.quickReplies.filter((_, i) => i !== index),
    }))
  }

  const handleHandoffTriggerAdd = () => {
    setConfig((prev) => ({
      ...prev,
      handoffRules: {
        ...prev.handoffRules,
        triggers: [...prev.handoffRules.triggers, ''],
      },
    }))
  }

  const handleHandoffTriggerChange = (index: number, value: string) => {
    setConfig((prev) => ({
      ...prev,
      handoffRules: {
        ...prev.handoffRules,
        triggers: prev.handoffRules.triggers.map((t, i) => (i === index ? value : t)),
      },
    }))
  }

  const handleHandoffTriggerRemove = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      handoffRules: {
        ...prev.handoffRules,
        triggers: prev.handoffRules.triggers.filter((_, i) => i !== index),
      },
    }))
  }

  const handleReset = () => {
    setConfig(template.config)
  }

  const handleSave = () => {
    // Filter out empty values
    const cleanConfig = {
      ...config,
      quickReplies: config.quickReplies.filter((qr) => qr.trim()),
      handoffRules: {
        ...config.handoffRules,
        triggers: config.handoffRules.triggers.filter((t) => t.trim()),
      },
    }
    onSave(cleanConfig)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{template.icon}</span>
          <div>
            <h3 className="font-semibold">Customizar Template</h3>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Resetar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* System Prompt Section */}
        <CollapsibleSection
          title="System Prompt"
          description="Instruções principais do bot"
          expanded={expandedSections.has('system')}
          onToggle={() => toggleSection('system')}
        >
          <div className="space-y-2">
            <textarea
              value={config.systemPrompt}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))
              }
              rows={10}
              className="w-full px-3 py-2 bg-muted rounded-lg text-sm font-mono resize-none outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Você é um assistente..."
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              Este é o prompt principal que define o comportamento do bot
            </p>
          </div>
        </CollapsibleSection>

        {/* Personality Section */}
        <CollapsibleSection
          title="Personalidade"
          description="Ajuste os comportamentos do bot"
          expanded={expandedSections.has('personality')}
          onToggle={() => toggleSection('personality')}
        >
          <div className="space-y-6">
            <Slider
              label="Criatividade"
              description="Quão criativo e imaginativo o bot é"
              value={config.personality.creativity}
              onChange={(v) => handlePersonalityChange('creativity', v)}
              leftLabel="Conservador"
              rightLabel="Criativo"
              color="purple"
            />
            <Slider
              label="Formalidade"
              description="Nível de profissionalismo nas respostas"
              value={config.personality.formality}
              onChange={(v) => handlePersonalityChange('formality', v)}
              leftLabel="Casual"
              rightLabel="Formal"
              color="blue"
            />
            <Slider
              label="Verbosidade"
              description="Quão detalhadas são as respostas"
              value={config.personality.verbosity}
              onChange={(v) => handlePersonalityChange('verbosity', v)}
              leftLabel="Conciso"
              rightLabel="Detalhado"
              color="green"
            />
            <Slider
              label="Empatia"
              description="Quão emocionalmente compreensivo o bot é"
              value={config.personality.empathy}
              onChange={(v) => handlePersonalityChange('empathy', v)}
              leftLabel="Neutro"
              rightLabel="Empático"
              color="orange"
            />
            <Slider
              label="Humor"
              description="Quantidade de humor e descontração"
              value={config.personality.humor}
              onChange={(v) => handlePersonalityChange('humor', v)}
              leftLabel="Sério"
              rightLabel="Divertido"
              color="purple"
            />
          </div>
        </CollapsibleSection>

        {/* Welcome Message Section */}
        <CollapsibleSection
          title="Mensagem de Boas-vindas"
          description="Primeira mensagem do bot"
          expanded={expandedSections.has('welcome')}
          onToggle={() => toggleSection('welcome')}
        >
          <textarea
            value={config.welcomeMessage}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, welcomeMessage: e.target.value }))
            }
            rows={3}
            className="w-full px-3 py-2 bg-muted rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Olá! Como posso ajudar?"
          />
        </CollapsibleSection>

        {/* Quick Replies Section */}
        <CollapsibleSection
          title="Respostas Rápidas"
          description="Botões de atalho para o usuário"
          expanded={expandedSections.has('quickReplies')}
          onToggle={() => toggleSection('quickReplies')}
        >
          <div className="space-y-2">
            {config.quickReplies.map((reply, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => handleQuickReplyChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ex: Falar com atendente"
                />
                <button
                  onClick={() => handleQuickReplyRemove(index)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={handleQuickReplyAdd}
              className="w-full py-2 border-2 border-dashed border-muted-foreground/30 rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Adicionar resposta rápida
            </button>
          </div>
        </CollapsibleSection>

        {/* Handoff Rules Section */}
        <CollapsibleSection
          title="Regras de Escalonamento"
          description="Quando transferir para humano"
          expanded={expandedSections.has('handoff')}
          onToggle={() => toggleSection('handoff')}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.handoffRules.enabled}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    handoffRules: {
                      ...prev.handoffRules,
                      enabled: e.target.checked,
                    },
                  }))
                }
                className="rounded border-muted-foreground/30"
              />
              <span className="text-sm">Habilitar escalonamento para humano</span>
            </label>

            {config.handoffRules.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Gatilhos (palavras-chave)
                  </label>
                  <div className="space-y-2">
                    {config.handoffRules.triggers.map((trigger, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={trigger}
                          onChange={(e) =>
                            handleHandoffTriggerChange(index, e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Ex: falar com humano"
                        />
                        <button
                          onClick={() => handleHandoffTriggerRemove(index)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleHandoffTriggerAdd}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar gatilho
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Mensagem de escalonamento
                  </label>
                  <textarea
                    value={config.handoffRules.message}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        handoffRules: {
                          ...prev.handoffRules,
                          message: e.target.value,
                        },
                      }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 bg-muted rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Vou transferir você para um atendente..."
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.handoffRules.emailNotification || false}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          handoffRules: {
                            ...prev.handoffRules,
                            emailNotification: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-muted-foreground/30"
                    />
                    <span className="text-sm">Notificar por email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.handoffRules.slackNotification || false}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          handoffRules: {
                            ...prev.handoffRules,
                            slackNotification: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-muted-foreground/30"
                    />
                    <span className="text-sm">Notificar no Slack</span>
                  </label>
                </div>
              </motion.div>
            )}
          </div>
        </CollapsibleSection>

        {/* Suggested Knowledge Section */}
        <CollapsibleSection
          title="Base de Conhecimento Sugerida"
          description="Documentos recomendados para este template"
          expanded={expandedSections.has('knowledge')}
          onToggle={() => toggleSection('knowledge')}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {config.suggestedKnowledge.map((item, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Faça upload desses documentos na seção de Knowledge Base
            </p>
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-card">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
              Aplicando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Aplicar Template
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  description,
  expanded,
  onToggle,
  children,
}: {
  title: string
  description?: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="text-left">
          <h4 className="font-medium">{title}</h4>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 pt-0"
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}
