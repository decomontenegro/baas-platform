'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield,
  Search,
  Filter,
  Download,
  Clock,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Eye,
  Activity,
  Database,
  Calendar,
  Globe,
  Monitor,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ============================================================================
// TYPES
// ============================================================================

interface AuditLog {
  id: string
  tenantId: string | null
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
}

interface RetentionStats {
  totalLogs: number
  logsLast30Days: number
  logsLast90Days: number
  oldestLog: string | null
  newestLog: string | null
  storageEstimateKb: number
}

interface AuditResponse {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  stats: RetentionStats
  recentAlerts: AuditLog[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_CATEGORIES = {
  auth: {
    label: 'Authentication',
    icon: Shield,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  user: {
    label: 'Users',
    icon: User,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  team: {
    label: 'Team',
    icon: User,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  bot: {
    label: 'Bots',
    icon: Zap,
    color: 'text-pink-500',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
  channel: {
    label: 'Channels',
    icon: Monitor,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  knowledge: {
    label: 'Knowledge',
    icon: FileText,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  settings: {
    label: 'Settings',
    icon: Activity,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
  },
  billing: {
    label: 'Billing',
    icon: Database,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  data: {
    label: 'Data/LGPD',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  gdpr: {
    label: 'GDPR',
    icon: Shield,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  security: {
    label: 'Security Alert',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'User logged in',
  'auth.logout': 'User logged out',
  'auth.failed': 'Login failed',
  'auth.password_changed': 'Password changed',
  'auth.mfa_enabled': 'MFA enabled',
  'auth.mfa_disabled': 'MFA disabled',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.deleted': 'User deleted',
  'user.restored': 'User restored',
  'team.invited': 'Team member invited',
  'team.joined': 'Team member joined',
  'team.removed': 'Team member removed',
  'team.role_changed': 'Role changed',
  'team.permissions_changed': 'Permissions changed',
  'bot.created': 'Bot created',
  'bot.updated': 'Bot updated',
  'bot.deleted': 'Bot deleted',
  'bot.activated': 'Bot activated',
  'bot.deactivated': 'Bot deactivated',
  'channel.created': 'Channel created',
  'channel.connected': 'Channel connected',
  'channel.disconnected': 'Channel disconnected',
  'channel.deleted': 'Channel deleted',
  'channel.config_changed': 'Channel config changed',
  'knowledge.created': 'Knowledge base created',
  'knowledge.uploaded': 'Document uploaded',
  'knowledge.deleted': 'Document deleted',
  'knowledge.updated': 'Knowledge base updated',
  'settings.changed': 'Settings changed',
  'settings.api_key_created': 'API key created',
  'settings.api_key_revoked': 'API key revoked',
  'settings.webhook_created': 'Webhook created',
  'settings.webhook_deleted': 'Webhook deleted',
  'billing.upgraded': 'Plan upgraded',
  'billing.downgraded': 'Plan downgraded',
  'billing.payment': 'Payment received',
  'billing.payment_failed': 'Payment failed',
  'billing.cancelled': 'Subscription cancelled',
  'data.exported': 'Data exported',
  'data.deleted': 'Data deleted',
  'data.anonymized': 'Data anonymized',
  'gdpr.request_created': 'GDPR request created',
  'gdpr.request_completed': 'GDPR request completed',
  'security.multiple_login_failures': 'Multiple login failures detected',
  'security.new_ip_detected': 'New IP address detected',
  'security.bulk_action': 'Bulk action detected',
  'security.permission_escalation': 'Permission escalation detected',
  'security.suspicious_activity': 'Suspicious activity detected',
}

const DATE_PRESETS = [
  { label: 'Last 24 hours', value: 'day' },
  { label: 'Last 7 days', value: 'week' },
  { label: 'Last 30 days', value: 'month' },
  { label: 'Last 90 days', value: 'quarter' },
  { label: 'Last year', value: 'year' },
  { label: 'All time', value: 'all' },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getActionCategory(action: string): keyof typeof ACTION_CATEGORIES {
  const prefix = action.split('.')[0]
  return (prefix in ACTION_CATEGORIES 
    ? prefix 
    : 'settings') as keyof typeof ACTION_CATEGORIES
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatRelativeTime(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

function getDateRange(preset: string): { start?: Date; end?: Date } {
  const now = new Date()
  
  switch (preset) {
    case 'day':
      return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    case 'week':
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    case 'month':
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
    case 'quarter':
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
    case 'year':
      return { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }
    default:
      return {}
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<RetentionStats | null>(null)
  const [alerts, setAlerts] = useState<AuditLog[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState('week')
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Get tenant ID from local storage
  const tenantId = typeof window !== 'undefined' 
    ? localStorage.getItem('tenantId') || 'demo-tenant'
    : 'demo-tenant'

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        tenantId,
        page: page.toString(),
        pageSize: '50',
      })

      if (search) params.set('search', search)
      if (selectedUser) params.set('userId', selectedUser)
      if (selectedActions.length > 0) {
        params.set('action', selectedActions.join(','))
      }

      const { start, end } = getDateRange(datePreset)
      if (start) params.set('startDate', start.toISOString())
      if (end) params.set('endDate', end.toISOString())

      const res = await fetch(`/api/audit?${params}`)
      
      if (res.ok) {
        const data: AuditResponse = await res.json()
        setLogs(data.logs)
        setTotalPages(data.totalPages)
        setTotal(data.total)
        setStats(data.stats)
        setAlerts(data.recentAlerts || [])
      } else {
        toast.error('Failed to load audit logs')
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, datePreset, selectedActions, selectedUser])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Export to CSV
  const handleExport = async () => {
    try {
      setExporting(true)
      
      const params = new URLSearchParams({ tenantId })
      
      const { start, end } = getDateRange(datePreset)
      if (start) params.set('startDate', start.toISOString())
      if (end) params.set('endDate', end.toISOString())
      if (selectedActions.length > 0) {
        params.set('action', selectedActions.join(','))
      }

      const res = await fetch(`/api/audit/export?${params}`)
      
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Audit logs exported successfully')
      } else {
        toast.error('Failed to export audit logs')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export audit logs')
    } finally {
      setExporting(false)
    }
  }

  // Toggle action filter
  const toggleAction = (action: string) => {
    setSelectedActions(prev => 
      prev.includes(action) 
        ? prev.filter(a => a !== action)
        : [...prev, action]
    )
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Audit Logs" 
        subtitle="Security and compliance event tracking"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Logs"
            value={stats?.totalLogs || 0}
            icon={<Database className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="Last 30 Days"
            value={stats?.logsLast30Days || 0}
            icon={<Calendar className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            title="Security Alerts"
            value={alerts.length}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
          />
          <StatCard
            title="Storage"
            value={`${((stats?.storageEstimateKb || 0) / 1024).toFixed(1)} MB`}
            icon={<Activity className="w-5 h-5" />}
            color="purple"
          />
        </div>

        {/* Security Alerts Banner */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Security Alerts ({alerts.length})
                </h3>
                <div className="mt-2 space-y-1">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="text-sm text-red-700 dark:text-red-300">
                      {ACTION_LABELS[alert.action] || alert.action} - {formatRelativeTime(alert.createdAt)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters Bar */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="Search actions, resources..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="input pl-10 w-full"
              />
            </div>

            {/* Date Preset */}
            <div className="relative w-full md:w-48">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value)
                  setPage(1)
                }}
                className="input pl-10 appearance-none pr-10 w-full"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'btn-secondary flex items-center gap-2',
                showFilters && 'bg-primary-100 dark:bg-primary-900/30'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {selectedActions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                  {selectedActions.length}
                </span>
              )}
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary flex items-center gap-2"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export CSV
            </button>
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-[var(--border)]">
                  <p className="text-sm font-medium mb-3">Filter by Action Type</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ACTION_CATEGORIES).map(([key, { label, bgColor }]) => (
                      <button
                        key={key}
                        onClick={() => toggleAction(key)}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-full transition-all',
                          selectedActions.includes(key)
                            ? 'bg-primary-600 text-white'
                            : `${bgColor} hover:opacity-80`
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  
                  {selectedActions.length > 0 && (
                    <button
                      onClick={() => setSelectedActions([])}
                      className="mt-3 text-sm text-primary-600 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logs Timeline */}
        <div className="card">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="text-sm text-[var(--muted-foreground)]">
              Showing {logs.length} of {total} logs
            </div>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-[var(--muted-foreground)]">
                Logs will appear here as actions are performed
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  onClick={() => setSelectedLog(log)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-sm text-[var(--muted-foreground)]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <LogDetailModal
            log={selectedLog}
            tenantId={tenantId}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'red' | 'purple'
}) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    red: 'from-red-500 to-orange-500',
    purple: 'from-purple-500 to-pink-500',
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg bg-gradient-to-br text-white',
          colors[color]
        )}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
          <p className="text-xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// LOG ROW COMPONENT
// ============================================================================

function LogRow({
  log,
  onClick,
}: {
  log: AuditLog
  onClick: () => void
}) {
  const category = getActionCategory(log.action)
  const categoryInfo = ACTION_CATEGORIES[category]
  const Icon = categoryInfo.icon

  const isSecurityAlert = log.action.startsWith('security.')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'p-4 flex items-start gap-4 hover:bg-[var(--muted)] transition-colors cursor-pointer',
        isSecurityAlert && 'bg-red-50/50 dark:bg-red-900/10'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn('p-2 rounded-lg flex-shrink-0', categoryInfo.bgColor)}>
        <Icon className={cn('w-4 h-4', categoryInfo.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">
              {ACTION_LABELS[log.action] || log.action}
            </p>
            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--muted-foreground)]">
              {log.user && (
                <>
                  <User className="w-3 h-3" />
                  <span>{log.user.name || log.user.email}</span>
                  <span>•</span>
                </>
              )}
              {log.resourceId && (
                <>
                  <span className="font-mono text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded">
                    {log.resource}:{log.resourceId.slice(0, 8)}
                  </span>
                  <span>•</span>
                </>
              )}
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(log.createdAt)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {log.ipAddress && (
              <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {log.ipAddress}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// LOG DETAIL MODAL
// ============================================================================

function LogDetailModal({
  log,
  tenantId,
  onClose,
}: {
  log: AuditLog
  tenantId: string
  onClose: () => void
}) {
  const [details, setDetails] = useState<{
    relatedLogs: AuditLog[]
    userActivity: {
      totalActions: number
      actionsByType: Record<string, number>
      ipAddresses: string[]
    } | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/audit/${log.id}?tenantId=${tenantId}`)
        if (res.ok) {
          const data = await res.json()
          setDetails({
            relatedLogs: data.relatedLogs || [],
            userActivity: data.userActivity || null,
          })
        }
      } catch (error) {
        console.error('Failed to fetch log details:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [log.id, tenantId])

  const category = getActionCategory(log.action)
  const categoryInfo = ACTION_CATEGORIES[category]
  const Icon = categoryInfo.icon

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--card)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', categoryInfo.bgColor)}>
              <Icon className={cn('w-5 h-5', categoryInfo.color)} />
            </div>
            <div>
              <h3 className="font-semibold">{ACTION_LABELS[log.action] || log.action}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {formatDate(log.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Action" value={log.action} />
            <InfoField label="Resource" value={`${log.resource}${log.resourceId ? `:${log.resourceId}` : ''}`} />
            <InfoField 
              label="User" 
              value={log.user ? (log.user.name || log.user.email) : 'System'} 
            />
            <InfoField label="IP Address" value={log.ipAddress || 'Unknown'} />
          </div>

          {/* User Agent */}
          {log.userAgent && (
            <div>
              <p className="text-sm font-medium mb-1">User Agent</p>
              <p className="text-sm text-[var(--muted-foreground)] bg-[var(--muted)] p-3 rounded-lg font-mono text-xs break-all">
                {log.userAgent}
              </p>
            </div>
          )}

          {/* Changes */}
          {(log.oldData || log.newData) && (
            <div>
              <p className="text-sm font-medium mb-2">Changes</p>
              <div className="grid grid-cols-2 gap-4">
                {log.oldData && (
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">Before</p>
                    <pre className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(log.oldData, null, 2)}
                    </pre>
                  </div>
                )}
                {log.newData && (
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">After</p>
                    <pre className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(log.newData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(log.metadata || {}).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Metadata</p>
              <pre className="bg-[var(--muted)] p-3 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* User Activity */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : details?.userActivity && (
            <div>
              <p className="text-sm font-medium mb-2">User Activity (Last 30 Days)</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--muted)] p-3 rounded-lg text-center">
                  <p className="text-xl font-bold">{details.userActivity.totalActions}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Total Actions</p>
                </div>
                <div className="bg-[var(--muted)] p-3 rounded-lg text-center">
                  <p className="text-xl font-bold">
                    {Object.keys(details.userActivity.actionsByType).length}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Action Types</p>
                </div>
                <div className="bg-[var(--muted)] p-3 rounded-lg text-center">
                  <p className="text-xl font-bold">{details.userActivity.ipAddresses.length}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">IP Addresses</p>
                </div>
              </div>
            </div>
          )}

          {/* Related Logs */}
          {details?.relatedLogs && details.relatedLogs.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Related Activity</p>
              <div className="space-y-2">
                {details.relatedLogs.slice(0, 5).map((relLog) => (
                  <div
                    key={relLog.id}
                    className="flex items-center gap-3 p-2 bg-[var(--muted)] rounded-lg text-sm"
                  >
                    <span className="font-medium">{ACTION_LABELS[relLog.action] || relLog.action}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {formatRelativeTime(relLog.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)] mb-0.5">{label}</p>
      <p className="text-sm font-medium font-mono">{value}</p>
    </div>
  )
}
