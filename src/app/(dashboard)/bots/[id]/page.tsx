'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import {
  ArrowLeft,
  Save,
  Trash2,
  Power,
  Copy,
  MoreVertical,
  Loader2,
  Bot,
  Settings2,
  MessageSquare,
  Brain,
  Link,
  TestTube,
  AlertCircle,
  Star,
  Check,
  X,
} from 'lucide-react'
import { PersonalitySliders, PersonalityRadar } from '@/components/bots/PersonalitySliders'
import { BotTestChat } from '@/components/bots/BotTestChat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Bot as BotType, UpdateBotInput, BotPersonality } from '@/types/bot'
import { AI_MODELS } from '@/types/bot'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BotDetailPage() {
  const router = useRouter()
  const params = useParams()
  const botId = params.id as string

  const [activeTab, setActiveTab] = useState('settings')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state
  const [formData, setFormData] = useState<Partial<UpdateBotInput>>({})

  // Fetch bot
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    data: BotType
  }>(`/api/bots/${botId}`, fetcher)

  const bot = data?.data

  // Initialize form data when bot loads
  useEffect(() => {
    if (bot) {
      setFormData({
        name: bot.name,
        description: bot.description,
        avatar: bot.avatar,
        personality: bot.personality,
        systemPrompt: bot.systemPrompt,
        model: bot.model,
        temperature: bot.temperature,
        maxTokens: bot.maxTokens,
        knowledgeBaseId: bot.knowledgeBaseId,
        welcomeMessage: bot.welcomeMessage,
        quickReplies: bot.quickReplies,
        handoffEnabled: bot.handoffEnabled,
        handoffTriggers: bot.handoffTriggers,
        handoffMessage: bot.handoffMessage,
        isActive: bot.isActive,
        isDefault: bot.isDefault,
        tags: bot.tags,
      })
      setHasChanges(false)
    }
  }, [bot])

  // Handle form changes
  const updateForm = (updates: Partial<UpdateBotInput>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  // Save changes
  const handleSave = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao salvar')
      }

      toast.success('Bot atualizado com sucesso')
      setHasChanges(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle active
  const handleToggleActive = async () => {
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !bot?.isActive }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao atualizar')
      }

      toast.success(bot?.isActive ? 'Bot desativado' : 'Bot ativado')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    }
  }

  // Set as default
  const handleSetDefault = async () => {
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao atualizar')
      }

      toast.success('Bot definido como padrão')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    }
  }

  // Duplicate
  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/bots/${botId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${bot?.name} (cópia)` }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao duplicar')
      }

      toast.success('Bot duplicado com sucesso')
      router.push(`/bots/${result.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar')
    }
  }

  // Delete
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao deletar')
      }

      toast.success('Bot deletado')
      router.push('/bots')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Error state
  if (error || !bot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Bot não encontrado</h2>
        <p className="text-muted-foreground mb-4">O bot solicitado não existe ou foi deletado.</p>
        <button
          onClick={() => router.push('/bots')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Voltar para bots
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/bots')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
              {bot.avatar || <Bot className="w-6 h-6 text-primary" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{bot.name}</h1>
                {bot.isDefault && (
                  <Badge className="bg-amber-500 text-white">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Padrão
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={bot.isActive ? 'default' : 'secondary'}>
                  {bot.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
                {bot.assignmentCount ? (
                  <span className="text-sm text-muted-foreground">
                    • {bot.assignmentCount} {bot.assignmentCount === 1 ? 'canal' : 'canais'}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              hasChanges
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 hover:bg-muted rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleToggleActive}>
                <Power className="w-4 h-4 mr-2" />
                {bot.isActive ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
              {!bot.isDefault && (
                <DropdownMenuItem onClick={handleSetDefault}>
                  <Star className="w-4 h-4 mr-2" />
                  Definir como padrão
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm"
          >
            <span className="text-amber-800 dark:text-amber-200">
              Você tem alterações não salvas
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFormData({
                    name: bot.name,
                    description: bot.description,
                    avatar: bot.avatar,
                    personality: bot.personality,
                    systemPrompt: bot.systemPrompt,
                    model: bot.model,
                    temperature: bot.temperature,
                    maxTokens: bot.maxTokens,
                    knowledgeBaseId: bot.knowledgeBaseId,
                    welcomeMessage: bot.welcomeMessage,
                    quickReplies: bot.quickReplies,
                    handoffEnabled: bot.handoffEnabled,
                    handoffTriggers: bot.handoffTriggers,
                    handoffMessage: bot.handoffMessage,
                    isActive: bot.isActive,
                    isDefault: bot.isDefault,
                    tags: bot.tags,
                  })
                  setHasChanges(false)
                }}
                className="text-amber-600 dark:text-amber-400 hover:underline"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="personality" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Personalidade
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Testar
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            Canais
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descrição</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Avatar (emoji)</label>
                <input
                  type="text"
                  value={formData.avatar || ''}
                  onChange={(e) => updateForm({ avatar: e.target.value })}
                  maxLength={4}
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) =>
                    updateForm({
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Modelo</label>
                <select
                  value={formData.model || 'gpt-4o-mini'}
                  onChange={(e) => updateForm({ model: e.target.value })}
                  className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {AI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {AI_MODELS.find((m) => m.id === formData.model)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Temperatura: {formData.temperature || 0.7}
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={formData.temperature || 0.7}
                  onChange={(e) => updateForm({ temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preciso</span>
                  <span>Criativo</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Tokens: {formData.maxTokens || 2048}
                </label>
                <input
                  type="range"
                  min={100}
                  max={16384}
                  step={100}
                  value={formData.maxTokens || 2048}
                  onChange={(e) => updateForm({ maxTokens: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
              </div>

              {/* Stats */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">Estatísticas</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Mensagens</p>
                    <p className="font-semibold">{bot.messageCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conversas</p>
                    <p className="font-semibold">{bot.conversationCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Personality Tab */}
        <TabsContent value="personality" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-medium mb-4">Ajustar personalidade</h3>
              <PersonalitySliders
                personality={formData.personality as BotPersonality || bot.personality}
                onChange={(personality) => updateForm({ personality })}
              />
            </div>
            <div className="flex flex-col items-center justify-center">
              <PersonalityRadar
                personality={formData.personality as BotPersonality || bot.personality}
                size={250}
              />
            </div>
          </div>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6 mt-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">System Prompt</label>
              <textarea
                value={formData.systemPrompt || ''}
                onChange={(e) => updateForm({ systemPrompt: e.target.value })}
                rows={12}
                className="w-full px-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem de boas-vindas</label>
              <textarea
                value={formData.welcomeMessage || ''}
                onChange={(e) => updateForm({ welcomeMessage: e.target.value })}
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
                  updateForm({
                    quickReplies: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
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
                  onClick={() => updateForm({ handoffEnabled: !formData.handoffEnabled })}
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
                        updateForm({
                          handoffTriggers: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
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
                      onChange={(e) => updateForm({ handoffMessage: e.target.value })}
                      className="w-full px-4 py-2 bg-background rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <BotTestChat
              bot={{
                ...bot,
                ...formData,
                personality: formData.personality as BotPersonality || bot.personality,
              } as BotType}
              className="h-[600px]"
            />
          </div>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-6 mt-6">
          <div className="text-center py-12">
            <Link className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Canais conectados</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Atribua este bot a canais para que ele comece a responder automaticamente.
            </p>
            {bot.assignments && bot.assignments.length > 0 ? (
              <div className="max-w-md mx-auto space-y-2 text-left">
                {bot.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{assignment.channelName || assignment.channelId}</p>
                      <p className="text-xs text-muted-foreground">{assignment.channelType}</p>
                    </div>
                    <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                      {assignment.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum canal atribuído ainda.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar bot</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{bot.name}</strong>?
              <br />
              Esta ação não pode ser desfeita. O bot será removido de todos os canais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
