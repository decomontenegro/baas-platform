"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface UsageProgressBarProps {
  current: number
  limit: number
  thresholds?: {
    warning?: number  // percentage (default: 70)
    danger?: number   // percentage (default: 90)
  }
  showLabel?: boolean
  showPercentage?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  formatValue?: (value: number) => string
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
}

export function UsageProgressBar({
  current,
  limit,
  thresholds = {},
  showLabel = true,
  showPercentage = true,
  size = "md",
  className,
  formatValue,
}: UsageProgressBarProps) {
  const warningThreshold = thresholds.warning ?? 70
  const dangerThreshold = thresholds.danger ?? 90

  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isOverLimit = current > limit

  // Determine color based on thresholds
  const getColorClass = () => {
    if (isOverLimit) return "bg-red-600"
    if (percentage >= dangerThreshold) return "bg-red-500"
    if (percentage >= warningThreshold) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getTextColorClass = () => {
    if (isOverLimit) return "text-red-600"
    if (percentage >= dangerThreshold) return "text-red-500"
    if (percentage >= warningThreshold) return "text-yellow-600"
    return "text-muted-foreground"
  }

  const formatNumber = formatValue || ((val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
    return val.toString()
  })

  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className={cn("font-medium", getTextColorClass())}>
            {formatNumber(current)} / {formatNumber(limit)}
          </span>
          {showPercentage && (
            <span className={cn("text-xs", getTextColorClass())}>
              {isOverLimit ? (
                <span className="font-semibold">
                  +{((current - limit) / limit * 100).toFixed(0)}% over
                </span>
              ) : (
                `${percentage.toFixed(0)}%`
              )}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={Math.min(current, limit)}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${formatNumber(current)} de ${formatNumber(limit)} utilizado`}
      >
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            getColorClass()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {isOverLimit && (
          <div
            className="absolute inset-0 bg-red-500/20 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

// Compact version for tables/cards
export function UsageProgressBarCompact({
  current,
  limit,
  thresholds = {},
  className,
}: Pick<UsageProgressBarProps, "current" | "limit" | "thresholds" | "className">) {
  const warningThreshold = thresholds.warning ?? 70
  const dangerThreshold = thresholds.danger ?? 90
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0

  const getColorClass = () => {
    if (current > limit) return "bg-red-500"
    if (percentage >= dangerThreshold) return "bg-red-500"
    if (percentage >= warningThreshold) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div
      className={cn("h-1.5 w-16 rounded-full bg-secondary overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full transition-all", getColorClass())}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  )
}
