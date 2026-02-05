'use client'

import { motion } from 'framer-motion'
import {
  Bot,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Power,
  MessageSquare,
  Users,
  Star,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Bot as BotType } from '@/types/bot'

interface BotCardProps {
  bot: BotType
  onClick?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onToggleActive?: () => void
  compact?: boolean
}

export function BotCard({
  bot,
  onClick,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
  compact = false,
}: BotCardProps) {
  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation()
    action?.()
  }

  // Format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative bg-card rounded-xl border shadow-sm transition-all duration-200',
        'hover:shadow-md hover:border-primary/20',
        onClick && 'cursor-pointer',
        !bot.isActive && 'opacity-60'
      )}
      onClick={onClick}
    >
      {/* Default badge */}
      {bot.isDefault && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-amber-500 text-white border-0 shadow-lg">
            <Star className="w-3 h-3 mr-1 fill-current" />
            Padrão
          </Badge>
        </div>
      )}

      <div className={cn('p-4', compact && 'p-3')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div
              className={cn(
                'flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-2xl',
                compact ? 'w-10 h-10' : 'w-12 h-12'
              )}
            >
              {bot.avatar || <Bot className={cn('text-primary', compact ? 'w-5 h-5' : 'w-6 h-6')} />}
            </div>

            {/* Name & Description */}
            <div className="min-w-0 flex-1">
              <h3 className={cn('font-semibold truncate', compact ? 'text-sm' : 'text-base')}>
                {bot.name}
              </h3>
              {!compact && bot.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                  {bot.description}
                </p>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => handleAction(e as any, onEdit)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleAction(e as any, onDuplicate)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => handleAction(e as any, onToggleActive)}>
                <Power className="w-4 h-4 mr-2" />
                {bot.isActive ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => handleAction(e as any, onDelete)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status & Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge
            variant={bot.isActive ? 'default' : 'secondary'}
            className={cn(
              'text-xs',
              bot.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            {bot.isActive ? 'Ativo' : 'Inativo'}
          </Badge>

          {bot.assignmentCount !== undefined && bot.assignmentCount > 0 && (
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {bot.assignmentCount} {bot.assignmentCount === 1 ? 'canal' : 'canais'}
            </Badge>
          )}

          {bot.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {bot.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{bot.tags.length - 2}
            </Badge>
          )}
        </div>

        {/* Stats */}
        {!compact && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>{formatNumber(bot.messageCount)} msgs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{formatNumber(bot.conversationCount)} conversas</span>
            </div>
          </div>
        )}

        {/* Model badge */}
        {!compact && (
          <div className="mt-3">
            <Badge variant="secondary" className="text-xs font-mono">
              {bot.model}
            </Badge>
          </div>
        )}
      </div>
    </motion.div>
  )
}
