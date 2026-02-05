"use client"

import * as React from "react"
import { Search, Filter, Calendar, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ConversationFilters as FiltersType, ConversationStatus } from "@/types"

interface ConversationFiltersProps {
  filters: FiltersType
  onFiltersChange: (filters: FiltersType) => void
  channels?: { id: string; name: string; type: string }[]
  workspaces?: { id: string; name: string }[]
  operators?: { id: string; name: string | null; email: string }[]
  availableTags?: string[]
  className?: string
}

const statusOptions: { value: ConversationStatus; label: string; color: string }[] = [
  { value: 'ACTIVE', label: 'Ativo', color: 'bg-green-500' },
  { value: 'WAITING', label: 'Aguardando', color: 'bg-yellow-500' },
  { value: 'HANDOFF', label: 'Handoff', color: 'bg-orange-500' },
  { value: 'RESOLVED', label: 'Resolvido', color: 'bg-blue-500' },
  { value: 'ARCHIVED', label: 'Arquivado', color: 'bg-gray-500' },
]

export function ConversationFilters({
  filters,
  onFiltersChange,
  channels = [],
  workspaces = [],
  operators = [],
  availableTags = [],
  className,
}: ConversationFiltersProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState(filters.search || '')
  
  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFiltersChange({ ...filters, search: searchValue || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue])

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'sortBy' && key !== 'sortOrder'
  ).length

  const clearFilters = () => {
    setSearchValue('')
    onFiltersChange({
      sortBy: 'lastMessageAt',
      sortOrder: 'desc',
    })
  }

  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    })
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main search and quick filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, contato ou assunto..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 pr-10"
            aria-label="Buscar conversas"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => updateFilter('status', value === 'all' ? undefined : value as ConversationStatus)}
        >
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", status.color)} />
                  {status.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* More filters toggle */}
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
          aria-expanded={isExpanded}
          aria-controls="advanced-filters"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        </Button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div
          id="advanced-filters"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg border"
        >
          {/* Channel */}
          {channels.length > 0 && (
            <Select
              value={filters.channelId || 'all'}
              onValueChange={(value) => updateFilter('channelId', value === 'all' ? undefined : value)}
            >
              <SelectTrigger aria-label="Filtrar por canal">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Workspace */}
          {workspaces.length > 0 && (
            <Select
              value={filters.workspaceId || 'all'}
              onValueChange={(value) => updateFilter('workspaceId', value === 'all' ? undefined : value)}
            >
              <SelectTrigger aria-label="Filtrar por workspace">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os workspaces</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Assigned to */}
          {operators.length > 0 && (
            <Select
              value={filters.assignedToId || 'all'}
              onValueChange={(value) => updateFilter('assignedToId', value === 'all' ? undefined : value)}
            >
              <SelectTrigger aria-label="Filtrar por operador">
                <SelectValue placeholder="Atribuído a" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Não atribuído</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name || op.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <Select
              value={filters.tag || 'all'}
              onValueChange={(value) => updateFilter('tag', value === 'all' ? undefined : value)}
            >
              <SelectTrigger aria-label="Filtrar por tag">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    #{tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort */}
          <Select
            value={`${filters.sortBy || 'lastMessageAt'}-${filters.sortOrder || 'desc'}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split('-') as [FiltersType['sortBy'], FiltersType['sortOrder']]
              onFiltersChange({ ...filters, sortBy, sortOrder })
            }}
          >
            <SelectTrigger aria-label="Ordenar por">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastMessageAt-desc">Última mensagem (mais recente)</SelectItem>
              <SelectItem value="lastMessageAt-asc">Última mensagem (mais antiga)</SelectItem>
              <SelectItem value="createdAt-desc">Criação (mais recente)</SelectItem>
              <SelectItem value="createdAt-asc">Criação (mais antiga)</SelectItem>
              <SelectItem value="messageCount-desc">Mais mensagens</SelectItem>
              <SelectItem value="messageCount-asc">Menos mensagens</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusOptions.find((s) => s.value === filters.status)?.label}
              <button
                onClick={() => updateFilter('status', undefined)}
                className="ml-1 hover:text-foreground"
                aria-label="Remover filtro de status"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.tag && (
            <Badge variant="secondary" className="gap-1">
              Tag: #{filters.tag}
              <button
                onClick={() => updateFilter('tag', undefined)}
                className="ml-1 hover:text-foreground"
                aria-label="Remover filtro de tag"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Busca: {filters.search}
              <button
                onClick={() => {
                  setSearchValue('')
                  updateFilter('search', undefined)
                }}
                className="ml-1 hover:text-foreground"
                aria-label="Remover filtro de busca"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
