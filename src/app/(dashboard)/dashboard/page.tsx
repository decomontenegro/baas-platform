"use client"

import { useEffect, useState } from "react"
import {
  Bot,
  MessageSquare,
  TrendingUp,
  Users,
  ArrowUpRight,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CostWidget } from "@/components/dashboard/cost-widget"

interface ClawdbotStats {
  channels: number
  groups: number
  conversations: number
  resolutionRate: number | null
  channelsList: { type: string; groups: number }[]
  message?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ClawdbotStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clawdbot/stats')
      if (!res.ok) throw new Error('Falha ao buscar dados')
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (e) {
      setError('Não foi possível conectar ao Clawdbot')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Parse stats from API response (stats.data.*)
  const channelsData = stats?.data?.channels
  const conversationsData = stats?.data?.conversations
  const providersData = stats?.data?.providers
  
  const statCards = [
    {
      title: "Canais Conectados",
      value: channelsData?.total ?? 0,
      icon: channelsData?.total ? Wifi : WifiOff,
      description: channelsData?.list?.join(', ') || "Nenhum canal configurado",
      highlight: channelsData?.total ? true : false,
    },
    {
      title: "Grupos Ativos",
      value: conversationsData?.total ?? 0,
      icon: Users,
      description: conversationsData?.total ? `Em ${channelsData?.total} canal(is)` : "Configure canais primeiro",
    },
    {
      title: "Providers LLM",
      value: providersData?.total ?? 0,
      icon: MessageSquare,
      description: providersData?.total ? `${providersData.active} ativos` : "Nenhum provider",
    },
    {
      title: "Status",
      value: stats?.data?.health?.status === 'healthy' ? '✅' : '⚠️',
      icon: TrendingUp,
      description: stats?.data?.health?.status === 'healthy' ? 'Sistema saudável' : 'Verificar status',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu ambiente BaaS
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button>
            <Bot className="mr-2 h-4 w-4" />
            Criar Novo Bot
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Cost Widget + Stats Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cost Widget - 1 column */}
        <div className="lg:col-span-1">
          <CostWidget />
        </div>
        
        {/* Stats - 2 columns */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className={stat.highlight ? 'border-green-500 dark:border-green-600' : ''}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.highlight ? 'text-green-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                  ) : (
                    stat.value
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
        </div>
      </div>

      {/* Channels Detail */}
      {channelsData?.list && channelsData.list.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Canais Configurados</CardTitle>
            <CardDescription>
              Canais de comunicação conectados ao Clawdbot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channelsData.list.map((channelType: string) => (
                <div
                  key={channelType}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Wifi className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{channelType}</div>
                      <p className="text-sm text-muted-foreground">
                        {conversationsData?.total || 0} grupo(s) configurado(s)
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    Conectado
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && stats?.channels === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum canal conectado</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Configure o Clawdbot com WhatsApp, Telegram ou outros canais para começar a ver dados reais aqui.
            </p>
            <Button variant="outline">
              Ver documentação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
