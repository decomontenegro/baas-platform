'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Save,
  X,
  Zap,
  Clock,
  MessageSquare,
  ThumbsDown,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import type { HandoffRule, HandoffTriggerType, HandoffPriority } from '@/types/handoff'
import { triggerTypeLabels, priorityLabels, priorityColors } from '@/types/handoff'

interface HandoffRulesProps {
  rules: HandoffRule[]
  isLoading: boolean
  onCreateRule: (rule: Partial<HandoffRule>) => Promise<void>
  onUpdateRule: (id: string, rule: Partial<HandoffRule>) => Promise<void>
  onDeleteRule: (id: string) => Promise<void>
  onToggleRule: (id: string, isActive: boolean) => Promise<void>
  workspaceId: string
}

const triggerIcons: Record<HandoffTriggerType, React.ElementType> = {
  KEYWORD: MessageSquare,
  SENTIMENT: ThumbsDown,
  BOT_LOOP: RefreshCw,
  SCHEDULE: Clock,
  INTENT: Zap,
  CUSTOM: Settings,
}

export function HandoffRules({
  rules,
  isLoading,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
  workspaceId,
}: HandoffRulesProps) {
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [editingRule, setEditingRule] = React.useState<HandoffRule | null>(null)
  const [expandedRule, setExpandedRule] = React.useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Regras de Handoff</h3>
          <p className="text-sm text-muted-foreground">
            Configure quando o bot deve transferir para um atendente humano
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {rules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border rounded-lg bg-muted/30"
            >
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="font-medium mb-2">Nenhuma regra configurada</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Crie regras para automatizar a transferência para atendentes
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira regra
              </Button>
            </motion.div>
          ) : (
            rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                isExpanded={expandedRule === rule.id}
                onToggleExpand={() =>
                  setExpandedRule(expandedRule === rule.id ? null : rule.id)
                }
                onEdit={() => setEditingRule(rule)}
                onDelete={() => onDeleteRule(rule.id)}
                onToggle={() => onToggleRule(rule.id, !rule.isActive)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Create/Edit Modal */}
      <RuleModal
        open={showCreateModal || !!editingRule}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false)
            setEditingRule(null)
          }
        }}
        rule={editingRule}
        workspaceId={workspaceId}
        onSave={async (data) => {
          if (editingRule) {
            await onUpdateRule(editingRule.id, data)
          } else {
            await onCreateRule(data)
          }
          setShowCreateModal(false)
          setEditingRule(null)
        }}
      />
    </div>
  )
}

interface RuleCardProps {
  rule: HandoffRule
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function RuleCard({
  rule,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggle,
}: RuleCardProps) {
  const TriggerIcon = triggerIcons[rule.triggerType]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        !rule.isActive && 'bg-muted/30 opacity-60'
      )}
    >
      {/* Rule Header */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div
          className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center',
            rule.isActive
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <TriggerIcon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{rule.name}</h4>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                priorityColors[rule.priority]
              )}
            >
              {priorityLabels[rule.priority]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {rule.description || triggerTypeLabels[rule.triggerType]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {rule.triggerCount} disparos
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              rule.isActive
                ? 'text-green-600 hover:bg-green-50'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label={rule.isActive ? 'Desativar regra' : 'Ativar regra'}
          >
            {rule.isActive ? (
              <Power className="h-4 w-4" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
          </button>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t"
          >
            <div className="p-4 space-y-4">
              {/* Trigger Config */}
              <div>
                <h5 className="text-sm font-medium mb-2">Configuração do Gatilho</h5>
                <TriggerConfigDisplay
                  triggerType={rule.triggerType}
                  config={rule.triggerConfig}
                />
              </div>

              {/* Auto Reply */}
              {rule.autoReplyMessage && (
                <div>
                  <h5 className="text-sm font-medium mb-2">Mensagem Automática</h5>
                  <p className="text-sm bg-muted rounded-lg p-3">
                    {rule.autoReplyMessage}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface TriggerConfigDisplayProps {
  triggerType: HandoffTriggerType
  config: Record<string, unknown>
}

function TriggerConfigDisplay({ triggerType, config }: TriggerConfigDisplayProps) {
  switch (triggerType) {
    case 'KEYWORD':
      return (
        <div className="flex flex-wrap gap-2">
          {((config.keywords as string[]) || []).map((keyword, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-primary/10 text-primary rounded text-sm"
            >
              {keyword}
            </span>
          ))}
        </div>
      )

    case 'SENTIMENT':
      return (
        <div className="text-sm text-muted-foreground">
          <p>Threshold: {(config.threshold as number) || -0.5}</p>
          <p>Mensagens negativas consecutivas: {(config.consecutiveNegative as number) || 3}</p>
        </div>
      )

    case 'BOT_LOOP':
      return (
        <div className="text-sm text-muted-foreground">
          <p>Máximo de tentativas: {(config.maxRetries as number) || 3}</p>
          <p>Janela de tempo: {(config.timeWindowMinutes as number) || 5} minutos</p>
        </div>
      )

    case 'SCHEDULE':
      const workHours = config.workHours as { start: string; end: string } | undefined
      return (
        <div className="text-sm text-muted-foreground">
          <p>Fora do horário comercial: {config.outsideHours ? 'Sim' : 'Não'}</p>
          {workHours && (
            <p>Horário: {workHours.start} - {workHours.end}</p>
          )}
          <p>Fuso: {(config.timezone as string) || 'America/Sao_Paulo'}</p>
        </div>
      )

    default:
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      )
  }
}

interface RuleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: HandoffRule | null
  workspaceId: string
  onSave: (data: Partial<HandoffRule>) => Promise<void>
}

function RuleModal({
  open,
  onOpenChange,
  rule,
  workspaceId,
  onSave,
}: RuleModalProps) {
  const [formData, setFormData] = React.useState<Partial<HandoffRule>>({
    name: '',
    description: '',
    triggerType: 'KEYWORD',
    triggerConfig: { keywords: [] },
    priority: 'NORMAL',
    autoReplyMessage: '',
    isActive: true,
  })
  const [keywords, setKeywords] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  // Reset form when opening/closing or switching rules
  React.useEffect(() => {
    if (rule) {
      setFormData(rule)
      if (rule.triggerType === 'KEYWORD') {
        setKeywords(((rule.triggerConfig.keywords as string[]) || []).join(', '))
      }
    } else {
      setFormData({
        name: '',
        description: '',
        triggerType: 'KEYWORD',
        triggerConfig: { keywords: [] },
        priority: 'NORMAL',
        autoReplyMessage: '',
        isActive: true,
      })
      setKeywords('')
    }
  }, [rule, open])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const data = { ...formData, workspaceId }
      
      if (formData.triggerType === 'KEYWORD') {
        data.triggerConfig = {
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        }
      }

      await onSave(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={rule ? 'Editar Regra' : 'Nova Regra'}
      description="Configure quando o handoff deve ser acionado"
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Nome da regra</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Palavras de urgência"
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Descrição</label>
          <input
            type="text"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Transfere quando cliente usa palavras de urgência"
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Trigger Type */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Tipo de gatilho</label>
          <select
            value={formData.triggerType}
            onChange={(e) =>
              setFormData({
                ...formData,
                triggerType: e.target.value as HandoffTriggerType,
                triggerConfig: {},
              })
            }
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(triggerTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Trigger Config - Keywords */}
        {formData.triggerType === 'KEYWORD' && (
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Palavras-chave (separadas por vírgula)
            </label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Ex: humano, atendente, falar com pessoa, reclamação"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Prioridade</label>
          <select
            value={formData.priority}
            onChange={(e) =>
              setFormData({ ...formData, priority: e.target.value as HandoffPriority })
            }
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Auto Reply */}
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Mensagem automática (opcional)
          </label>
          <textarea
            value={formData.autoReplyMessage || ''}
            onChange={(e) =>
              setFormData({ ...formData, autoReplyMessage: e.target.value })
            }
            placeholder="Ex: Aguarde um momento, estamos transferindo você para um atendente."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!formData.name || isSaving}>
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default HandoffRules
