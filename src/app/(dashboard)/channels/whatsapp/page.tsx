'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  MessageSquare, 
  Search, 
  RefreshCw,
  Users,
  AtSign,
  Zap,
  Check,
  X,
  Loader2,
  Settings2,
  ChevronRight
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'

interface WhatsAppGroup {
  id: string
  name: string
  requireMention: boolean
  prefix: string | null
  model: string
  enabled: boolean
}

interface GroupsData {
  groups: WhatsAppGroup[]
  total: number
  activeCount: number
  mentionRequired: number
}

const models = [
  { value: 'default', label: 'Padrão (Opus)', cost: '$$$' },
  { value: 'anthropic/claude-sonnet-4', label: 'Sonnet 4', cost: '$$' },
  { value: 'anthropic/claude-haiku-3', label: 'Haiku 3', cost: '$' },
]

export default function WhatsAppGroupsPage() {
  const [data, setData] = useState<GroupsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      setLoading(true)
      // Try database API first, fallback to clawdbot config
      let res = await fetch('/api/channels/whatsapp')
      let json = await res.json()
      
      // Fallback to legacy API if database returns empty
      if (!json.success || (json.data?.groups?.length === 0)) {
        res = await fetch('/api/clawdbot/groups')
        json = await res.json()
      }
      
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error)
      }
    } catch (err) {
      setError('Erro ao carregar grupos')
    } finally {
      setLoading(false)
    }
  }

  async function updateGroup(groupId: string, settings: Partial<WhatsAppGroup>) {
    try {
      setSaving(groupId)
      // Update in database
      const res = await fetch('/api/channels/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, settings }),
      })
      const json = await res.json()
      if (json.success) {
        // Update local state
        setData(prev => prev ? {
          ...prev,
          groups: prev.groups.map(g => 
            g.id === groupId ? { ...g, ...settings } : g
          )
        } : null)
      }
      
      // Also sync to clawdbot config for runtime
      await fetch('/api/clawdbot/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, settings }),
      }).catch(() => {}) // Silent fail for sync
    } catch (err) {
      console.error('Error updating group:', err)
    } finally {
      setSaving(null)
    }
  }

  const filteredGroups = data?.groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.id.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Grupos WhatsApp"
        description="Configure como o bot responde em cada grupo"
        icon={<MessageSquare className="h-6 w-6 text-green-500" />}
        actions={
          <button 
            onClick={fetchGroups}
            className="btn btn-secondary gap-2"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
        }
      />

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            icon={<Users className="h-5 w-5 text-green-500" />}
            label="Total de Grupos"
            value={data.total}
          />
          <StatsCard
            icon={<Check className="h-5 w-5 text-green-500" />}
            label="Habilitados"
            value={data.activeCount}
          />
          <StatsCard
            icon={<AtSign className="h-5 w-5 text-orange-500" />}
            label="Requer @menção"
            value={data.mentionRequired}
          />
          <StatsCard
            icon={<Zap className="h-5 w-5 text-purple-500" />}
            label="Resposta Direta"
            value={data.total - data.mentionRequired}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar grupo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-bordered w-full pl-10"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <X className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Groups List */}
      {!loading && filteredGroups.length > 0 && (
        <div className="card bg-base-100 border border-base-300">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th className="text-center">Ativo</th>
                  <th className="text-center">Responder Sempre</th>
                  <th className="text-center">Modelo</th>
                  <th className="text-center">Prefixo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <motion.tr
                    key={group.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-base-200/50"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <div className="font-medium">{group.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {group.id.substring(0, 20)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="toggle toggle-success toggle-sm"
                        checked={group.enabled}
                        onChange={(e) => updateGroup(group.id, { 
                          enabled: e.target.checked 
                        })}
                        disabled={saving === group.id}
                      />
                    </td>
                    <td className="text-center">
                      <label className="swap">
                        <input
                          type="checkbox"
                          checked={!group.requireMention}
                          onChange={(e) => updateGroup(group.id, { 
                            requireMention: !e.target.checked 
                          })}
                          disabled={saving === group.id}
                        />
                        <div className={cn(
                          "swap-on badge",
                          !group.requireMention ? "badge-success" : "badge-ghost"
                        )}>
                          {saving === group.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>✓ Sim</>
                          )}
                        </div>
                        <div className={cn(
                          "swap-off badge",
                          group.requireMention ? "badge-warning" : "badge-ghost"
                        )}>
                          {saving === group.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>@ Só menção</>
                          )}
                        </div>
                      </label>
                    </td>
                    <td className="text-center">
                      <select
                        value={group.model}
                        onChange={(e) => updateGroup(group.id, { model: e.target.value })}
                        className="select select-sm select-bordered"
                        disabled={saving === group.id}
                      >
                        {models.map(m => (
                          <option key={m.value} value={m.value}>
                            {m.label} {m.cost}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">
                      <input
                        type="text"
                        value={group.prefix || ''}
                        onChange={(e) => updateGroup(group.id, { prefix: e.target.value || null })}
                        placeholder="💡"
                        className="input input-sm input-bordered w-16 text-center"
                        disabled={saving === group.id}
                      />
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredGroups.length === 0 && (
        <div className="card bg-base-100 border border-base-300 p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold">Nenhum grupo encontrado</h3>
          <p className="text-sm text-muted-foreground">
            {search ? 'Tente outra busca' : 'Configure grupos no Clawdbot primeiro'}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Responder Sempre:</strong> Bot responde todas as mensagens (sem precisar de @menção)</p>
        <p><strong>Modelo:</strong> Opus ($$$) é mais capaz, Sonnet ($$) é equilibrado, Haiku ($) é econômico</p>
        <p><strong>Prefixo:</strong> Emoji/texto adicionado antes de cada resposta do bot</p>
      </div>
    </div>
  )
}

function StatsCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-base-200">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  )
}
