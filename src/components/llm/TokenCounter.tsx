"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Coins, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TokenCounterProps {
  tokens: number
  showCost?: boolean
  costPerMillion?: number  // USD per 1M tokens
  currency?: string
  size?: "sm" | "md" | "lg"
  trend?: number  // percentage change (positive = up, negative = down)
  showIcon?: boolean
  className?: string
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl font-bold",
}

const iconSizes = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
}

/**
 * Formats large token numbers into human-readable format
 * e.g., 1234567 -> "1.2M", 50000 -> "50K"
 */
export function formatTokens(tokens: number, decimals: number = 1): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(decimals)}B`
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(decimals)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(decimals)}K`
  }
  return tokens.toLocaleString()
}

/**
 * Calculates cost based on tokens and price per million
 */
export function calculateCost(tokens: number, costPerMillion: number): number {
  return (tokens / 1_000_000) * costPerMillion
}

/**
 * Formats currency value
 */
export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

export function TokenCounter({
  tokens,
  showCost = false,
  costPerMillion = 0,
  currency = "USD",
  size = "md",
  trend,
  showIcon = false,
  className,
}: TokenCounterProps) {
  const cost = showCost && costPerMillion > 0 ? calculateCost(tokens, costPerMillion) : null

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {showIcon && (
        <Coins className={cn(iconSizes[size], "text-muted-foreground")} aria-hidden="true" />
      )}
      <div className="flex flex-col">
        <span className={cn(sizeClasses[size], "font-mono tabular-nums")}>
          {formatTokens(tokens)}
          <span className="text-muted-foreground ml-0.5 text-xs font-normal">tokens</span>
        </span>
        {cost !== null && (
          <span className="text-xs text-muted-foreground">
            ≈ {formatCurrency(cost, currency)}
          </span>
        )}
      </div>
      {trend !== undefined && trend !== 0 && (
        <div
          className={cn(
            "flex items-center gap-0.5 text-xs",
            trend > 0 ? "text-red-500" : "text-green-500"
          )}
          aria-label={`${trend > 0 ? "Aumento" : "Redução"} de ${Math.abs(trend)}%`}
        >
          <TrendIcon className="h-3 w-3" aria-hidden="true" />
          <span>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

// Compact inline version
export function TokenCounterInline({
  tokens,
  showCost = false,
  costPerMillion = 0,
  currency = "USD",
  className,
}: Pick<TokenCounterProps, "tokens" | "showCost" | "costPerMillion" | "currency" | "className">) {
  const cost = showCost && costPerMillion > 0 ? calculateCost(tokens, costPerMillion) : null

  return (
    <span className={cn("font-mono tabular-nums text-sm", className)}>
      {formatTokens(tokens)}
      {cost !== null && (
        <span className="text-muted-foreground ml-1">
          ({formatCurrency(cost, currency)})
        </span>
      )}
    </span>
  )
}

// Stat card version with breakdown
export function TokenCounterStat({
  label,
  tokens,
  inputTokens,
  outputTokens,
  costPerMillionInput = 0,
  costPerMillionOutput = 0,
  currency = "USD",
  className,
}: {
  label: string
  tokens: number
  inputTokens?: number
  outputTokens?: number
  costPerMillionInput?: number
  costPerMillionOutput?: number
  currency?: string
  className?: string
}) {
  const totalCost = 
    (inputTokens ? calculateCost(inputTokens, costPerMillionInput) : 0) +
    (outputTokens ? calculateCost(outputTokens, costPerMillionOutput) : 0)

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold font-mono tabular-nums">{formatTokens(tokens)}</p>
      {(inputTokens !== undefined || outputTokens !== undefined) && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          {inputTokens !== undefined && (
            <span>
              <span className="text-blue-500">↓</span> {formatTokens(inputTokens)} in
            </span>
          )}
          {outputTokens !== undefined && (
            <span>
              <span className="text-green-500">↑</span> {formatTokens(outputTokens)} out
            </span>
          )}
        </div>
      )}
      {totalCost > 0 && (
        <p className="text-sm font-medium">
          ≈ {formatCurrency(totalCost, currency)}
        </p>
      )}
    </div>
  )
}
