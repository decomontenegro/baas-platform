'use client'

import { useState } from 'react'
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

// Mock data for flows
const mockFlows = [
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
    trigger: 'Schedule: after hours',
    steps: 2,
    executions: 89,
    lastRun: null,
    createdAt: '2026-01-25T09:00:00Z'
  }
]

export default function FlowsPage() {
  const [selectedTab, setSelectedTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFlows = mockFlows.filter(flow => 
    flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flow.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="w-3 h-3" />
      case 'paused': return <Pause className="w-3 h-3" />
      case 'draft': return <Clock className="w-3 h-3" />
      default: return null
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flows</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gerencie fluxos de automação e gatilhos conversacionais
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Novo Flow
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Flows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
            </div>
            <GitBranch className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ativos</p>
              <p className="text-2xl font-bold text-green-600">2</p>
            </div>
            <Zap className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Execuções Hoje</p>
              <p className="text-2xl font-bold text-blue-600">1,679</p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-emerald-600">94.2%</p>
            </div>
            <Bot className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar flows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Flows List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gatilho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Execuções
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Última Execução
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFlows.map((flow) => (
                <tr key={flow.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {flow.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {flow.description}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {flow.steps} etapas
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(flow.status)}`}>
                      {getStatusIcon(flow.status)}
                      {flow.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {flow.trigger}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {flow.executions.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {flow.lastRun ? new Date(flow.lastRun).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFlows.length === 0 && (
        <div className="text-center py-12">
          <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Nenhum flow encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Tente ajustar os filtros de busca.' : 'Comece criando seu primeiro flow de automação.'}
          </p>
        </div>
      )}
    </div>
  )
}