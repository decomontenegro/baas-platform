'use client'

import { useState, useEffect } from 'react'
import { 
  GitBranch, 
  Plus, 
  Play, 
  Pause, 
  MoreVertical,
  Zap,
  MessageSquare,
  Clock,
  Filter,
  Search,
  ArrowRight,
  Bot
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'

interface Flow {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'draft'
  trigger: string
  steps: number
  executions: number
  lastRun: string | null
  createdAt: string
}

// Mock data - will be replaced with API
const mockFlows: Flow[] = [
  {
    id: '1',
    name: 'Welcome New Users',
    description: 'Sends a welcome message when a new user starts a conversation',
    status: 'active',
    trigger: 'New conversation',
    steps: 3,
    executions: 1250,
    lastRun: '2026-02-01T01:30:00Z',
    createdAt: '2026-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Support Escalation',
    description: 'Escalates to human agent after 3 failed attempts',
    status: 'active',
    trigger: 'Intent: escalate',
    steps: 5,
    executions: 340,
    lastRun: '2026-02-01T00:45:00Z',
    createdAt: '2026-01-20T14:00:00Z'
  },
  {
    id: '3',
    name: 'After Hours Reply',
    description: 'Auto-reply when received outside business hours',
    status: 'paused',
    trigger: 'Schedule: Outside 9am-6pm',
    steps: 2,
    executions: 890,
    lastRun: '2026-01-31T22:00:00Z',
    createdAt: '2026-01-18T09:00:00Z'
  },
  {
    id: '4',
    name: 'Feedback Collection',
    description: 'Asks for feedback after conversation ends',
    status: 'draft',
    trigger: 'Conversation closed',
    steps: 4,
    executions: 0,
    lastRun: null,
    createdAt: '2026-01-30T16:00:00Z'
  }
]

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  'New conversation': <MessageSquare className="w-4 h-4" />,
  'Intent: escalate': <Zap className="w-4 h-4" />,
  'Schedule: Outside 9am-6pm': <Clock className="w-4 h-4" />,
  'Conversation closed': <MessageSquare className="w-4 h-4" />
}

export default function FlowsPage() {
  // Real flows from Clawdbot cron jobs
  const [flows, setFlows] = useState<Flow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchFlows() {
      try {
        const res = await fetch('/api/clawdbot/flows')
        const data = await res.json()
        if (data.success && data.data) {
          setFlows(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch flows:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchFlows()
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredFlows = flows.filter(flow => {
    const matchesSearch = flow.name.toLowerCase().includes(search.toLowerCase()) ||
                          flow.description.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || flow.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: flows.length,
    active: flows.filter(f => f.status === 'active').length,
    totalExecutions: flows.reduce((sum, f) => sum + f.executions, 0)
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Flows" 
        subtitle="Automate conversations with visual workflows" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <GitBranch className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Total Flows</p>
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Play className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Active</p>
              </div>
            </div>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
                <p className="text-sm text-[var(--muted-foreground)]">Total Executions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search flows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
            </select>
            
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Flow</span>
            </button>
          </div>
        </div>

        {/* Flows List */}
        <div className="space-y-4">
          {filteredFlows.length === 0 ? (
            <div className="card p-12 text-center">
              <Bot className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <h3 className="text-lg font-medium mb-2">No flows found</h3>
              <p className="text-[var(--muted-foreground)] mb-4">
                {search ? 'Try adjusting your search' : 'Create your first automation flow'}
              </p>
              <button className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Flow
              </button>
            </div>
          ) : (
            filteredFlows.map((flow) => (
              <div key={flow.id} className="card p-4 hover:border-[var(--primary)] transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium truncate">{flow.name}</h3>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[flow.status])}>
                        {flow.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] mb-3">{flow.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                        {TRIGGER_ICONS[flow.trigger] || <Zap className="w-4 h-4" />}
                        <span>{flow.trigger}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                        <ArrowRight className="w-4 h-4" />
                        <span>{flow.steps} steps</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                        <Zap className="w-4 h-4" />
                        <span>{flow.executions.toLocaleString()} runs</span>
                      </div>
                      {flow.lastRun && (
                        <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                          <Clock className="w-4 h-4" />
                          <span>Last: {new Date(flow.lastRun).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {flow.status === 'active' ? (
                      <button className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors" title="Pause">
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : flow.status === 'paused' ? (
                      <button className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors" title="Resume">
                        <Play className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-8 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
              <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h4 className="font-medium text-violet-900 dark:text-violet-100">Visual Flow Builder Coming Soon</h4>
              <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
                We're building a drag-and-drop flow builder. For now, flows are configured via API.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
