"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeft,
  User,
  MessageSquare,
  Tag,
  Plus,
  Send,
  MoreVertical,
  Archive,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  UserPlus,
  StickyNote,
  History,
  X,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageBubble,
  groupMessagesBySender,
  ConversationStats,
} from "@/components/conversations"
import {
  useConversation,
  useConversationMessages,
  useUpdateConversation,
  useSendMessage,
  useAddNote,
  useUpdateTag,
} from "@/hooks/use-conversations"
import { cn } from "@/lib/utils"
import type { ConversationStatus, ConversationEvent } from "@/types"

const statusConfig: Record<ConversationStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Ativo', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  WAITING: { label: 'Aguardando', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  HANDOFF: { label: 'Handoff', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  RESOLVED: { label: 'Resolvido', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  ARCHIVED: { label: 'Arquivado', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}>
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 w-64 rounded-2xl" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  )
}

function EventItem({ event }: { event: ConversationEvent }) {
  const eventLabels: Record<string, string> = {
    STARTED: 'Conversa iniciada',
    HANDOFF_REQUESTED: 'Handoff solicitado',
    HANDOFF_ACCEPTED: 'Handoff aceito',
    HANDOFF_REJECTED: 'Handoff rejeitado',
    ASSIGNED: 'Conversa atribuída',
    UNASSIGNED: 'Atribuição removida',
    STATUS_CHANGED: 'Status alterado',
    TAG_ADDED: 'Tag adicionada',
    TAG_REMOVED: 'Tag removida',
    NOTE_ADDED: 'Nota adicionada',
    RESOLVED: 'Conversa resolvida',
    REOPENED: 'Conversa reaberta',
    ARCHIVED: 'Conversa arquivada',
    EXPORTED: 'Conversa exportada',
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-2 w-2 mt-2 rounded-full bg-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{eventLabels[event.type] || event.type}</p>
        {event.actor && (
          <p className="text-xs text-muted-foreground">
            por {event.actor.name || event.actor.email}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {format(new Date(event.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  )
}

export default function ConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  const { conversation, stats, isLoading, isError, mutate: mutateConversation } = useConversation(conversationId)
  const { messages, isLoading: isLoadingMessages, hasMore, loadMore, mutate: mutateMessages } = useConversationMessages(conversationId)
  const { updateConversation, isUpdating } = useUpdateConversation(conversationId)
  const { sendMessage, isSending } = useSendMessage(conversationId)
  const { addNote, isAdding: isAddingNote } = useAddNote(conversationId)
  const { updateTag, isUpdating: isUpdatingTag } = useUpdateTag(conversationId)

  const [messageInput, setMessageInput] = React.useState('')
  const [noteInput, setNoteInput] = React.useState('')
  const [tagInput, setTagInput] = React.useState('')
  const [showNoteDialog, setShowNoteDialog] = React.useState(false)
  const [showTagDialog, setShowTagDialog] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const messagesContainerRef = React.useRef<HTMLDivElement>(null)

  // Group messages by sender
  const messageGroups = React.useMemo(() => {
    return groupMessagesBySender(messages)
  }, [messages])

  // Scroll to bottom on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return
    
    try {
      await sendMessage({ content: messageInput.trim() })
      setMessageInput('')
      mutateMessages()
      mutateConversation()
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleAddNote = async () => {
    if (!noteInput.trim() || isAddingNote) return
    
    try {
      await addNote({ content: noteInput.trim() })
      setNoteInput('')
      setShowNoteDialog(false)
      mutateConversation()
    } catch (error) {
      console.error('Failed to add note:', error)
    }
  }

  const handleAddTag = async () => {
    if (!tagInput.trim() || isUpdatingTag) return
    
    try {
      await updateTag({ tag: tagInput.trim(), action: 'add' })
      setTagInput('')
      setShowTagDialog(false)
      mutateConversation()
    } catch (error) {
      console.error('Failed to add tag:', error)
    }
  }

  const handleRemoveTag = async (tag: string) => {
    try {
      await updateTag({ tag, action: 'remove' })
      mutateConversation()
    } catch (error) {
      console.error('Failed to remove tag:', error)
    }
  }

  const handleResolve = async () => {
    try {
      await updateConversation({ status: 'RESOLVED' })
      mutateConversation()
    } catch (error) {
      console.error('Failed to resolve:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (isError || !conversation) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Conversa não encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A conversa solicitada não existe ou foi removida.
        </p>
        <Button onClick={() => router.push('/dashboard/conversations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para conversas
        </Button>
      </div>
    )
  }

  const status = statusConfig[conversation.status]

  return (
    <div className="h-[calc(100vh-theme(spacing.32))] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/conversations')}
            aria-label="Voltar para conversas"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
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
            
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                {conversation.contactName || conversation.contactId}
                <Badge className={cn("text-xs", status.color, status.bgColor)} variant="outline">
                  {status.label}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                {conversation.channel?.name || 'Canal desconhecido'}
                {conversation.subject && ` • ${conversation.subject}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              mutateConversation()
              mutateMessages()
            }}
            aria-label="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {conversation.status !== 'RESOLVED' && (
            <Button
              size="sm"
              onClick={handleResolve}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolver
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Messages area */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            {/* Messages container */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Load more button */}
              {hasMore && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadMore()}
                    disabled={isLoadingMessages}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Carregar mensagens anteriores
                  </Button>
                </div>
              )}

              {/* Messages */}
              {messageGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1">
                  {group.map((message, msgIdx) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      showAvatar={msgIdx === 0}
                      isGrouped={msgIdx > 0}
                    />
                  ))}
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  disabled={isSending}
                  className="flex-1"
                  aria-label="Mensagem"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                  aria-label="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 overflow-y-auto">
          {/* Stats */}
          {stats && <ConversationStats stats={stats} />}

          {/* Tags */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
                <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Tag</DialogTitle>
                      <DialogDescription>
                        Digite o nome da tag para adicionar à conversa.
                      </DialogDescription>
                    </DialogHeader>
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Nome da tag"
                      aria-label="Nome da tag"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowTagDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddTag} disabled={!tagInput.trim() || isUpdatingTag}>
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {conversation.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {conversation.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        aria-label={`Remover tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tag</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notas Internas
                </CardTitle>
                <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Nota</DialogTitle>
                      <DialogDescription>
                        Notas internas são visíveis apenas para a equipe.
                      </DialogDescription>
                    </DialogHeader>
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Digite sua nota..."
                      className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      aria-label="Conteúdo da nota"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleAddNote} disabled={!noteInput.trim() || isAddingNote}>
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {conversation.notes && conversation.notes.length > 0 ? (
                <div className="space-y-3">
                  {conversation.notes.map((note) => (
                    <div key={note.id} className="text-sm border-l-2 border-muted pl-3">
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.author?.name || 'Anônimo'} • {format(new Date(note.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma nota</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversation.events && conversation.events.length > 0 ? (
                <div className="space-y-1">
                  {conversation.events.slice(0, 10).map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum evento</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
