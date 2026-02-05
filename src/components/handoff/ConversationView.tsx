'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  User,
  Bot,
  Headphones,
  Clock,
  ArrowLeft,
  MoreVertical,
  Phone,
  Mail,
  Check,
  X,
  AlertTriangle,
  MessageSquare,
  StickyNote,
} from 'lucide-react'
import { cn, formatRelativeTime, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { HandoffRequest, HandoffNote, ConversationMessage } from '@/types/handoff'
import {
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  reasonLabels,
} from '@/types/handoff'

interface ConversationViewProps {
  request: HandoffRequest
  onBack: () => void
  onAssign: () => void
  onResolve: () => void
  onAddNote: (content: string, isInternal: boolean) => void
  onSendMessage: (content: string) => void
  currentUserId?: string
}

export function ConversationView({
  request,
  onBack,
  onAssign,
  onResolve,
  onAddNote,
  onSendMessage,
  currentUserId,
}: ConversationViewProps) {
  const [message, setMessage] = React.useState('')
  const [noteContent, setNoteContent] = React.useState('')
  const [showNoteInput, setShowNoteInput] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const isAssignedToMe = request.assignedTo === currentUserId
  const canTakeActions = isAssignedToMe || !request.assignedTo

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [request.conversationHistory])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleAddNote = () => {
    if (noteContent.trim()) {
      onAddNote(noteContent.trim(), true)
      setNoteContent('')
      setShowNoteInput(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Voltar para a fila"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">
              {request.customerName || 'Cliente'}
            </h2>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                statusColors[request.status]
              )}
            >
              {statusLabels[request.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {request.customerPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {request.customerPhone}
              </span>
            )}
            {request.customerEmail && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {request.customerEmail}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(request.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canTakeActions && request.status !== 'RESOLVED' && (
            <>
              {!request.assignedTo && (
                <Button variant="default" size="sm" onClick={onAssign}>
                  <User className="h-4 w-4 mr-2" />
                  Assumir
                </Button>
              )}
              {isAssignedToMe && (
                <Button variant="default" size="sm" onClick={onResolve}>
                  <Check className="h-4 w-4 mr-2" />
                  Resolver
                </Button>
              )}
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowNoteInput(true)}>
                <StickyNote className="h-4 w-4 mr-2" />
                Adicionar nota
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Cancelar atendimento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Request Info Banner */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <strong>Motivo:</strong> {request.reasonText || reasonLabels[request.reason]}
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            priorityColors[request.priority]
          )}
        >
          {priorityLabels[request.priority]}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Conversation History */}
        {request.conversationHistory.map((msg, index) => (
          <MessageBubble key={msg.id || index} message={msg} />
        ))}

        {/* Notes */}
        {request.notes && request.notes.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notas Internas
            </h4>
            <div className="space-y-2">
              {request.notes.map((note) => (
                <NoteItem key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Note Input */}
      {showNoteInput && (
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-start gap-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Adicionar nota interna..."
              className="flex-1 min-h-[80px] p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={!noteContent.trim()}>
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNoteInput(false)
                  setNoteContent('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      {isAssignedToMe && request.status !== 'RESOLVED' && (
        <form onSubmit={handleSendMessage} className="p-4 border-t bg-card">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 min-h-[44px] max-h-[120px] p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
            />
            <Button
              type="submit"
              disabled={!message.trim()}
              aria-label="Enviar mensagem"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

interface MessageBubbleProps {
  message: ConversationMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isCustomer = message.role === 'customer'
  const isAgent = message.role === 'agent'
  const isBot = message.role === 'bot'

  const Icon = isCustomer ? User : isAgent ? Headphones : Bot

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3',
        isCustomer ? 'justify-start' : 'justify-end'
      )}
    >
      {isCustomer && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2',
          isCustomer
            ? 'bg-muted rounded-tl-none'
            : isAgent
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-tr-none'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <span
          className={cn(
            'text-xs mt-1 block',
            isCustomer
              ? 'text-muted-foreground'
              : isAgent
              ? 'text-primary-foreground/70'
              : 'text-blue-600 dark:text-blue-300'
          )}
        >
          {formatDate(message.timestamp, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {!isCustomer && (
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
            isAgent
              ? 'bg-primary text-primary-foreground'
              : 'bg-blue-100 dark:bg-blue-900'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              isAgent
                ? 'text-primary-foreground'
                : 'text-blue-600 dark:text-blue-300'
            )}
          />
        </div>
      )}
    </motion.div>
  )
}

interface NoteItemProps {
  note: HandoffNote
}

function NoteItem({ note }: NoteItemProps) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
          {note.authorName || 'Agente'}
        </span>
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          {formatRelativeTime(note.createdAt)}
        </span>
      </div>
      <p className="text-sm text-yellow-900 dark:text-yellow-100">
        {note.content}
      </p>
    </div>
  )
}

export default ConversationView
