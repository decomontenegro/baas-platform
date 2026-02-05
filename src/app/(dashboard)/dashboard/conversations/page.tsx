"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare,
  RefreshCw,
  Download,
  Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ConversationList,
  ConversationFilters,
} from "@/components/conversations"
import {
  useConversationsInfinite,
  useUpdateConversation,
  useDeleteConversation,
} from "@/hooks/use-conversations"
import { useConversationFilterData } from "@/hooks/use-filters"
import { cn } from "@/lib/utils"
import type { ConversationFilters as FiltersType, Conversation } from "@/types"

// Default tags that are commonly used (could also come from API)
const availableTags = ['urgente', 'vip', 'reclamação', 'dúvida', 'sugestão', 'bug']

export default function ConversationsPage() {
  const router = useRouter()
  const [filters, setFilters] = React.useState<FiltersType>({
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
  })

  // Fetch filter options from API
  const { channels, workspaces, isLoading: isLoadingFilters } = useConversationFilterData()

  const {
    conversations,
    total,
    isLoading,
    isLoadingMore,
    isReachingEnd,
    mutate,
    loadMore,
  } = useConversationsInfinite(filters)

  const handleSelectConversation = (conversation: Conversation) => {
    router.push(`/dashboard/conversations/${conversation.id}`)
  }

  const handleArchive = async (id: string) => {
    // Would call API to archive
    console.log('Archive:', id)
    mutate()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return
    // Would call API to delete
    console.log('Delete:', id)
    mutate()
  }

  const handleResolve = async (id: string) => {
    // Would call API to resolve
    console.log('Resolve:', id)
    mutate()
  }

  const handleAssign = async (id: string) => {
    // Would open assignment modal
    console.log('Assign:', id)
  }

  // Stats calculation
  const stats = React.useMemo(() => {
    const active = conversations.filter((c) => c.status === 'ACTIVE').length
    const waiting = conversations.filter((c) => c.status === 'WAITING').length
    const handoff = conversations.filter((c) => c.status === 'HANDOFF').length
    const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
    return { active, waiting, handoff, unread }
  }, [conversations])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Conversas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as conversas dos seus canais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            aria-label="Atualizar lista"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" aria-label="Exportar conversas">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
              <Badge variant="secondary">{conversations.length} carregadas</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Handoff</p>
                <p className="text-2xl font-bold text-orange-600">{stats.handoff}</p>
              </div>
              {stats.handoff > 0 && (
                <Badge variant="destructive">Atenção</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Não lidas</p>
                <p className="text-2xl font-bold text-primary">{stats.unread}</p>
              </div>
              {stats.unread > 0 && (
                <Badge>Novas</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <ConversationFilters
        filters={filters}
        onFiltersChange={setFilters}
        channels={channels}
        workspaces={workspaces}
        operators={[]} // TODO: Add operators hook when needed
        availableTags={availableTags}
      />

      {/* Conversation list */}
      <ConversationList
        conversations={conversations}
        isLoading={isLoading}
        onSelect={handleSelectConversation}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onResolve={handleResolve}
        onAssign={handleAssign}
        showLoadMore={!isReachingEnd}
        onLoadMore={loadMore}
        isLoadingMore={isLoadingMore}
      />

      {/* Empty state actions */}
      {!isLoading && conversations.length === 0 && (
        <Card className="p-8 text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">Nenhuma conversa encontrada</h3>
          <p className="text-muted-foreground mb-4">
            Não há conversas que correspondam aos filtros selecionados.
          </p>
          <Button
            variant="outline"
            onClick={() => setFilters({ sortBy: 'lastMessageAt', sortOrder: 'desc' })}
          >
            Limpar filtros
          </Button>
        </Card>
      )}
    </div>
  )
}
