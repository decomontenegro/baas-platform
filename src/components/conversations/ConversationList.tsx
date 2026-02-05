"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  MessageSquare,
  User,
  Bot,
  Headphones,
  Clock,
  Tag,
  MoreVertical,
  Archive,
  Trash2,
  UserPlus,
  CheckCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Conversation, ConversationStatus } from "@/types"

interface ConversationListProps {
  conversations: Conversation[]
  isLoading?: boolean
  selectedId?: string
  onSelect?: (conversation: Conversation) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onResolve?: (id: string) => void
  onAssign?: (id: string) => void
  showLoadMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
}

const statusConfig: Record<ConversationStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Ativo', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  WAITING: { label: 'Aguardando', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  HANDOFF: { label: 'Handoff', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  RESOLVED: { label: 'Resolvido', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  ARCHIVED: { label: 'Arquivado', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
}

const roleIcons = {
  USER: User,
  BOT: Bot,
  OPERATOR: Headphones,
  SYSTEM: MessageSquare,
}

function ConversationItemSkeleton() {
  return (
    <div className="p-4 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onArchive,
  onDelete,
  onResolve,
  onAssign,
}: {
  conversation: Conversation
  isSelected?: boolean
  onSelect?: (conversation: Conversation) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onResolve?: (id: string) => void
  onAssign?: (id: string) => void
}) {
  const status = statusConfig[conversation.status]
  const LastMessageIcon = conversation.lastMessage 
    ? roleIcons[conversation.lastMessage.role] 
    : MessageSquare

  const handleClick = () => {
    onSelect?.(conversation)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(conversation)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative p-4 border-b last:border-b-0 cursor-pointer transition-colors",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isSelected && "bg-accent"
      )}
      aria-selected={isSelected}
      aria-label={`Conversa com ${conversation.contactName || conversation.contactId}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative">
          {conversation.contactAvatar ? (
            <img
              src={conversation.contactAvatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
          )}
          {conversation.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center px-1">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {conversation.contactName || conversation.contactId}
            </span>
            <Badge className={cn("text-xs", status.color, status.bgColor)} variant="outline">
              {status.label}
            </Badge>
          </div>

          {/* Last message preview */}
          {conversation.lastMessage && (
            <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <LastMessageIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {conversation.lastMessage.content}
              </span>
            </p>
          )}

          {/* Tags */}
          {conversation.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {conversation.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs py-0 h-5">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {conversation.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs py-0 h-5">
                  +{conversation.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(conversation.lastMessageAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {conversation.messageCount}
          </span>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label="Ações da conversa"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/conversations/${conversation.id}`}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Ver conversa
              </Link>
            </DropdownMenuItem>
            {onAssign && conversation.status !== 'RESOLVED' && (
              <DropdownMenuItem onClick={() => onAssign(conversation.id)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir
              </DropdownMenuItem>
            )}
            {onResolve && conversation.status !== 'RESOLVED' && (
              <DropdownMenuItem onClick={() => onResolve(conversation.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolver
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onArchive && (
              <DropdownMenuItem onClick={() => onArchive(conversation.id)}>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(conversation.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Channel indicator */}
      {conversation.channel && (
        <div className="absolute bottom-1 left-14 text-xs text-muted-foreground">
          via {conversation.channel.name}
        </div>
      )}
    </div>
  )
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  onArchive,
  onDelete,
  onResolve,
  onAssign,
  showLoadMore,
  onLoadMore,
  isLoadingMore,
}: ConversationListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)

  // Infinite scroll handler
  React.useEffect(() => {
    if (!showLoadMore || !onLoadMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    const sentinel = listRef.current?.querySelector('[data-load-more-sentinel]')
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => observer.disconnect()
  }, [showLoadMore, onLoadMore, isLoadingMore])

  if (isLoading) {
    return (
      <Card>
        <div role="list" aria-label="Carregando conversas">
          {[...Array(5)].map((_, i) => (
            <ConversationItemSkeleton key={i} />
          ))}
        </div>
      </Card>
    )
  }

  if (conversations.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma conversa encontrada</p>
          <p className="text-sm mt-1">
            Ajuste os filtros ou aguarde novas mensagens
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card ref={listRef}>
      <div role="list" aria-label="Lista de conversas">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isSelected={selectedId === conversation.id}
            onSelect={onSelect}
            onArchive={onArchive}
            onDelete={onDelete}
            onResolve={onResolve}
            onAssign={onAssign}
          />
        ))}
        
        {showLoadMore && (
          <div
            data-load-more-sentinel
            className="p-4 text-center"
          >
            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Carregando mais...
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
              >
                Carregar mais
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
