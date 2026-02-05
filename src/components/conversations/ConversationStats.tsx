"use client"

import * as React from "react"
import { format, formatDuration, intervalToDuration } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  MessageSquare,
  Clock,
  User,
  Bot,
  Headphones,
  Calendar,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ConversationStats as StatsType, MessageRole } from "@/types"

interface ConversationStatsProps {
  stats: StatsType
  className?: string
}

const roleConfig: Record<MessageRole, { label: string; Icon: React.ElementType; color: string }> = {
  USER: { label: 'Usuário', Icon: User, color: 'text-gray-600' },
  BOT: { label: 'Bot', Icon: Bot, color: 'text-primary' },
  OPERATOR: { label: 'Operador', Icon: Headphones, color: 'text-blue-500' },
  SYSTEM: { label: 'Sistema', Icon: MessageSquare, color: 'text-muted-foreground' },
}

function formatDurationFromSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 })
  
  return formatDuration(duration, {
    format: ['days', 'hours', 'minutes'],
    locale: ptBR,
    delimiter: ', ',
  }) || '< 1 min'
}

function StatItem({
  icon: Icon,
  label,
  value,
  subValue,
  className,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  )
}

export function ConversationStats({ stats, className }: ConversationStatsProps) {
  const totalMessages = stats.messageCount
  const userMessages = stats.messagesByRole.USER || 0
  const botMessages = stats.messagesByRole.BOT || 0
  const operatorMessages = stats.messagesByRole.OPERATOR || 0

  // Calculate response ratio (bot + operator responses per user message)
  const responseRatio = userMessages > 0 
    ? ((botMessages + operatorMessages) / userMessages).toFixed(1)
    : '0'

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Estatísticas da Conversa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            icon={MessageSquare}
            label="Total de mensagens"
            value={totalMessages}
          />
          <StatItem
            icon={Clock}
            label="Duração"
            value={formatDurationFromSeconds(stats.durationSeconds)}
          />
        </div>

        {/* Timeline */}
        {stats.firstMessageAt && stats.lastMessageAt && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span>Período</span>
            </div>
            <div className="flex justify-between text-xs">
              <div>
                <p className="font-medium">Início</p>
                <p className="text-muted-foreground">
                  {format(new Date(stats.firstMessageAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">Última msg</p>
                <p className="text-muted-foreground">
                  {format(new Date(stats.lastMessageAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages by role */}
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground mb-3">Mensagens por tipo</p>
          <div className="space-y-2">
            {Object.entries(stats.messagesByRole).map(([role, count]) => {
              const config = roleConfig[role as MessageRole]
              if (!config || count === 0) return null
              
              const percentage = totalMessages > 0 ? (count / totalMessages) * 100 : 0
              
              return (
                <div key={role} className="flex items-center gap-2">
                  <config.Icon className={cn("h-4 w-4", config.color)} />
                  <span className="text-sm flex-1">{config.label}</span>
                  <span className="text-sm font-medium">{count}</span>
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        role === 'USER' && "bg-gray-400",
                        role === 'BOT' && "bg-primary",
                        role === 'OPERATOR' && "bg-blue-500",
                        role === 'SYSTEM' && "bg-muted-foreground"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Response ratio */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Taxa de resposta</span>
            <span className="text-sm font-medium">{responseRatio} respostas/msg</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for inline display
export function ConversationStatsCompact({ stats, className }: ConversationStatsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4 text-sm text-muted-foreground", className)}>
      <span className="flex items-center gap-1">
        <MessageSquare className="h-4 w-4" />
        {stats.messageCount} mensagens
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-4 w-4" />
        {formatDurationFromSeconds(stats.durationSeconds)}
      </span>
      {stats.messagesByRole.USER && (
        <span className="flex items-center gap-1">
          <User className="h-4 w-4" />
          {stats.messagesByRole.USER} do usuário
        </span>
      )}
      {stats.messagesByRole.BOT && (
        <span className="flex items-center gap-1">
          <Bot className="h-4 w-4" />
          {stats.messagesByRole.BOT} do bot
        </span>
      )}
      {stats.messagesByRole.OPERATOR && (
        <span className="flex items-center gap-1">
          <Headphones className="h-4 w-4" />
          {stats.messagesByRole.OPERATOR} do operador
        </span>
      )}
    </div>
  )
}
