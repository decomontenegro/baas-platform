"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  BellOff,
  Check,
  X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

export type AlertSeverity = "critical" | "warning" | "info" | "success"
export type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed"

export interface Alert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  status: AlertStatus
  type: string
  createdAt: Date | string
  acknowledgedAt?: Date | string
  resolvedAt?: Date | string
  metadata?: Record<string, unknown>
}

interface AlertCardProps {
  alert: Alert
  onAcknowledge?: (id: string) => void
  onDismiss?: (id: string) => void
  onResolve?: (id: string) => void
  onView?: (id: string) => void
  compact?: boolean
  className?: string
}

const severityConfig: Record<AlertSeverity, {
  icon: React.ElementType
  bgClass: string
  borderClass: string
  iconClass: string
  badgeVariant: "destructive" | "warning" | "default" | "success"
}> = {
  critical: {
    icon: XCircle,
    bgClass: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-red-200 dark:border-red-900",
    iconClass: "text-red-600",
    badgeVariant: "destructive",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20",
    borderClass: "border-yellow-200 dark:border-yellow-900",
    iconClass: "text-yellow-600",
    badgeVariant: "warning",
  },
  info: {
    icon: Info,
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
    borderClass: "border-blue-200 dark:border-blue-900",
    iconClass: "text-blue-600",
    badgeVariant: "default",
  },
  success: {
    icon: CheckCircle2,
    bgClass: "bg-green-50 dark:bg-green-950/20",
    borderClass: "border-green-200 dark:border-green-900",
    iconClass: "text-green-600",
    badgeVariant: "success",
  },
}

const statusLabels: Record<AlertStatus, string> = {
  active: "Ativo",
  acknowledged: "Reconhecido",
  resolved: "Resolvido",
  dismissed: "Dispensado",
}

export function AlertCard({
  alert,
  onAcknowledge,
  onDismiss,
  onResolve,
  onView,
  compact = false,
  className,
}: AlertCardProps) {
  const config = severityConfig[alert.severity]
  const Icon = config.icon
  const createdAt = typeof alert.createdAt === "string" ? new Date(alert.createdAt) : alert.createdAt

  const timeAgo = formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: ptBR,
  })

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border",
          config.bgClass,
          config.borderClass,
          className
        )}
        role="alert"
      >
        <Icon className={cn("h-5 w-5 shrink-0", config.iconClass)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{alert.title}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {alert.status === "active" && onAcknowledge && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAcknowledge(alert.id)}
            aria-label="Reconhecer alerta"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border",
        config.borderClass,
        alert.status !== "active" && "opacity-75",
        className
      )}
      role="alert"
    >
      <CardHeader className={cn("py-3 px-4", config.bgClass)}>
        <div className="flex items-start gap-3">
          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconClass)} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold">{alert.title}</h4>
              <Badge variant={config.badgeVariant} className="text-xs">
                {alert.severity === "critical" ? "Crítico" : 
                 alert.severity === "warning" ? "Atenção" :
                 alert.severity === "info" ? "Info" : "Sucesso"}
              </Badge>
              {alert.status !== "active" && (
                <Badge variant="outline" className="text-xs">
                  {statusLabels[alert.status]}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>{timeAgo}</span>
              {alert.type && (
                <>
                  <span>•</span>
                  <span>{alert.type}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-3 px-4">
        <p className="text-sm text-muted-foreground">{alert.message}</p>
      </CardContent>

      {(onAcknowledge || onDismiss || onResolve || onView) && alert.status === "active" && (
        <CardFooter className="py-2 px-4 bg-muted/30 gap-2">
          {onAcknowledge && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcknowledge(alert.id)}
              className="gap-1.5"
            >
              <Bell className="h-3.5 w-3.5" />
              Reconhecer
            </Button>
          )}
          {onResolve && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResolve(alert.id)}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resolver
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
              className="gap-1.5 text-muted-foreground"
            >
              <BellOff className="h-3.5 w-3.5" />
              Dispensar
            </Button>
          )}
          {onView && (
            <Button
              variant="link"
              size="sm"
              onClick={() => onView(alert.id)}
              className="ml-auto"
            >
              Ver detalhes
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

// List version for sidebars/dropdowns
export function AlertCardMini({
  alert,
  onClick,
  className,
}: {
  alert: Alert
  onClick?: () => void
  className?: string
}) {
  const config = severityConfig[alert.severity]
  const Icon = config.icon
  const createdAt = typeof alert.createdAt === "string" ? new Date(alert.createdAt) : alert.createdAt

  return (
    <button
      className={cn(
        "w-full flex items-start gap-2 p-2 rounded-md text-left transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onClick}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.iconClass)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{alert.title}</p>
        <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </button>
  )
}
