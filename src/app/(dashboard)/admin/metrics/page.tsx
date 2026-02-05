'use client'

import { useState } from 'react'
import {
  Activity,
  Clock,
  AlertTriangle,
  Bot,
  CheckCircle,
  XCircle,
  Pause,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Mock data - últimos 7 dias
const mockChartData = [
  { date: '24/01', uptime: 99.9, responseTime: 245, errorRate: 0.12 },
  { date: '25/01', uptime: 99.8, responseTime: 312, errorRate: 0.23 },
  { date: '26/01', uptime: 100, responseTime: 198, errorRate: 0.08 },
  { date: '27/01', uptime: 99.7, responseTime: 287, errorRate: 0.31 },
  { date: '28/01', uptime: 99.9, responseTime: 256, errorRate: 0.15 },
  { date: '29/01', uptime: 100, responseTime: 221, errorRate: 0.09 },
  { date: '30/01', uptime: 99.95, responseTime: 234, errorRate: 0.11 },
]

const mockBots = [
  {
    id: '1',
    name: 'Atendimento Principal',
    status: 'online',
    uptime: 99.9,
    responseTime: 234,
    messagesLast24h: 1520,
    errorRate: 0.11,
  },
  {
    id: '2',
    name: 'Suporte Técnico',
    status: 'online',
    uptime: 99.7,
    responseTime: 312,
    messagesLast24h: 892,
    errorRate: 0.24,
  },
  {
    id: '3',
    name: 'Vendas',
    status: 'offline',
    uptime: 0,
    responseTime: 0,
    messagesLast24h: 0,
    errorRate: 0,
  },
  {
    id: '4',
    name: 'FAQ Bot',
    status: 'online',
    uptime: 100,
    responseTime: 156,
    messagesLast24h: 3241,
    errorRate: 0.05,
  },
  {
    id: '5',
    name: 'Onboarding',
    status: 'maintenance',
    uptime: 98.5,
    responseTime: 445,
    messagesLast24h: 127,
    errorRate: 0.89,
  },
]

type BotStatus = 'online' | 'offline' | 'maintenance'

const statusConfig: Record<BotStatus, { label: string; variant: 'success' | 'destructive' | 'warning'; icon: typeof CheckCircle }> = {
  online: { label: 'Online', variant: 'success', icon: CheckCircle },
  offline: { label: 'Offline', variant: 'destructive', icon: XCircle },
  maintenance: { label: 'Manutenção', variant: 'warning', icon: Pause },
}

export default function MetricsPage() {
  const [refreshing, setRefreshing] = useState(false)

  // Calcular métricas agregadas
  const avgUptime = mockChartData.reduce((acc, d) => acc + d.uptime, 0) / mockChartData.length
  const avgResponseTime = mockChartData.reduce((acc, d) => acc + d.responseTime, 0) / mockChartData.length
  const avgErrorRate = mockChartData.reduce((acc, d) => acc + d.errorRate, 0) / mockChartData.length

  // Calcular trends (comparando com dia anterior)
  const uptimeTrend = mockChartData[6].uptime - mockChartData[5].uptime
  const responseTimeTrend = ((mockChartData[6].responseTime - mockChartData[5].responseTime) / mockChartData[5].responseTime) * 100
  const errorRateTrend = mockChartData[6].errorRate - mockChartData[5].errorRate

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }

  const formatResponseTime = (ms: number) => {
    if (ms === 0) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Métricas do Sistema</h1>
          <p className="text-muted-foreground">
            Monitoramento de performance e disponibilidade
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Uptime Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Uptime Médio
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgUptime.toFixed(2)}%</div>
            <div className="flex items-center mt-2 text-sm">
              {uptimeTrend >= 0 ? (
                <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
              )}
              <span className={uptimeTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {uptimeTrend >= 0 ? '+' : ''}{uptimeTrend.toFixed(2)}%
              </span>
              <span className="ml-1 text-muted-foreground">vs ontem</span>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo de Resposta
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatResponseTime(Math.round(avgResponseTime))}</div>
            <div className="flex items-center mt-2 text-sm">
              {responseTimeTrend <= 0 ? (
                <TrendingDown className="mr-1 h-4 w-4 text-green-500" />
              ) : (
                <TrendingUp className="mr-1 h-4 w-4 text-red-500" />
              )}
              <span className={responseTimeTrend <= 0 ? 'text-green-600' : 'text-red-600'}>
                {responseTimeTrend > 0 ? '+' : ''}{responseTimeTrend.toFixed(1)}%
              </span>
              <span className="ml-1 text-muted-foreground">vs ontem</span>
            </div>
          </CardContent>
        </Card>

        {/* Error Rate Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Erro
            </CardTitle>
            <div className={cn(
              'p-2 rounded-lg',
              avgErrorRate < 0.2 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : avgErrorRate < 0.5 
                ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            )}>
              <AlertTriangle className={cn(
                'h-5 w-5',
                avgErrorRate < 0.2 
                  ? 'text-green-600 dark:text-green-400' 
                  : avgErrorRate < 0.5 
                  ? 'text-yellow-600 dark:text-yellow-400' 
                  : 'text-red-600 dark:text-red-400'
              )} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgErrorRate.toFixed(2)}%</div>
            <div className="flex items-center mt-2 text-sm">
              {errorRateTrend <= 0 ? (
                <TrendingDown className="mr-1 h-4 w-4 text-green-500" />
              ) : (
                <TrendingUp className="mr-1 h-4 w-4 text-red-500" />
              )}
              <span className={errorRateTrend <= 0 ? 'text-green-600' : 'text-red-600'}>
                {errorRateTrend > 0 ? '+' : ''}{errorRateTrend.toFixed(2)}%
              </span>
              <span className="ml-1 text-muted-foreground">vs ontem</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart - Últimos 7 dias */}
      <Card>
        <CardHeader>
          <CardTitle>Performance dos Últimos 7 Dias</CardTitle>
          <CardDescription>
            Uptime, tempo de resposta e taxa de erro ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mockChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  yAxisId="left"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={[99, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value}ms`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'uptime') return [`${value}%`, 'Uptime']
                    if (name === 'responseTime') return [`${value}ms`, 'Tempo de Resposta']
                    if (name === 'errorRate') return [`${value}%`, 'Taxa de Erro']
                    return [value, name]
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="uptime"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                  name="uptime"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="responseTime"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Uptime (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Tempo de Resposta (ms)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bots List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Status dos Bots
          </CardTitle>
          <CardDescription>
            Visão geral da disponibilidade e performance de cada bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockBots.map((bot) => {
              const status = statusConfig[bot.status as BotStatus]
              const StatusIcon = status.icon
              
              return (
                <div
                  key={bot.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'p-2 rounded-lg',
                      bot.status === 'online' 
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : bot.status === 'offline'
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-yellow-50 dark:bg-yellow-900/20'
                    )}>
                      <StatusIcon className={cn(
                        'h-5 w-5',
                        bot.status === 'online' 
                          ? 'text-green-600' 
                          : bot.status === 'offline'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      )} />
                    </div>
                    <div>
                      <div className="font-medium">{bot.name}</div>
                      <Badge variant={status.variant} className="mt-1">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className="text-center sm:text-right">
                      <div className="text-muted-foreground text-xs">Uptime</div>
                      <div className="font-medium">
                        {bot.status === 'offline' ? '-' : `${bot.uptime}%`}
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-muted-foreground text-xs">Resposta</div>
                      <div className="font-medium">{formatResponseTime(bot.responseTime)}</div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-muted-foreground text-xs">Msgs/24h</div>
                      <div className="font-medium">
                        {bot.messagesLast24h.toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-muted-foreground text-xs">Erro</div>
                      <div className={cn(
                        'font-medium',
                        bot.errorRate < 0.2 
                          ? 'text-green-600' 
                          : bot.errorRate < 0.5 
                          ? 'text-yellow-600' 
                          : 'text-red-600'
                      )}>
                        {bot.status === 'offline' ? '-' : `${bot.errorRate}%`}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
