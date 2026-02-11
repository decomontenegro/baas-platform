'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Headphones,
  Settings,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Filter,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HandoffQueue } from '@/components/handoff/HandoffQueue'
import { ConversationView } from '@/components/handoff/ConversationView'
import { QuickReplies } from '@/components/handoff/QuickReplies'
import { HandoffRules } from '@/components/handoff/HandoffRules'
import { Modal } from '@/components/ui/modal'
import { useHandoffQueue, useHandoffRequest, useHandoffRules } from '@/hooks/use-handoff'
import type { HandoffRequest, HandoffStatus } from '@/types/handoff'
import { statusLabels } from '@/types/handoff'

type TabType = 'queue' | 'rules' | 'settings'

export default function HandoffPage() {
  const [activeTab, setActiveTab] = React.useState<TabType>('queue')
  const [selectedRequest, setSelectedRequest] = React.useState<HandoffRequest | null>(null)
  const [soundEnabled, setSoundEnabled] = React.useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<HandoffStatus[]>([
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'ON_HOLD',
  ])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showResolveModal, setShowResolveModal] = React.useState(false)
  const [resolutionNote, setResolutionNote] = React.useState('')

  // TODO: Get real workspace ID from session/context
  // For now, using a default workspace ID
  const workspaceId = 'default-workspace'
  const currentUserId = 'cluser123'

  // Hooks
  const {
    requests,
    stats,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useHandoffQueue({
    workspaceId,
    status: statusFilter,
    pollInterval: 15000, // Poll every 15 seconds
  })

  const {
    request: selectedRequestDetails,
    refetch: refetchRequest,
    assign,
    unassign,
    resolve,
    addNote,
    updatePriority,
  } = useHandoffRequest(selectedRequest?.id || '')

  const {
    rules,
    isLoading: rulesLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  } = useHandoffRules(workspaceId)

  // Sound notification
  React.useEffect(() => {
    if (soundEnabled && stats.pending > 0) {
      // Play notification sound when new pending requests arrive
      // In real app, use an actual audio file
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {})
    }
  }, [stats.pending, soundEnabled])

  // Browser notifications
  React.useEffect(() => {
    if (notificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [notificationsEnabled])

  const handleSelectRequest = (request: HandoffRequest) => {
    setSelectedRequest(request)
  }

  const handleBack = () => {
    setSelectedRequest(null)
    refetchQueue()
  }

  const handleAssign = async () => {
    try {
      await assign(currentUserId)
      refetchQueue()
    } catch (error) {
      console.error('Failed to assign:', error)
    }
  }

  const handleResolve = () => {
    setShowResolveModal(true)
  }

  const confirmResolve = async () => {
    try {
      await resolve(resolutionNote, true)
      setShowResolveModal(false)
      setResolutionNote('')
      setSelectedRequest(null)
      refetchQueue()
    } catch (error) {
      console.error('Failed to resolve:', error)
    }
  }

  const handleAddNote = async (content: string, isInternal: boolean) => {
    try {
      await addNote(content, isInternal)
    } catch (error) {
      console.error('Failed to add note:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    // In real app, this would send a message to the customer via the channel
    console.log('Sending message:', content)
    // For now, add as a note
    await addNote(`[Mensagem enviada] ${content}`, false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Headphones className="h-7 w-7" />
            Atendimento Humano
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie conversas transferidas do bot
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            aria-label={
              notificationsEnabled
                ? 'Desativar notificações'
                : 'Ativar notificações'
            }
          >
            {notificationsEnabled ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-4">
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            'pb-3 px-1 text-sm font-medium transition-colors border-b-2',
            activeTab === 'queue'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Fila de Atendimento
          {stats.pending > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            'pb-3 px-1 text-sm font-medium transition-colors border-b-2',
            activeTab === 'rules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Regras
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'pb-3 px-1 text-sm font-medium transition-colors border-b-2',
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4 inline-block mr-1" />
          Configurações
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'queue' && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex"
            >
              {/* Queue Panel */}
              <div
                className={cn(
                  'flex flex-col border rounded-lg bg-card overflow-hidden transition-all',
                  selectedRequest ? 'w-1/3' : 'w-full'
                )}
              >
                {/* Filters */}
                <div className="p-4 border-b space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome, telefone..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    {(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] as HandoffStatus[]).map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setStatusFilter((prev) =>
                              prev.includes(status)
                                ? prev.filter((s) => s !== status)
                                : [...prev, status]
                            )
                          }}
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium transition-colors',
                            statusFilter.includes(status)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          {statusLabels[status]}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <HandoffQueue
                  requests={requests}
                  stats={stats}
                  isLoading={queueLoading}
                  onSelectRequest={handleSelectRequest}
                  onRefresh={refetchQueue}
                  selectedId={selectedRequest?.id}
                />
              </div>

              {/* Conversation Panel */}
              {selectedRequest && selectedRequestDetails && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 ml-4 flex flex-col border rounded-lg bg-card overflow-hidden"
                >
                  <ConversationView
                    request={selectedRequestDetails}
                    onBack={handleBack}
                    onAssign={handleAssign}
                    onResolve={handleResolve}
                    onAddNote={handleAddNote}
                    onSendMessage={handleSendMessage}
                    currentUserId={currentUserId}
                  />
                  <QuickReplies
                    replies={[]}
                    onSelect={handleSendMessage}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'rules' && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <HandoffRules
                rules={rules}
                isLoading={rulesLoading}
                onCreateRule={createRule}
                onUpdateRule={updateRule}
                onDeleteRule={deleteRule}
                onToggleRule={toggleRule}
                workspaceId={workspaceId}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <SettingsPanel workspaceId={workspaceId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resolve Modal */}
      <Modal
        open={showResolveModal}
        onOpenChange={setShowResolveModal}
        title="Resolver Atendimento"
        description="Finalize o atendimento e devolva o cliente ao bot"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              Nota de resolução (opcional)
            </label>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Ex: Cliente teve sua dúvida esclarecida sobre..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowResolveModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmResolve}>Resolver e Devolver ao Bot</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Settings Panel Component
function SettingsPanel({ workspaceId }: { workspaceId: string }) {
  const [settings, setSettings] = React.useState({
    slaMinutes: 30,
    escalationMinutes: 15,
    notifyEmail: true,
    notifyPush: true,
    notifySound: true,
    notifyEmails: [] as string[],
    enableBusinessHours: false,
    timezone: 'America/Sao_Paulo',
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    workDays: [1, 2, 3, 4, 5],
    enableAutoAssign: false,
    roundRobinEnabled: false,
    outOfHoursMessage:
      'Obrigado pelo contato! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Retornaremos assim que possível.',
    maxConcurrentPerAgent: 5,
  })

  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // In real app, call API
      await fetch(`/api/handoff/settings?workspaceId=${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="max-w-2xl space-y-8">
      {/* SLA Settings */}
      <section>
        <h3 className="text-lg font-semibold mb-4">SLA e Escalonamento</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Tempo máximo de resposta (minutos)
              </label>
              <input
                type="number"
                value={settings.slaMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, slaMinutes: parseInt(e.target.value) || 30 })
                }
                min={1}
                max={1440}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Escalonar após (minutos)
              </label>
              <input
                type="number"
                value={settings.escalationMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    escalationMinutes: parseInt(e.target.value) || 15,
                  })
                }
                min={1}
                max={1440}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Notificações</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyEmail}
              onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Notificar por e-mail</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyPush}
              onChange={(e) => setSettings({ ...settings, notifyPush: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Notificações push</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifySound}
              onChange={(e) => setSettings({ ...settings, notifySound: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Som de notificação</span>
          </label>
        </div>
      </section>

      {/* Business Hours */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Horário Comercial</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableBusinessHours}
              onChange={(e) =>
                setSettings({ ...settings, enableBusinessHours: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">Habilitar horário comercial</span>
          </label>

          {settings.enableBusinessHours && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Início</label>
                  <input
                    type="time"
                    value={settings.businessHoursStart}
                    onChange={(e) =>
                      setSettings({ ...settings, businessHoursStart: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Fim</label>
                  <input
                    type="time"
                    value={settings.businessHoursEnd}
                    onChange={(e) =>
                      setSettings({ ...settings, businessHoursEnd: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Dias de trabalho</label>
                <div className="flex gap-2">
                  {weekDays.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSettings((prev) => ({
                          ...prev,
                          workDays: prev.workDays.includes(index)
                            ? prev.workDays.filter((d) => d !== index)
                            : [...prev.workDays, index].sort(),
                        }))
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        settings.workDays.includes(index)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Mensagem fora do horário
                </label>
                <textarea
                  value={settings.outOfHoursMessage || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, outOfHoursMessage: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Auto Assignment */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Atribuição Automática</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableAutoAssign}
              onChange={(e) =>
                setSettings({ ...settings, enableAutoAssign: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium">
              Atribuir automaticamente a atendentes disponíveis
            </span>
          </label>

          {settings.enableAutoAssign && (
            <>
              <label className="flex items-center gap-3 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={settings.roundRobinEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, roundRobinEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">Usar distribuição round-robin</span>
              </label>

              <div className="ml-6">
                <label className="text-sm font-medium block mb-1.5">
                  Máximo de atendimentos simultâneos por agente
                </label>
                <input
                  type="number"
                  value={settings.maxConcurrentPerAgent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxConcurrentPerAgent: parseInt(e.target.value) || 5,
                    })
                  }
                  min={1}
                  max={50}
                  className="w-32 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  )
}
