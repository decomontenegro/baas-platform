'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Key, 
  Plus, 
  MoreVertical,
  Trash2,
  Edit,
  Power,
  PowerOff,
  AlertTriangle,
  Shield,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Types
interface OAuthCredential {
  id: string
  name: string
  provider: 'whatsapp' | 'evolution' | 'baileys' | 'custom'
  clientId: string
  status: 'active' | 'inactive' | 'emergency'
  usagePercent: number
  requestsToday: number
  dailyLimit: number
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
}

// Mock data for demonstration
const mockCredentials: OAuthCredential[] = [
  {
    id: '1',
    name: 'WhatsApp Business API - Principal',
    provider: 'whatsapp',
    clientId: 'waba_prod_xxxxx',
    status: 'active',
    usagePercent: 72,
    requestsToday: 7200,
    dailyLimit: 10000,
    lastUsedAt: new Date().toISOString(),
    createdAt: '2024-01-15T10:00:00Z',
    expiresAt: '2025-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Evolution API - Backup',
    provider: 'evolution',
    clientId: 'evo_backup_xxxxx',
    status: 'inactive',
    usagePercent: 0,
    requestsToday: 0,
    dailyLimit: 5000,
    lastUsedAt: '2024-01-20T15:30:00Z',
    createdAt: '2024-01-10T08:00:00Z',
    expiresAt: null,
  },
  {
    id: '3',
    name: 'WhatsApp Business - Emergência',
    provider: 'whatsapp',
    clientId: 'waba_emergency_xxxxx',
    status: 'emergency',
    usagePercent: 95,
    requestsToday: 9500,
    dailyLimit: 10000,
    lastUsedAt: new Date().toISOString(),
    createdAt: '2024-01-05T12:00:00Z',
    expiresAt: '2024-06-05T12:00:00Z',
  },
]

const STATUS_CONFIG = {
  active: {
    label: 'Ativo',
    variant: 'success' as const,
    icon: Power,
  },
  inactive: {
    label: 'Inativo',
    variant: 'secondary' as const,
    icon: PowerOff,
  },
  emergency: {
    label: 'Emergência',
    variant: 'warning' as const,
    icon: AlertTriangle,
  },
}

const PROVIDER_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp Business API',
  evolution: 'Evolution API',
  baileys: 'Baileys',
  custom: 'Custom Provider',
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<OAuthCredential[]>(mockCredentials)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editCredential, setEditCredential] = useState<OAuthCredential | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Calculate summary stats
  const activeCount = credentials.filter(c => c.status === 'active').length
  const totalRequests = credentials.reduce((sum, c) => sum + c.requestsToday, 0)
  const avgUsage = credentials.length > 0 
    ? Math.round(credentials.reduce((sum, c) => sum + c.usagePercent, 0) / credentials.length)
    : 0

  const handleToggleStatus = (id: string) => {
    setCredentials(credentials.map(c => {
      if (c.id === id) {
        const newStatus = c.status === 'active' ? 'inactive' : 'active'
        toast.success(`Credencial ${newStatus === 'active' ? 'ativada' : 'desativada'}`)
        return { ...c, status: newStatus }
      }
      return c
    }))
    setOpenDropdown(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta credencial?')) return
    setCredentials(credentials.filter(c => c.id !== id))
    toast.success('Credencial excluída')
    setOpenDropdown(null)
  }

  const handleSetEmergency = (id: string) => {
    setCredentials(credentials.map(c => ({
      ...c,
      status: c.id === id ? 'emergency' : (c.status === 'emergency' ? 'active' : c.status)
    })))
    toast.success('Credencial de emergência definida')
    setOpenDropdown(null)
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Credenciais OAuth" 
        subtitle="Gerencie suas credenciais de API e provedores de mensagem" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Credenciais Ativas</p>
                  <p className="text-2xl font-bold">{activeCount}/{credentials.length}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <Key className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Requisições Hoje</p>
                  <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Uso Médio</p>
                  <p className="text-2xl font-bold">{avgUsage}%</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header with Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Lista de Credenciais</h2>
            <p className="text-sm text-muted-foreground">
              {credentials.length} credencial{credentials.length !== 1 ? 'is' : ''} cadastrada{credentials.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Credencial
          </Button>
        </div>

        {/* Credentials List */}
        <div className="space-y-4">
          {credentials.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhuma credencial cadastrada</p>
                <p className="text-muted-foreground mb-4">
                  Adicione sua primeira credencial para começar
                </p>
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Credencial
                </Button>
              </CardContent>
            </Card>
          ) : (
            credentials.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                isOpen={openDropdown === credential.id}
                onToggle={() => setOpenDropdown(openDropdown === credential.id ? null : credential.id)}
                onEdit={() => setEditCredential(credential)}
                onDelete={() => handleDelete(credential.id)}
                onToggleStatus={() => handleToggleStatus(credential.id)}
                onSetEmergency={() => handleSetEmergency(credential.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Add Credential Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddCredentialModal
            onClose={() => setShowAddModal(false)}
            onSuccess={(newCredential) => {
              setCredentials([newCredential, ...credentials])
              setShowAddModal(false)
              toast.success('Credencial adicionada!')
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Credential Modal */}
      <AnimatePresence>
        {editCredential && (
          <EditCredentialModal
            credential={editCredential}
            onClose={() => setEditCredential(null)}
            onSuccess={(updated) => {
              setCredentials(credentials.map(c => c.id === updated.id ? updated : c))
              setEditCredential(null)
              toast.success('Credencial atualizada!')
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Credential Card Component
// ============================================================================

function CredentialCard({
  credential,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onToggleStatus,
  onSetEmergency,
}: {
  credential: OAuthCredential
  isOpen: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
  onSetEmergency: () => void
}) {
  const [showSecret, setShowSecret] = useState(false)
  const statusConfig = STATUS_CONFIG[credential.status]
  const StatusIcon = statusConfig.icon

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência')
  }

  return (
    <Card className={cn(
      'transition-all',
      credential.status === 'emergency' && 'border-yellow-500 dark:border-yellow-500'
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              credential.status === 'active' && 'bg-green-100 dark:bg-green-900/30',
              credential.status === 'inactive' && 'bg-gray-100 dark:bg-gray-900/30',
              credential.status === 'emergency' && 'bg-yellow-100 dark:bg-yellow-900/30',
            )}>
              <Key className={cn(
                'w-5 h-5',
                credential.status === 'active' && 'text-green-600 dark:text-green-400',
                credential.status === 'inactive' && 'text-gray-600 dark:text-gray-400',
                credential.status === 'emergency' && 'text-yellow-600 dark:text-yellow-400',
              )} />
            </div>
            <div>
              <h3 className="font-semibold">{credential.name}</h3>
              <p className="text-sm text-muted-foreground">{PROVIDER_LABELS[credential.provider]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
            
            <div className="relative">
              <button
                onClick={onToggle}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10"
                  >
                    <button
                      onClick={onEdit}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors rounded-t-lg"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={onToggleStatus}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors"
                    >
                      {credential.status === 'active' ? (
                        <>
                          <PowerOff className="w-4 h-4" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Power className="w-4 h-4" />
                          Ativar
                        </>
                      )}
                    </button>
                    <button
                      onClick={onSetEmergency}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors text-yellow-600"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {credential.status === 'emergency' ? 'Remover Emergência' : 'Definir Emergência'}
                    </button>
                    <button
                      onClick={onDelete}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-b-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Client ID */}
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Client ID:</span>
              <code className="text-sm font-mono">
                {showSecret ? credential.clientId : credential.clientId.replace(/./g, '•')}
              </code>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="p-1.5 hover:bg-background rounded transition-colors"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => copyToClipboard(credential.clientId)}
                className="p-1.5 hover:bg-background rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uso Diário</span>
            <span className="font-medium">
              {credential.requestsToday.toLocaleString()} / {credential.dailyLimit.toLocaleString()}
            </span>
          </div>
          <div className="relative">
            <Progress value={credential.usagePercent} className="h-2" />
            <div 
              className={cn(
                'absolute top-0 left-0 h-2 rounded-full transition-all',
                getProgressColor(credential.usagePercent)
              )}
              style={{ width: `${credential.usagePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{credential.usagePercent}% utilizado</span>
            {credential.usagePercent >= 90 && (
              <span className="text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Limite próximo
              </span>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Último uso: {credential.lastUsedAt 
              ? new Date(credential.lastUsedAt).toLocaleString('pt-BR')
              : 'Nunca utilizado'
            }
          </span>
          {credential.expiresAt && (
            <span className={cn(
              new Date(credential.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                && 'text-yellow-600'
            )}>
              Expira: {new Date(credential.expiresAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Add Credential Modal
// ============================================================================

function AddCredentialModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (credential: OAuthCredential) => void
}) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<OAuthCredential['provider']>('whatsapp')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [dailyLimit, setDailyLimit] = useState('10000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const newCredential: OAuthCredential = {
        id: crypto.randomUUID(),
        name,
        provider,
        clientId,
        status: 'inactive',
        usagePercent: 0,
        requestsToday: 0,
        dailyLimit: parseInt(dailyLimit),
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      }

      onSuccess(newCredential)
    } catch (err) {
      setError('Falha ao adicionar credencial')
    } finally {
      setLoading(false)
    }
  }

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
        className="bg-card rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Adicionar Credencial</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Nome da Credencial</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: WhatsApp Production"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Provedor</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as OAuthCredential['provider'])}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="whatsapp">WhatsApp Business API</option>
              <option value="evolution">Evolution API</option>
              <option value="baileys">Baileys</option>
              <option value="custom">Custom Provider</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="client_id_xxxxx"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Client Secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Limite Diário</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="10000"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// Edit Credential Modal
// ============================================================================

function EditCredentialModal({
  credential,
  onClose,
  onSuccess,
}: {
  credential: OAuthCredential
  onClose: () => void
  onSuccess: (credential: OAuthCredential) => void
}) {
  const [name, setName] = useState(credential.name)
  const [dailyLimit, setDailyLimit] = useState(credential.dailyLimit.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      onSuccess({
        ...credential,
        name,
        dailyLimit: parseInt(dailyLimit),
      })
    } catch (err) {
      setError('Falha ao atualizar credencial')
    } finally {
      setLoading(false)
    }
  }

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
        className="bg-card rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Editar Credencial</h3>
            <p className="text-sm text-muted-foreground">{credential.clientId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Nome da Credencial</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Provedor</label>
            <input
              type="text"
              value={PROVIDER_LABELS[credential.provider]}
              disabled
              className="w-full px-3 py-2 border border-input rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Limite Diário</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
