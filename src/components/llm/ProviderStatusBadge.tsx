"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, XCircle, Clock, Loader2 } from "lucide-react"

export type ProviderStatus = "active" | "degraded" | "down" | "pending" | "disabled"

interface ProviderStatusBadgeProps {
  status: ProviderStatus
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
  className?: string
}

const statusConfig: Record<ProviderStatus, {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
  icon: React.ElementType
  dotColor: string
}> = {
  active: {
    label: "Ativo",
    variant: "success",
    icon: CheckCircle2,
    dotColor: "bg-green-500",
  },
  degraded: {
    label: "Degradado",
    variant: "warning",
    icon: AlertCircle,
    dotColor: "bg-yellow-500",
  },
  down: {
    label: "Offline",
    variant: "destructive",
    icon: XCircle,
    dotColor: "bg-red-500",
  },
  pending: {
    label: "Pendente",
    variant: "secondary",
    icon: Clock,
    dotColor: "bg-gray-400",
  },
  disabled: {
    label: "Desativado",
    variant: "outline",
    icon: Loader2,
    dotColor: "bg-gray-300",
  },
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
}

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

export function ProviderStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className,
}: ProviderStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn(sizeClasses[size], "gap-1.5", className)}
    >
      {showIcon && (
        <span
          className={cn("rounded-full animate-pulse", config.dotColor, {
            "h-1.5 w-1.5": size === "sm",
            "h-2 w-2": size === "md",
            "h-2.5 w-2.5": size === "lg",
          })}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </Badge>
  )
}

// Export for use with icon instead of dot
export function ProviderStatusBadgeWithIcon({
  status,
  size = "md",
  className,
}: Omit<ProviderStatusBadgeProps, "showIcon">) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn(sizeClasses[size], "gap-1.5", className)}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  )
}
