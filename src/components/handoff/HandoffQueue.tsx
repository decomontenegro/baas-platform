'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  User,
  AlertTriangle,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { HandoffRequest, HandoffQueueStats } from '@/types/handoff'
import {
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  reasonLabels,
} from '@/types/handoff'

interface HandoffQueueProps {
  requests: HandoffRequest[]
  stats: HandoffQueueStats
  isLoading: boolean
  onSelectRequest: (request: HandoffRequest) => void
  onRefresh: () => void
  selectedId?: string
}

export function HandoffQueue({
  requests,
  stats,
  isLoading,
  onSelectRequest,
  onRefresh,
  selectedId,
}: HandoffQueueProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
        <StatBadge
          label="Pendentes"
          value={stats.pending}
          color="bg-yellow-500"
        />
        <StatBadge
          label="Em atendimento"
          value={stats.inProgress}
          color="bg-green-500"
        />
        <StatBadge
          label="Em espera"
          value={stats.onHold}
          color="bg-orange-500"
        />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Atualizar fila"
        >
          <RefreshCw
            className={cn('h-4 w-4', isLoading && 'animate-spin')}
          />
        </Button>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {requests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center p-8"
            >
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Fila vazia</h3>
              <p className="text-muted-foreground">
                Nenhum atendimento pendente no momento
              </p>
            </motion.div>
          ) : (
            requests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <QueueItem
                  request={request}
                  isSelected={selectedId === request.id}
                  onClick={() => onSelectRequest(request)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface StatBadgeProps {
  label: string
  value: number
  color: string
}

function StatBadge({ label, value, color }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

interface QueueItemProps {
  request: HandoffRequest
  isSelected: boolean
  onClick: () => void
}

function QueueItem({ request, isSelected, onClick }: QueueItemProps) {
  const isUrgent = request.priority === 'URGENT' || request.priority === 'HIGH'
  const isSlaBreached = request.slaBreached
  const slaRemaining = request.slaDeadline
    ? new Date(request.slaDeadline).getTime() - Date.now()
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 border-b transition-colors',
        'hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isSelected && 'bg-accent',
        isSlaBreached && 'bg-red-50 dark:bg-red-950/20'
      )}
      aria-current={isSelected ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {request.customerName || request.customerPhone || 'Cliente'}
            </span>
            {isUrgent && (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            )}
          </div>

          {/* Contact Info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
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
          </div>

          {/* Reason */}
          <p className="text-sm text-muted-foreground truncate">
            {request.reasonText || reasonLabels[request.reason]}
          </p>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                statusColors[request.status]
              )}
            >
              {statusLabels[request.status]}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                priorityColors[request.priority]
              )}
            >
              {priorityLabels[request.priority]}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(request.createdAt)}
          </span>
          
          {/* SLA indicator */}
          {slaRemaining !== null && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                slaRemaining > 0 && slaRemaining < 600000
                  ? 'text-orange-600'
                  : slaRemaining <= 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
              )}
            >
              <Clock className="h-3 w-3" />
              {slaRemaining > 0
                ? formatTimeRemaining(slaRemaining)
                : 'SLA expirado'}
            </span>
          )}

          {/* Assigned indicator */}
          {request.assignedTo && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              Atribuído
            </span>
          )}

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  )
}

function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) {
    return `${minutes}min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}min`
}

export default HandoffQueue
