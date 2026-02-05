'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Bot,
  Filter,
  X,
  Loader2,
  AlertCircle,
  MoreHorizontal,
} from 'lucide-react'
import useSWR from 'swr'
import { BotCard } from '@/components/bots/BotCard'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { Bot as BotType } from '@/types/bot'
import { toast } from 'sonner'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ViewMode = 'grid' | 'list'

export default function BotsPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(false)
  const [deleteBot, setDeleteBot] = useState<BotType | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch bots
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    data: BotType[]
    pagination: { total: number }
  }>(`/api/bots?active=${showActiveOnly}&search=${searchQuery}`, fetcher, {
    refreshInterval: 30000,
  })

  const bots = data?.data || []
  const total = data?.pagination?.total || 0

  // Handle bot actions
  const handleEdit = (bot: BotType) => {
    router.push(`/bots/${bot.id}`)
  }

  const handleDuplicate = async (bot: BotType) => {
    try {
      const response = await fetch(`/api/bots/${bot.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${bot.name} (cópia)`,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao duplicar')
      }

      toast.success('Bot duplicado com sucesso')
      mutate()
      router.push(`/bots/${result.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar bot')
    }
  }

  const handleToggleActive = async (bot: BotType) => {
    try {
      const response = await fetch(`/api/bots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !bot.isActive }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao atualizar')
      }

      toast.success(bot.isActive ? 'Bot desativado' : 'Bot ativado')
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar bot')
    }
  }

  const handleDelete = async () => {
    if (!deleteBot) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/bots/${deleteBot.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao deletar')
      }

      toast.success('Bot deletado com sucesso')
      setDeleteBot(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar bot')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
          <p className="text-muted-foreground">
            Gerencie seus bots e personalize suas personalidades
          </p>
        </div>
        <button
          onClick={() => router.push('/bots/new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Bot
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar bots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Options */}
        <div className="flex items-center gap-3">
          {/* Active filter */}
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              showActiveOnly
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            <Filter className="w-4 h-4" />
            Apenas ativos
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{total} {total === 1 ? 'bot' : 'bots'} encontrado{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar bots</h3>
          <p className="text-muted-foreground mb-4">Tente novamente mais tarde</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && bots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? 'Nenhum bot encontrado' : 'Nenhum bot criado'}
          </h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? 'Tente ajustar os filtros ou buscar por outros termos.'
              : 'Crie seu primeiro bot para começar a automatizar conversas.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="text-primary hover:underline"
            >
              Limpar busca
            </button>
          ) : (
            <button
              onClick={() => router.push('/bots/new')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              Criar primeiro bot
            </button>
          )}
        </div>
      )}

      {/* Bots Grid */}
      {!isLoading && !error && bots.length > 0 && (
        <motion.div
          layout
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3'
          )}
        >
          <AnimatePresence mode="popLayout">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                compact={viewMode === 'list'}
                onClick={() => handleEdit(bot)}
                onEdit={() => handleEdit(bot)}
                onDuplicate={() => handleDuplicate(bot)}
                onDelete={() => setDeleteBot(bot)}
                onToggleActive={() => handleToggleActive(bot)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteBot} onOpenChange={() => setDeleteBot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar bot</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{deleteBot?.name}</strong>?
              <br />
              Esta ação não pode ser desfeita. O bot será removido de todos os canais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
