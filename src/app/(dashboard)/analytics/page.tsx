'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ThumbsUp,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatNumber, formatCurrency } from '@/lib/utils'

interface OverviewMetrics {
  period: { start: string; end: string }
  messages: {
    total: number
    incoming: number
    outgoing: number
    growth: number
  }
  conversations: {
    started: number
    ended: number
    ongoing: number
  }
  channels: {
    total: number
    active: number
    byType: Record<string, number>
  }
  performance: {
    avgResponseTimeMs: number | null
    p50ResponseTimeMs: number | null
    p95ResponseTimeMs: number | null
    p99ResponseTimeMs: number | null
    resolutionRate: number
    errorRate: number
  }
  costs: {
    total: number
    tokensIn: number
    tokensOut: number
    currency: string
    perMessage: number | null
  }
  satisfaction: {
    positive: number
    negative: number
    score: number | null
  }
  uniqueUsers: number
}

interface TrendData {
  date: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  uniqueUsers: number
}

interface ChannelBreakdown {
  channelId: string
  channelName: string
  channelType: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  percentage: number
}

interface PeakHourData {
  hour: number
  messages: number
  label: string
}

interface TrendsData {
  activity: TrendData[]
  peakHours: PeakHourData[]
  channelBreakdown: ChannelBreakdown[] | null
  insights: {
    avgDaily: { messages: number; cost: number }
    busiestDay: { date: string; messages: number } | null
    quietestDay: { date: string; messages: number } | null
    peakHour: { hour: number; label: string; messages: number } | null
    totalMessages: number
    totalCost: number
  }
}

type Period = '7d' | '30d' | '90d'

const CHANNEL_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#06b6d4']

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [overview, setOverview] = useState<OverviewMetrics | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      const [overviewRes, trendsRes] = await Promise.all([
        fetch(`/api/analytics/overview?start=${start.toISOString()}&end=${now.toISOString()}`),
        fetch(`/api/analytics/trends?start=${start.toISOString()}&end=${now.toISOString()}`),
      ])

      if (!overviewRes.ok || !trendsRes.ok) {
        throw new Error('Falha ao carregar dados')
      }

      const overviewData = await overviewRes.json()
      const trendsData = await trendsRes.json()

      if (overviewData.success) {
        setOverview(overviewData.data)
      }
      if (trendsData.success) {
        setTrends(trendsData.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const handleExport = async (format: 'csv' | 'json') => {
    const now = new Date()
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const url = `/api/analytics/export?start=${start.toISOString()}&end=${now.toISOString()}&format=${format}`
    window.open(url, '_blank')
  }

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Métricas e insights do seu ambiente BaaS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Messages */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Mensagens
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overview.messages.total)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {overview.messages.growth >= 0 ? (
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={overview.messages.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {overview.messages.growth > 0 ? '+' : ''}
                  {overview.messages.growth}%
                </span>
                <span className="ml-1">vs. período anterior</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>↓ {formatNumber(overview.messages.incoming)} entrada</span>
                <span>↑ {formatNumber(overview.messages.outgoing)} saída</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Únicos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overview.uniqueUsers)}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {overview.channels.active}/{overview.channels.total} canais ativos
                </Badge>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>{formatNumber(overview.conversations.started)} conversas iniciadas</span>
              </div>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo de Resposta
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatResponseTime(overview.performance.avgResponseTimeMs)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant={overview.performance.resolutionRate >= 90 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {overview.performance.resolutionRate}% resolvidos
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>p50: {formatResponseTime(overview.performance.p50ResponseTimeMs)}</span>
                <span>p95: {formatResponseTime(overview.performance.p95ResponseTimeMs)}</span>
                <span>p99: {formatResponseTime(overview.performance.p99ResponseTimeMs)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Cost */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(overview.costs.total, 'USD', 'en-US')}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {overview.costs.perMessage && (
                  <Badge variant="outline" className="text-xs">
                    ${overview.costs.perMessage.toFixed(4)}/msg
                  </Badge>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(overview.costs.tokensIn + overview.costs.tokensOut)} tokens usados
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">
            <Activity className="mr-2 h-4 w-4" />
            Atividade
          </TabsTrigger>
          <TabsTrigger value="channels">
            <PieChart className="mr-2 h-4 w-4" />
            Canais
          </TabsTrigger>
          <TabsTrigger value="hours">
            <BarChart3 className="mr-2 h-4 w-4" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="satisfaction">
            <ThumbsUp className="mr-2 h-4 w-4" />
            Satisfação
          </TabsTrigger>
        </TabsList>

        {/* Activity Chart */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atividade ao Longo do Tempo</CardTitle>
              <CardDescription>Mensagens enviadas e recebidas por dia</CardDescription>
            </CardHeader>
            <CardContent>
              {trends?.activity && trends.activity.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trends.activity}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                      />
                      <Area
                        type="monotone"
                        dataKey="messagesIn"
                        name="Entrada"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorIn)"
                      />
                      <Area
                        type="monotone"
                        dataKey="messagesOut"
                        name="Saída"
                        stroke="#22c55e"
                        fillOpacity={1}
                        fill="url(#colorOut)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  Sem dados para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights */}
          {trends?.insights && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Média Diária</div>
                  <div className="text-2xl font-bold">
                    {formatNumber(trends.insights.avgDaily.messages)} msgs
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${trends.insights.avgDaily.cost.toFixed(2)}/dia
                  </div>
                </CardContent>
              </Card>
              {trends.insights.busiestDay && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Dia Mais Movimentado</div>
                    <div className="text-2xl font-bold">
                      {new Date(trends.insights.busiestDay.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(trends.insights.busiestDay.messages)} mensagens
                    </div>
                  </CardContent>
                </Card>
              )}
              {trends.insights.peakHour && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Horário de Pico</div>
                    <div className="text-2xl font-bold">{trends.insights.peakHour.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(trends.insights.peakHour.messages)} mensagens
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Custo Total</div>
                  <div className="text-2xl font-bold">
                    ${trends.insights.totalCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(trends.insights.totalMessages)} mensagens
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Channels Chart */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Canal</CardTitle>
                <CardDescription>Proporção de mensagens por canal</CardDescription>
              </CardHeader>
              <CardContent>
                {trends?.channelBreakdown && trends.channelBreakdown.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={trends.channelBreakdown.map((c) => ({
                            name: c.channelName,
                            value: c.messagesIn + c.messagesOut,
                            type: c.channelType,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {trends.channelBreakdown.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-80 text-muted-foreground">
                    Sem dados para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes por Canal</CardTitle>
                <CardDescription>Métricas individuais de cada canal</CardDescription>
              </CardHeader>
              <CardContent>
                {trends?.channelBreakdown && trends.channelBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {trends.channelBreakdown.map((channel, index) => (
                      <div
                        key={channel.channelId}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
                            }}
                          />
                          <div>
                            <div className="font-medium">{channel.channelName}</div>
                            <div className="text-sm text-muted-foreground">
                              {channel.channelType}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {formatNumber(channel.messagesIn + channel.messagesOut)} msgs
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ${channel.cost.toFixed(2)} •{' '}
                            {channel.avgResponseTimeMs
                              ? formatResponseTime(channel.avgResponseTimeMs)
                              : '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-80 text-muted-foreground">
                    Nenhum canal configurado
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Peak Hours Chart */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Horário</CardTitle>
              <CardDescription>
                Mensagens por hora do dia (UTC) - identifique horários de pico
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trends?.peakHours && trends.peakHours.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.peakHours}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="messages" name="Mensagens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  Sem dados para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Satisfaction */}
        <TabsContent value="satisfaction">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Satisfação do Usuário</CardTitle>
                <CardDescription>Feedback coletado dos usuários</CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.satisfaction && (overview.satisfaction.positive > 0 || overview.satisfaction.negative > 0) ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl font-bold">
                          {overview.satisfaction.score ?? '-'}
                          {overview.satisfaction.score !== null && <span className="text-2xl">%</span>}
                        </div>
                        <div className="text-muted-foreground mt-2">Score de Satisfação</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <div className="text-3xl font-bold text-green-600">
                          {formatNumber(overview.satisfaction.positive)}
                        </div>
                        <div className="text-sm text-green-600">Positivos</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <div className="text-3xl font-bold text-red-600">
                          {formatNumber(overview.satisfaction.negative)}
                        </div>
                        <div className="text-sm text-red-600">Negativos</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                    <ThumbsUp className="h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhum feedback coletado ainda</p>
                    <p className="text-sm mt-2">Configure coleta de feedback nos seus bots</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Qualidade</CardTitle>
                <CardDescription>Performance e resolução</CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.performance && (
                  <div className="space-y-6">
                    {/* Resolution Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Taxa de Resolução</span>
                        <span className="text-sm text-muted-foreground">
                          {overview.performance.resolutionRate}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${overview.performance.resolutionRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Conversas resolvidas sem transferência para humano
                      </p>
                    </div>

                    {/* Error Rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Taxa de Erro</span>
                        <span className="text-sm text-muted-foreground">
                          {overview.performance.errorRate}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            overview.performance.errorRate < 1
                              ? 'bg-green-500'
                              : overview.performance.errorRate < 5
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          )}
                          style={{ width: `${Math.min(overview.performance.errorRate * 10, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mensagens com erro de processamento
                      </p>
                    </div>

                    {/* Response Time */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <div className="text-2xl font-bold">
                          {formatResponseTime(overview.performance.avgResponseTimeMs)}
                        </div>
                        <div className="text-sm text-muted-foreground">Tempo Médio</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {formatResponseTime(overview.performance.p95ResponseTimeMs)}
                        </div>
                        <div className="text-sm text-muted-foreground">P95</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
