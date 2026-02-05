'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  DollarSign,
  Bell,
  Server,
  Bot,
  Save,
  Loader2,
  AlertTriangle,
  Check,
  Info,
  Zap,
  CreditCard,
  Pause,
  Play,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Provider {
  id: string
  name: string
  type: string
  model: string
  priority: number
  status: string
  costPerInputToken: number
  costPerOutputToken: number
  isFree: boolean
  isPaid: boolean
}

interface Agent {
  id: string
  name: string
  role: string | null
  description: string | null
  avatar: string | null
  dailyLimit: number | null
  active: boolean
  preferredModel: string | null
}

interface LLMSettings {
  monthlyBudget: number | null
  dailyLimit: number | null
  llmSuspended: boolean
  alertThresholds: number[]
  allowedProviders: string[]
  providers: Provider[]
  agents: Agent[]
  usage: {
    monthly: number
    daily: number
    monthlyPercentUsed: number
    dailyPercentUsed: number
  }
}

export default function LLMSettingsPage() {
  const [settings, setSettings] = useState<LLMSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [monthlyBudget, setMonthlyBudget] = useState<string>('')
  const [dailyLimit, setDailyLimit] = useState<string>('')
  const [suspendOnExceed, setSuspendOnExceed] = useState(false)
  const [alertThresholds, setAlertThresholds] = useState<number[]>([20, 10, 5, 1])
  const [allowedProviders, setAllowedProviders] = useState<string[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  // Track dirty state
  const [isDirty, setIsDirty] = useState(false)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/llm/settings')
      const data = await res.json()

      if (data.success) {
        setSettings(data.data)
        // Initialize form states
        setMonthlyBudget(data.data.monthlyBudget?.toString() || '')
        setDailyLimit(data.data.dailyLimit?.toString() || '')
        setSuspendOnExceed(data.data.llmSuspended)
        // Convert from decimal (0.2) to percent (20)
        setAlertThresholds(
          (data.data.alertThresholds || [0.2, 0.1, 0.05, 0.01]).map((t: number) =>
            Math.round(t * 100)
          )
        )
        setAllowedProviders(data.data.allowedProviders || [])
        setAgents(data.data.agents || [])
        setIsDirty(false)
      } else {
        setError(data.error || 'Erro ao carregar configurações')
      }
    } catch (err) {
      console.error('Error fetching LLM settings:', err)
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Save settings
  const saveSettings = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/llm/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : null,
          dailyLimit: dailyLimit ? parseFloat(dailyLimit) : null,
          llmSuspended: suspendOnExceed,
          // Convert from percent (20) to decimal (0.2)
          alertThresholds: alertThresholds.map((t) => t / 100).sort((a, b) => b - a),
          allowedProviders,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Configurações salvas com sucesso!')
        setIsDirty(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Erro ao salvar')
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  // Update agent
  const updateAgent = async (agentId: string, updates: Partial<Agent>) => {
    try {
      const res = await fetch('/api/llm/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, ...updates }),
      })

      const data = await res.json()

      if (data.success) {
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, ...updates } : a))
        )
        setSuccess(`Agente atualizado!`)
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError(data.error || 'Erro ao atualizar agente')
      }
    } catch (err) {
      console.error('Error updating agent:', err)
      setError('Erro ao atualizar agente')
    }
  }

  // Toggle provider
  const toggleProvider = (providerId: string) => {
    setIsDirty(true)
    setAllowedProviders((prev) => {
      if (prev.includes(providerId)) {
        return prev.filter((id) => id !== providerId)
      }
      return [...prev, providerId]
    })
  }

  // Update threshold
  const updateThreshold = (index: number, value: string) => {
    setIsDirty(true)
    const numValue = parseInt(value) || 0
    setAlertThresholds((prev) => {
      const newThresholds = [...prev]
      newThresholds[index] = Math.min(100, Math.max(0, numValue))
      return newThresholds
    })
  }

  // Add/remove threshold
  const addThreshold = () => {
    setIsDirty(true)
    setAlertThresholds((prev) => [...prev, 15].sort((a, b) => b - a))
  }

  const removeThreshold = (index: number) => {
    setIsDirty(true)
    setAlertThresholds((prev) => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Configurações LLM" subtitle="Gerencie limites, alertas e providers" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Configurações LLM" subtitle="Gerencie limites, alertas e providers" />

      <div className="flex-1 overflow-auto p-6">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {(success || error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <Alert
                className={cn(
                  success
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-red-500 bg-red-50 dark:bg-red-950'
                )}
              >
                {success ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={success ? 'text-green-700' : 'text-red-700'}>
                  {success || error}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Usage Summary */}
        {settings && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uso Mensal</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${settings.usage.monthly.toFixed(2)}
                </div>
                {settings.monthlyBudget && (
                  <>
                    <Progress
                      value={Math.min(settings.usage.monthlyPercentUsed, 100)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.usage.monthlyPercentUsed.toFixed(1)}% de $
                      {settings.monthlyBudget}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uso Diário</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${settings.usage.daily.toFixed(2)}
                </div>
                {settings.dailyLimit && (
                  <>
                    <Progress
                      value={Math.min(settings.usage.dailyPercentUsed, 100)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.usage.dailyPercentUsed.toFixed(1)}% de $
                      {settings.dailyLimit}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Providers Ativos</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {settings.providers.filter((p) => p.status === 'ACTIVE').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {settings.providers.length} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {settings.llmSuspended ? (
                    <>
                      <Badge variant="destructive">Suspenso</Badge>
                      <Pause className="h-4 w-4 text-red-500" />
                    </>
                  ) : (
                    <>
                      <Badge variant="default" className="bg-green-600">
                        Ativo
                      </Badge>
                      <Play className="h-4 w-4 text-green-500" />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-6">
          {/* Section: Limites de Consumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Limites de Consumo
              </CardTitle>
              <CardDescription>
                Configure os limites de gastos com LLM para seu tenant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthlyBudget">Budget Mensal (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="monthlyBudget"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 100.00"
                      value={monthlyBudget}
                      onChange={(e) => {
                        setMonthlyBudget(e.target.value)
                        setIsDirty(true)
                      }}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para sem limite
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Limite Diário (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dailyLimit"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 10.00"
                      value={dailyLimit}
                      onChange={(e) => {
                        setDailyLimit(e.target.value)
                        setIsDirty(true)
                      }}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para sem limite
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Suspender ao exceder budget</Label>
                  <p className="text-sm text-muted-foreground">
                    Pausar automaticamente as requisições LLM quando o budget for excedido
                  </p>
                </div>
                <Switch
                  checked={suspendOnExceed}
                  onCheckedChange={(checked) => {
                    setSuspendOnExceed(checked)
                    setIsDirty(true)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section: Thresholds de Alerta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Thresholds de Alerta
              </CardTitle>
              <CardDescription>
                Configure em quais percentuais do budget restante você deseja ser alertado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {alertThresholds
                  .sort((a, b) => b - a)
                  .map((threshold, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={threshold}
                          onChange={(e) => updateThreshold(index, e.target.value)}
                          className="w-20 pr-6"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          %
                        </span>
                      </div>
                      {alertThresholds.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeThreshold(index)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                <Button variant="outline" size="sm" onClick={addThreshold}>
                  + Adicionar
                </Button>
              </div>

              {/* Preview Visual */}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-3">Preview dos alertas:</p>
                <div className="relative h-8 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg overflow-hidden">
                  {alertThresholds
                    .sort((a, b) => b - a)
                    .map((threshold, index) => (
                      <div
                        key={index}
                        className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                        style={{ left: `${100 - threshold}%` }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap">
                          {threshold}%
                        </span>
                      </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>0% (esgotado)</span>
                  <span>100% (cheio)</span>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Você receberá um alerta quando o budget restante atingir cada um desses valores.
                  Ex: com 20% configurado, você será alertado quando restar 20% do budget.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Section: Providers Permitidos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Providers Permitidos
              </CardTitle>
              <CardDescription>
                Selecione quais providers de LLM seu tenant pode utilizar. Se nenhum for
                selecionado, todos estarão disponíveis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {settings?.providers.map((provider) => {
                  const isSelected =
                    allowedProviders.length === 0 || allowedProviders.includes(provider.id)
                  const isExplicitlySelected = allowedProviders.includes(provider.id)

                  return (
                    <button
                      type="button"
                      key={provider.id}
                      onClick={() => toggleProvider(provider.id)}
                      className={cn(
                        'p-4 rounded-lg border-2 cursor-pointer transition-all text-left w-full',
                        isExplicitlySelected
                          ? 'border-primary bg-primary/5'
                          : allowedProviders.length === 0
                          ? 'border-border bg-muted/50'
                          : 'border-border opacity-50'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{provider.name}</h4>
                            {provider.isFree ? (
                              <Badge variant="secondary" className="text-xs">
                                Incluído
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Pago
                              </Badge>
                            )}
                            <Badge
                              variant={
                                provider.status === 'ACTIVE' ? 'default' : 'destructive'
                              }
                              className="text-xs"
                            >
                              {provider.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {provider.model}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Prioridade: {provider.priority} | $
                            {(provider.costPerInputToken * 1000000).toFixed(2)}/1M input
                          </p>
                        </div>
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                            isExplicitlySelected
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          )}
                        >
                          {isExplicitlySelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {allowedProviders.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum provider selecionado = todos permitidos. O sistema usará o fallback
                    automático baseado em prioridade e disponibilidade.
                  </AlertDescription>
                </Alert>
              )}

              {allowedProviders.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Ordem de fallback:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {settings?.providers
                      .filter((p) => allowedProviders.includes(p.id))
                      .sort((a, b) => a.priority - b.priority)
                      .map((provider, index, arr) => (
                        <div key={provider.id} className="flex items-center gap-2">
                          <Badge variant="outline">{provider.name}</Badge>
                          {index < arr.length - 1 && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Agentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Agentes
              </CardTitle>
              <CardDescription>
                Configure limites individuais e status de cada agente do seu tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum agente configurado</p>
                  <p className="text-sm">
                    Agentes são criados automaticamente quando usam o LLM Gateway
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={cn(
                        'p-4 rounded-lg border transition-opacity',
                        !agent.active && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{agent.avatar || '🤖'}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{agent.name}</h4>
                              {agent.role && (
                                <Badge variant="outline" className="text-xs">
                                  {agent.role}
                                </Badge>
                              )}
                            </div>
                            {agent.description && (
                              <p className="text-sm text-muted-foreground">
                                {agent.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Daily Limit Input */}
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">
                              Limite diário:
                            </Label>
                            <div className="relative w-24">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="∞"
                                value={agent.dailyLimit ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                    ? parseFloat(e.target.value)
                                    : null
                                  updateAgent(agent.id, { dailyLimit: value })
                                }}
                                className="pl-6 h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Active Toggle */}
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Ativo</Label>
                            <Switch
                              checked={agent.active}
                              onCheckedChange={(checked) =>
                                updateAgent(agent.id, { active: checked })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4 sticky bottom-6">
            <Button
              onClick={saveSettings}
              disabled={saving || !isDirty}
              className="shadow-lg"
              size="lg"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
