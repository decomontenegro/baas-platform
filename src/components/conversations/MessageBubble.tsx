"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  User,
  Bot,
  Headphones,
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  File,
  Image,
  PlayCircle,
  Mic,
  MapPin,
  Contact,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConversationMessage, MessageRole, MessageContentType, MessageAttachment } from "@/types"

interface MessageBubbleProps {
  message: ConversationMessage
  showAvatar?: boolean
  isGrouped?: boolean
  className?: string
}

const roleConfig: Record<MessageRole, {
  label: string
  bgColor: string
  textColor: string
  align: 'left' | 'right'
  Icon: React.ElementType
}> = {
  USER: {
    label: 'Usuário',
    bgColor: 'bg-muted',
    textColor: 'text-foreground',
    align: 'left',
    Icon: User,
  },
  BOT: {
    label: 'Bot',
    bgColor: 'bg-primary',
    textColor: 'text-primary-foreground',
    align: 'right',
    Icon: Bot,
  },
  OPERATOR: {
    label: 'Operador',
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
    align: 'right',
    Icon: Headphones,
  },
  SYSTEM: {
    label: 'Sistema',
    bgColor: 'bg-transparent',
    textColor: 'text-muted-foreground',
    align: 'left',
    Icon: AlertCircle,
  },
}

const statusIcons = {
  PENDING: Clock,
  SENT: Check,
  DELIVERED: CheckCheck,
  READ: CheckCheck,
  FAILED: AlertCircle,
}

function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  const isImage = attachment.mimeType?.startsWith('image/') || attachment.type === 'image'
  const isVideo = attachment.mimeType?.startsWith('video/') || attachment.type === 'video'
  const isAudio = attachment.mimeType?.startsWith('audio/') || attachment.type === 'audio'

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden max-w-xs hover:opacity-90 transition-opacity"
      >
        <img
          src={attachment.url}
          alt={attachment.filename || 'Imagem'}
          className="w-full h-auto max-h-64 object-cover"
          loading="lazy"
        />
      </a>
    )
  }

  if (isVideo) {
    return (
      <video
        src={attachment.url}
        controls
        className="w-full max-w-xs rounded-lg"
        preload="metadata"
      >
        <track kind="captions" />
        Seu navegador não suporta vídeos.
      </video>
    )
  }

  if (isAudio) {
    return (
      <audio
        src={attachment.url}
        controls
        className="w-full max-w-xs"
        preload="metadata"
      >
        Seu navegador não suporta áudios.
      </audio>
    )
  }

  // Generic file
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.filename}
      className="flex items-center gap-2 p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors max-w-xs"
    >
      <File className="h-8 w-8 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {attachment.filename || 'Arquivo'}
        </p>
        {attachment.size && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </p>
        )}
      </div>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ContentTypeIcon({ type }: { type: MessageContentType }) {
  const icons: Partial<Record<MessageContentType, React.ElementType>> = {
    IMAGE: Image,
    AUDIO: Mic,
    VIDEO: PlayCircle,
    DOCUMENT: File,
    LOCATION: MapPin,
    CONTACT: Contact,
  }
  
  const Icon = icons[type]
  if (!Icon) return null
  
  return <Icon className="h-4 w-4 inline-block mr-1" />
}

export function MessageBubble({
  message,
  showAvatar = true,
  isGrouped = false,
  className,
}: MessageBubbleProps) {
  const config = roleConfig[message.role]
  const StatusIcon = statusIcons[message.status]
  const isRightAligned = config.align === 'right'
  const isSystem = message.role === 'SYSTEM'

  // System messages have a different layout
  if (isSystem) {
    return (
      <div className={cn("flex justify-center py-2", className)}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <AlertCircle className="h-3 w-3" />
          <span>{message.content}</span>
          <span className="opacity-70">
            {format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        isRightAligned ? "flex-row-reverse" : "flex-row",
        isGrouped && !showAvatar ? (isRightAligned ? "pr-10" : "pl-10") : "",
        className
      )}
    >
      {/* Avatar */}
      {showAvatar && (
        <div
          className={cn(
            "shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
            message.sender?.image ? "" : config.bgColor
          )}
        >
          {message.sender?.image ? (
            <img
              src={message.sender.image}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <config.Icon className={cn("h-4 w-4", config.textColor)} />
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] flex flex-col gap-1",
          isRightAligned ? "items-end" : "items-start"
        )}
      >
        {/* Sender name (if not grouped) */}
        {!isGrouped && (
          <span className="text-xs text-muted-foreground px-1">
            {message.senderName || message.sender?.name || config.label}
          </span>
        )}

        {/* Message content */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 break-words",
            config.bgColor,
            config.textColor,
            isRightAligned ? "rounded-tr-sm" : "rounded-tl-sm"
          )}
        >
          {/* Content type indicator */}
          {message.contentType !== 'TEXT' && message.contentType !== 'SYSTEM' && (
            <ContentTypeIcon type={message.contentType} />
          )}
          
          {/* Text content */}
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment, idx) => (
                <AttachmentPreview key={idx} attachment={attachment} />
              ))}
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-1 text-xs text-muted-foreground",
            isRightAligned ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span>
            {format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })}
          </span>
          
          {/* Status indicator (for outgoing messages) */}
          {isRightAligned && StatusIcon && (
            <StatusIcon
              className={cn(
                "h-3.5 w-3.5",
                message.status === 'READ' && "text-blue-500",
                message.status === 'FAILED' && "text-destructive"
              )}
            />
          )}
          
          {/* AI metadata indicator */}
          {message.aiMetadata && (
            <span className="text-[10px] opacity-70">
              • {(message.aiMetadata as any).model || 'AI'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper component to group messages from the same sender
export function MessageGroup({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) return null

  return (
    <div className="space-y-1">
      {messages.map((message, idx) => (
        <MessageBubble
          key={message.id}
          message={message}
          showAvatar={idx === 0}
          isGrouped={idx > 0}
        />
      ))}
    </div>
  )
}

// Group messages by sender for cleaner display
export function groupMessagesBySender(messages: ConversationMessage[]): ConversationMessage[][] {
  const groups: ConversationMessage[][] = []
  let currentGroup: ConversationMessage[] = []
  let lastRole: MessageRole | null = null
  let lastSenderId: string | null = null

  for (const message of messages) {
    const shouldGroup =
      message.role === lastRole &&
      message.senderId === lastSenderId &&
      message.role !== 'SYSTEM'

    if (shouldGroup) {
      currentGroup.push(message)
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
      }
      currentGroup = [message]
      lastRole = message.role
      lastSenderId = message.senderId
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}
