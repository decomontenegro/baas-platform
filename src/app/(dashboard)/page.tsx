'use client'

import { motion } from 'framer-motion'
import { 
  MessageSquare, 
  Users, 
  Zap, 
  DollarSign,
  Plus,
  Brain,
  Settings,
  ArrowRight,
  Loader2,
  ThumbsUp,
  AlertCircle
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Header } from '@/components/layout/header'
import { StatCard } from '@/components/ui/stat-card'
import { useOverview } from '@/hooks/use-overview'
import { formatRelativeTime, cn } from '@/lib/utils'
import Link from 'next/link'

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#ec4899', '#14b8a6']

const quickActions = [
  { label: 'Add Channel', icon: Plus, href: '/channels?add=true', color: 'blue' },
  { label: 'Edit Behavior', icon: Brain, href: '/behavior', color: 'purple' },
  { label: 'Settings', icon: Settings, href: '/settings', color: 'green' },
]

export default function OverviewPage() {
  const { overview, trends, activity, isLoading, error } = useOverview()

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Overview" subtitle="Welcome back! Here's what's happening." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Overview" subtitle="Welcome back! Here's what's happening." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)]">Erro ao carregar dados</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Format data for charts
  const messagesPerDay = trends?.activity?.map((d: { date: string; messagesIn: number; messagesOut: number }) => ({
    date: d.date,
    messages: d.messagesIn + d.messagesOut,
  })) || []

  // Channel breakdown for pie chart
  const channelBreakdown = trends?.channelBreakdown?.map((c: { channelType: string; percentage: number; messagesIn: number; messagesOut: number }) => ({
    type: c.channelType.toLowerCase(),
    count: c.messagesIn + c.messagesOut,
    percentage: c.percentage,
  })) || []

  // Sparkline data from recent trend
  const generateSparklineFromTrend = () => {
    if (!trends?.activity || trends.activity.length === 0) {
      return Array(7).fill(0).map(() => Math.floor(Math.random() * 50) + 10)
    }
    const recent = trends.activity.slice(-7)
    return recent.map((d: { messagesIn: number; messagesOut: number }) => d.messagesIn + d.messagesOut)
  }

  // Calculate satisfaction score display
  const satisfactionDisplay = overview?.satisfaction?.score !== null && overview?.satisfaction?.score !== undefined
    ? `${overview.satisfaction.score}%`
    : 'N/A'

  // Format response time
  const avgResponseTimeSeconds = overview?.performance?.avgResponseTimeMs 
    ? (overview.performance.avgResponseTimeMs / 1000).toFixed(1)
    : '—'

  return (
    <div className="flex flex-col h-screen">
      <Header title="Overview" subtitle="Welcome back! Here's what's happening." />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Messages"
            value={overview?.messages?.total?.toLocaleString() || '0'}
            icon={MessageSquare}
            trend={overview?.messages?.growth}
            sparklineData={generateSparklineFromTrend()}
            color="blue"
            delay={0}
          />
          <StatCard
            title="Active Channels"
            value={`${overview?.channels?.active || 0}/${overview?.channels?.total || 0}`}
            icon={Users}
            sparklineData={generateSparklineFromTrend()}
            color="green"
            delay={0.1}
          />
          <StatCard
            title="Response Time"
            value={`${avgResponseTimeSeconds}s`}
            icon={Zap}
            sparklineData={generateSparklineFromTrend()}
            color="purple"
            delay={0.2}
          />
          <StatCard
            title="Satisfaction"
            value={satisfactionDisplay}
            icon={ThumbsUp}
            trend={overview?.satisfaction?.positive && overview?.satisfaction?.negative 
              ? Math.round((overview.satisfaction.positive / (overview.satisfaction.positive + overview.satisfaction.negative)) * 100 - 50)
              : undefined
            }
            sparklineData={generateSparklineFromTrend()}
            color="orange"
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 card p-6"
          >
            <h3 className="text-lg font-semibold mb-6">Messages Over Time</h3>
            {messagesPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={messagesPerDay.slice(-14)}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMessages)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-[var(--muted-foreground)]">
                <p>Nenhum dado disponível ainda</p>
              </div>
            )}
          </motion.div>

          {/* Channel Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card p-6"
          >
            <h3 className="text-lg font-semibold mb-6">Channel Breakdown</h3>
            {channelBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={channelBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {channelBreakdown.map((_: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {channelBreakdown.map((item: { type: string; percentage: number }, index: number) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="capitalize">{item.type}</span>
                      </div>
                      <span className="text-[var(--muted-foreground)]">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[var(--muted-foreground)]">
                <p>Nenhum canal ativo</p>
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card p-6"
          >
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg transition-all',
                    'hover:bg-[var(--muted)] group'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-lg',
                    action.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                    action.color === 'purple' && 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
                    action.color === 'green' && 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                  )}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium flex-1">{action.label}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>

            {/* Cost Summary */}
            {overview?.costs && (
              <div className="mt-6 pt-4 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Period Cost</span>
                </div>
                <p className="text-2xl font-bold">${overview.costs.total.toFixed(2)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {overview.costs.tokensIn.toLocaleString()} tokens in / {overview.costs.tokensOut.toLocaleString()} tokens out
                </p>
              </div>
            )}
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="lg:col-span-2 card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <Link 
                href="/activity" 
                className="text-sm text-primary-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {activity && activity.length > 0 ? (
                activity.slice(0, 6).map((activityItem: { id: string; type: string; description: string; channelName?: string; createdAt: string }, index: number) => (
                  <motion.div
                    key={activityItem.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-[var(--muted)] transition-colors"
                  >
                    <div className={cn(
                      'p-2 rounded-full flex-shrink-0',
                      activityItem.type === 'message' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                      activityItem.type === 'channel_created' && 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                      activityItem.type === 'channel_updated' && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
                      activityItem.type === 'error' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                    )}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activityItem.description}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {activityItem.channelName || 'Sistema'} • {formatRelativeTime(activityItem.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
                  <p>Nenhuma atividade recente</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
