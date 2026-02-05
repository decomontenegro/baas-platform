'use client'

import { formatDistanceToNow } from 'date-fns'
import { 
  UserPlus, 
  Clock, 
  AlertTriangle, 
  BarChart, 
  MessageCircle, 
  AtSign, 
  FileText, 
  Bell,
  Check,
} from 'lucide-react'
import { NotificationType, NOTIFICATION_TYPE_META } from '@/types/notification'

interface NotificationItemProps {
  id: string
  type: NotificationType
  title: string
  body?: string | null
  read: boolean
  createdAt: Date | string
  onMarkAsRead?: (id: string) => void
  onClick?: (id: string) => void
}

const iconMap: Record<NotificationType, React.ReactNode> = {
  HANDOFF_REQUESTED: <UserPlus className="w-4 h-4" />,
  HANDOFF_TIMEOUT: <Clock className="w-4 h-4" />,
  BOT_ERROR: <AlertTriangle className="w-4 h-4" />,
  USAGE_ALERT: <BarChart className="w-4 h-4" />,
  NEW_CONVERSATION: <MessageCircle className="w-4 h-4" />,
  MENTION: <AtSign className="w-4 h-4" />,
  DAILY_SUMMARY: <FileText className="w-4 h-4" />,
  SYSTEM: <Bell className="w-4 h-4" />,
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500',
  orange: 'bg-orange-500/10 text-orange-500',
  red: 'bg-red-500/10 text-red-500',
  yellow: 'bg-yellow-500/10 text-yellow-500',
  green: 'bg-green-500/10 text-green-500',
  purple: 'bg-purple-500/10 text-purple-500',
  gray: 'bg-gray-500/10 text-gray-500',
}

export function NotificationItem({
  id,
  type,
  title,
  body,
  read,
  createdAt,
  onMarkAsRead,
  onClick,
}: NotificationItemProps) {
  const meta = NOTIFICATION_TYPE_META[type]
  const icon = iconMap[type]
  const colorClass = colorMap[meta.color] || colorMap.gray
  
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true })

  const handleClick = () => {
    if (!read && onMarkAsRead) {
      onMarkAsRead(id)
    }
    if (onClick) {
      onClick(id)
    }
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 cursor-pointer transition-colors
        hover:bg-[var(--muted)]
        ${read ? 'opacity-60' : 'bg-[var(--muted)]/30'}
      `}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 p-2 rounded-lg ${colorClass}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-[var(--foreground)] line-clamp-1">
            {title}
          </h4>
          {!read && (
            <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-primary-500 rounded-full" />
          )}
        </div>
        
        {body && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">
            {body}
          </p>
        )}
        
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-[var(--muted-foreground)]">
            {timeAgo}
          </span>
          
          {!read && onMarkAsRead && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMarkAsRead(id)
              }}
              className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600"
            >
              <Check className="w-3 h-3" />
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
