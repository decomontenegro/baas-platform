"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Bell,
  Bot,
  Zap,
  Clock,
  Play,
  Pause,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

// Calcula tempo relativo (ex: "5 minutos atrás")
function getRelativeTime(dateString: string | null): string {
  if (!dateString) return "Nunca"
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffSec < 60) return "Agora mesmo"
  if (diffMin < 60) return `${diffMin} minuto${diffMin > 1 ? 's' : ''} atrás`
  if (diffHour < 24) return `${diffHour} hora${diffHour > 1 ? 's' : ''} atrás`
  return `${diffDay} dia${diffDay > 1 ? 's' : ''} atrás`
}

interface HealthSummary {
  totalBots: number
  healthyBots: number
  degradedBots: number
  unhealthyBots: number
  recentAlerts: number
  lastCheck: string | null
}

interface AdminAgent {
  id: string
  name: string
  status: string
  healthCheckEnabled: boolean
  healthCheckIntervalMs: number
  autoRestartEnabled: boolean
  autoRollbackEnabled: boolean
  alertEmail: string | null
  alertWhatsApp: string | null
  alertWebhook: string | null
}

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  message: string
  status: string
  createdAt: string
  bot?: { id: string; name: string; avatar: string }
}

export default function AdminAgentPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [adminAgent, setAdminAgent] = useState<AdminAgent | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [cronActive, setCronActive] = useState(false)
  const [relativeTime, setRelativeTime] = useState<string>("Nunca")
  const [config, setConfig] = useState({
    alertEmail: "",
    alertWhatsApp: "",
    healthCheckEnabled: true,
    autoRestartEnabled: true,
  })

  // Atualiza o tempo relativo a cada 30 segundos
  useEffect(() => {
    const updateRelativeTime = () => {
      setRelativeTime(getRelativeTime(health?.lastCheck || null))
    }
    updateRelativeTime()
    const interval = setInterval(updateRelativeTime, 30000)
    return () => clearInterval(interval)
  }, [health?.lastCheck])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [healthRes, setupRes, alertsRes] = await Promise.all([
        fetch("/api/admin/health"),
        fetch("/api/admin/setup"),
        fetch("/api/admin/alerts?limit=10"),
      ])

      if (healthRes.ok) setHealth(await healthRes.json())
      if (setupRes.ok) {
        const data = await setupRes.json()
        setAdminAgent(data.adminAgent)
        if (data.adminAgent) {
          setConfig({
            alertEmail: data.adminAgent.alertEmail || "",
            alertWhatsApp: data.adminAgent.alertWhatsApp || "",
            healthCheckEnabled: data.adminAgent.healthCheckEnabled,
            autoRestartEnabled: data.adminAgent.autoRestartEnabled,
          })
          setCronActive(data.adminAgent.healthCheckEnabled)
        }
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setAlerts(data.alerts || [])
      }
    } catch (e) {
      console.error("Error fetching data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const runHealthCheck = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/admin/health", { method: "POST" })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setChecking(false)
    }
  }

  const setupAdminAgent = async () => {
    setConfiguring(true)
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setConfiguring(false)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    await fetch("/api/admin/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action: "acknowledge" }),
    })
    await fetchData()
  }

  const resolveAlert = async (alertId: string) => {
    await fetch("/api/admin/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action: "resolve" }),
    })
    await fetchData()
  }

  const severityColors: Record<string, string> = {
    INFO: "bg-blue-500",
    WARNING: "bg-yellow-500",
    ERROR: "bg-orange-500",
    CRITICAL: "bg-red-500",
  }

  const statusIcons: Record<string, React.ReactNode> = {
    HEALTHY: <CheckCircle className="h-5 w-5 text-green-500" />,
    DEGRADED: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    UNHEALTHY: <XCircle className="h-5 w-5 text-orange-500" />,
    DEAD: <XCircle className="h-5 w-5 text-red-500" />,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Toggle cron ativo/inativo
  const toggleCron = async () => {
    const newState = !cronActive
    setCronActive(newState)
    setConfig(prev => ({ ...prev, healthCheckEnabled: newState }))
    
    try {
      await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, healthCheckEnabled: newState }),
      })
    } catch (e) {
      // Reverte em caso de erro
      setCronActive(!newState)
      setConfig(prev => ({ ...prev, healthCheckEnabled: !newState }))
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Agent
            </h1>
            {/* Badge pulsante de status */}
            {cronActive ? (
              <Badge 
                variant="success" 
                className="animate-pulse flex items-center gap-1"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Monitorando
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Pause className="h-3 w-3" />
                Pausado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground">
              Supervisão e monitoramento de todos os seus bots
            </p>
            {/* Indicador de última verificação */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Última verificação: <strong>{relativeTime}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Botão toggle cron */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={cronActive ? "default" : "outline"} 
                  size="icon"
                  onClick={toggleCron}
                  className={cronActive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {cronActive ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {cronActive ? "Pausar monitoramento automático" : "Ativar monitoramento automático"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={runHealthCheck} disabled={checking}>
            <Activity className={`h-4 w-4 mr-2 ${checking ? "animate-pulse" : ""}`} />
            {checking ? "Verificando..." : "Health Check"}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Bots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{health?.totalBots || 0}</div>
            <p className="text-xs text-muted-foreground">Supervisionados</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Saudáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {health?.healthyBots || 0}
            </div>
            <p className="text-xs text-muted-foreground">Funcionando normalmente</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Degradados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {health?.degradedBots || 0}
            </div>
            <p className="text-xs text-muted-foreground">Com lentidão</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Com Problema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {health?.unhealthyBots || 0}
            </div>
            <p className="text-xs text-muted-foreground">Precisam atenção</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração
            </CardTitle>
            <CardDescription>
              Configure o comportamento do Admin Agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Health Check Automático</Label>
                <p className="text-xs text-muted-foreground">
                  Verifica bots a cada 5 minutos
                </p>
              </div>
              <Switch
                checked={config.healthCheckEnabled}
                onCheckedChange={(v) => setConfig({ ...config, healthCheckEnabled: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Restart</Label>
                <p className="text-xs text-muted-foreground">
                  Reinicia bots com problema automaticamente
                </p>
              </div>
              <Switch
                checked={config.autoRestartEnabled}
                onCheckedChange={(v) => setConfig({ ...config, autoRestartEnabled: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Email para Alertas</Label>
              <Input
                type="email"
                placeholder="admin@empresa.com"
                value={config.alertEmail}
                onChange={(e) => setConfig({ ...config, alertEmail: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp para Alertas</Label>
              <Input
                type="tel"
                placeholder="+5511999999999"
                value={config.alertWhatsApp}
                onChange={(e) => setConfig({ ...config, alertWhatsApp: e.target.value })}
              />
            </div>

            <Button onClick={setupAdminAgent} disabled={configuring} className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              {adminAgent ? "Atualizar Configuração" : "Ativar Admin Agent"}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas Recentes
              {health?.recentAlerts ? (
                <Badge variant="destructive">{health.recentAlerts}</Badge>
              ) : null}
            </CardTitle>
            <CardDescription>Últimas notificações do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum alerta ativo</p>
                <p className="text-xs">Tudo funcionando normalmente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        severityColors[alert.severity] || "bg-gray-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{alert.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.message}
                      </p>
                      {alert.bot && (
                        <div className="flex items-center gap-1 mt-1">
                          <Bot className="h-3 w-3" />
                          <span className="text-xs">{alert.bot.name}</span>
                        </div>
                      )}
                    </div>
                    {alert.status === "OPEN" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          👀
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resolveAlert(alert.id)}
                        >
                          ✅
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Bar no rodapé */}
      <div className="flex items-center justify-center gap-6 py-3 px-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${cronActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span>Cron: {cronActive ? 'Ativo' : 'Inativo'}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          <span>Verificação: {relativeTime}</span>
        </div>
        {health?.lastCheck && (
          <>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs">
              {new Date(health.lastCheck).toLocaleString("pt-BR")}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
