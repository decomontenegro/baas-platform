'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Settings,
  Trash2,
  ExternalLink,
  Zap,
  Loader2,
  Link as LinkIcon,
  Unlink
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { 
  INTEGRATIONS_REGISTRY, 
  INTEGRATION_CATEGORIES,
  type IntegrationInfo,
} from '@/lib/integrations/types'
import type { IntegrationType, IntegrationStatus } from '@prisma/client'

interface ConnectedIntegration {
  type: IntegrationType
  info: IntegrationInfo
  connected: boolean
  connection?: {
    id: string
    name: string
    status: IntegrationStatus
    lastSyncAt: string | null
    statusMessage: string | null
  }
}

const statusConfig: Record<IntegrationStatus, { color: string; icon: React.ReactNode; label: string }> = {
  ACTIVE: { color: 'text-green-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Connected' },
  INACTIVE: { color: 'text-gray-400', icon: <XCircle className="w-4 h-4" />, label: 'Disconnected' },
  ERROR: { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Error' },
  EXPIRED: { color: 'text-yellow-500', icon: <Clock className="w-4 h-4" />, label: 'Expired' },
  PENDING: { color: 'text-blue-500', icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Connecting...' },
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<ConnectedIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<ConnectedIntegration | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectConfig, setConnectConfig] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // For demo, use a mock workspaceId
  const workspaceId = 'demo-workspace'

  useEffect(() => {
    fetchIntegrations()
    
    // Check for success/error in URL params
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const errorMsg = params.get('error')
    const type = params.get('type')
    
    if (success === 'true' && type) {
      // Show success toast or notification
      console.log(`Successfully connected ${type}`)
      // Clear URL params
      window.history.replaceState({}, '', '/integrations')
    } else if (errorMsg) {
      setError(errorMsg)
      window.history.replaceState({}, '', '/integrations')
    }
  }, [])

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      // Fetch real channels from Clawdbot API
      const channelsRes = await fetch('/api/clawdbot/channels')
      const channelsData = await channelsRes.json()
      const realChannels = channelsData.success ? channelsData.data : []
      
      // Map real channels to connected types
      const connectedTypes = new Set<string>()
      for (const ch of realChannels) {
        if (ch.type === 'whatsapp') connectedTypes.add('CHANNEL_WHATSAPP')
        if (ch.type === 'telegram') connectedTypes.add('CHANNEL_TELEGRAM')
        if (ch.type === 'discord') connectedTypes.add('CHANNEL_DISCORD')
        if (ch.type === 'slack') connectedTypes.add('CHANNEL_SLACK')
        if (ch.type === 'webchat') connectedTypes.add('WEBHOOK')
      }
      
      // Create integrations list with real status
      const realIntegrations: ConnectedIntegration[] = Object.entries(INTEGRATIONS_REGISTRY).map(
        ([type, info]) => ({
          type: type as IntegrationType,
          info,
          connected: connectedTypes.has(type),
          connection: connectedTypes.has(type) ? {
            id: `int-${type.toLowerCase()}`,
            name: info.name,
            status: 'ACTIVE' as IntegrationStatus,
            lastSyncAt: new Date().toISOString(),
            statusMessage: 'Conectado via Clawdbot',
          } : undefined,
        })
      )
      
      setIntegrations(realIntegrations)
    } catch (err) {
      setError('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (integration: ConnectedIntegration) => {
    setSelectedIntegration(integration)
    setConnectConfig({})
    
    if (integration.info.oauthRequired) {
      // Start OAuth flow
      setConnecting(true)
      try {
        const res = await fetch(`/api/integrations/${integration.type}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        })
        const data = await res.json()
        
        if (data.authUrl) {
          window.location.href = data.authUrl
        }
      } catch (err) {
        setError('Failed to start connection')
      } finally {
        setConnecting(false)
      }
    } else {
      // Show config modal for API key integrations
      setShowConnectModal(true)
    }
  }

  const handleSubmitConfig = async () => {
    if (!selectedIntegration) return
    
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          type: selectedIntegration.type,
          name: selectedIntegration.info.name,
          config: connectConfig,
        }),
      })
      
      if (res.ok) {
        fetchIntegrations()
        setShowConnectModal(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to connect')
      }
    } catch (err) {
      setError('Failed to connect integration')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (integration: ConnectedIntegration) => {
    if (!integration.connection) return
    
    if (!confirm(`Disconnect ${integration.info.name}?`)) return
    
    try {
      await fetch(`/api/integrations/${integration.connection.id}`, {
        method: 'DELETE',
      })
      fetchIntegrations()
    } catch (err) {
      setError('Failed to disconnect')
    }
  }

  const handleSync = async (integration: ConnectedIntegration) => {
    if (!integration.connection) return
    
    setSyncing(integration.connection.id)
    try {
      await fetch(`/api/integrations/${integration.connection.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testOnly: false }),
      })
      fetchIntegrations()
    } catch (err) {
      setError('Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  // Filter integrations
  const filteredIntegrations = integrations.filter(int => {
    const matchesSearch = 
      int.info.name.toLowerCase().includes(search.toLowerCase()) ||
      int.info.description.toLowerCase().includes(search.toLowerCase())
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      int.info.category === selectedCategory ||
      (selectedCategory === 'connected' && int.connected)
    
    return matchesSearch && matchesCategory
  })

  // Group by category
  const groupedIntegrations = filteredIntegrations.reduce((acc, int) => {
    const cat = int.info.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(int)
    return acc
  }, {} as Record<string, ConnectedIntegration[]>)

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.connected).length,
    active: integrations.filter(i => i.connection?.status === 'ACTIVE').length,
    error: integrations.filter(i => i.connection?.status === 'ERROR').length,
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        title="Integrations" 
        subtitle="Connect external services to supercharge your bot" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Total Available" 
            value={stats.total} 
            icon={<Zap className="w-5 h-5 text-primary-500" />} 
          />
          <StatCard 
            label="Connected" 
            value={stats.connected} 
            icon={<LinkIcon className="w-5 h-5 text-green-500" />} 
          />
          <StatCard 
            label="Active" 
            value={stats.active} 
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} 
          />
          <StatCard 
            label="Errors" 
            value={stats.error} 
            icon={<AlertCircle className="w-5 h-5 text-red-500" />} 
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                selectedCategory === 'all' 
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' 
                  : 'bg-[var(--muted)] hover:bg-[var(--border)]'
              )}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCategory('connected')}
              className={cn(
                'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                selectedCategory === 'connected' 
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' 
                  : 'bg-[var(--muted)] hover:bg-[var(--border)]'
              )}
            >
              Connected
            </button>
            {Object.entries(INTEGRATION_CATEGORIES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={cn(
                  'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                  selectedCategory === key 
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' 
                    : 'bg-[var(--muted)] hover:bg-[var(--border)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {/* Integration Grid by Category */}
        {!loading && (
          <div className="space-y-8">
            {Object.entries(groupedIntegrations).map(([category, ints]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {INTEGRATION_CATEGORIES[category as keyof typeof INTEGRATION_CATEGORIES] || category}
                  <span className="text-sm font-normal text-[var(--muted-foreground)]">
                    ({ints.length})
                  </span>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ints.map((integration, index) => (
                    <IntegrationCard
                      key={integration.type}
                      integration={integration}
                      delay={index * 0.05}
                      syncing={syncing === integration.connection?.id}
                      onConnect={() => handleConnect(integration)}
                      onDisconnect={() => handleDisconnect(integration)}
                      onSync={() => handleSync(integration)}
                      onConfigure={() => {
                        setSelectedIntegration(integration)
                        setShowConfigModal(true)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-2">No integrations found</h3>
            <p className="text-[var(--muted-foreground)]">
              {search ? 'Try adjusting your search' : 'Connect your first integration to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Connect Modal (for API key integrations) */}
      <Modal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        title={`Connect ${selectedIntegration?.info.name}`}
        description={selectedIntegration?.info.description}
      >
        {selectedIntegration && (
          <div className="space-y-4">
            {selectedIntegration.info.configFields?.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={connectConfig[field.key] || ''}
                    onChange={(e) => setConnectConfig({ ...connectConfig, [field.key]: e.target.value })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : field.type}
                    placeholder={field.placeholder}
                    value={connectConfig[field.key] || ''}
                    onChange={(e) => setConnectConfig({ ...connectConfig, [field.key]: e.target.value })}
                    className="input"
                  />
                )}
                {field.description && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{field.description}</p>
                )}
              </div>
            ))}
            
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowConnectModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitConfig}
                className="btn-primary"
                disabled={connecting}
              >
                {connecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Connect
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Config Modal */}
      <Modal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        title={`Configure ${selectedIntegration?.info.name}`}
      >
        {selectedIntegration && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[var(--muted)] rounded-lg">
              <span className="text-3xl">{selectedIntegration.info.icon}</span>
              <div>
                <h3 className="font-medium">{selectedIntegration.info.name}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {selectedIntegration.connection?.status 
                    ? statusConfig[selectedIntegration.connection.status].label 
                    : 'Not connected'}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <ul className="space-y-1">
                {selectedIntegration.info.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {selectedIntegration.info.docsUrl && (
              <a
                href={selectedIntegration.info.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
              >
                View Documentation
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowConfigModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Stat Card Component
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  )
}

// Integration Card Component
function IntegrationCard({ 
  integration, 
  delay,
  syncing,
  onConnect, 
  onDisconnect, 
  onSync,
  onConfigure,
}: { 
  integration: ConnectedIntegration
  delay: number
  syncing: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
  onConfigure: () => void
}) {
  const status = integration.connection?.status
  const statusInfo = status ? statusConfig[status] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-5 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${integration.info.color}20` }}
        >
          {integration.info.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{integration.info.name}</h3>
            {statusInfo && (
              <span className={cn('flex items-center gap-1', statusInfo.color)}>
                {statusInfo.icon}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
            {integration.info.description}
          </p>
        </div>
      </div>

      {integration.connected && integration.connection && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Last sync</span>
            <span>
              {integration.connection.lastSyncAt 
                ? new Date(integration.connection.lastSyncAt).toLocaleString() 
                : 'Never'}
            </span>
          </div>
          {integration.connection.statusMessage && (
            <p className="text-xs text-red-500 mt-1">{integration.connection.statusMessage}</p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {integration.connected ? (
          <>
            <button
              onClick={onSync}
              disabled={syncing}
              className="btn-secondary flex-1 text-sm py-2"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Sync
            </button>
            <button
              onClick={onConfigure}
              className="btn-secondary p-2"
              title="Configure"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onDisconnect}
              className="btn-secondary p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Disconnect"
            >
              <Unlink className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="btn-primary flex-1 text-sm py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Connect
          </button>
        )}
      </div>
    </motion.div>
  )
}
