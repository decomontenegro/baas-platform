import * as React from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface EnhancedSkeletonProps {
  className?: string
  children?: React.ReactNode
  isLoading?: boolean
  variant?: 'pulse' | 'shimmer' | 'wave'
}

export function EnhancedSkeleton({ 
  className, 
  children, 
  isLoading = true,
  variant = 'pulse'
}: EnhancedSkeletonProps) {
  if (!isLoading) {
    return <>{children}</>
  }

  const variants = {
    pulse: 'animate-pulse',
    shimmer: 'animate-shimmer',
    wave: 'animate-wave'
  }

  return (
    <Skeleton 
      className={cn(
        variants[variant],
        className
      )} 
    />
  )
}

// Dashboard Overview Skeletons
export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 border rounded-lg space-y-2">
          <EnhancedSkeleton className="h-4 w-24" />
          <EnhancedSkeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

// LLM Usage Page Skeleton
export function LLMUsageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <EnhancedSkeleton className="h-8 w-48" />
        <EnhancedSkeleton className="h-4 w-72" />
      </div>
      
      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-6">
          <EnhancedSkeleton className="h-6 w-32 mb-4" />
          <EnhancedSkeleton className="h-64 w-full" />
        </div>
        <div className="border rounded-lg p-6">
          <EnhancedSkeleton className="h-6 w-40 mb-4" />
          <EnhancedSkeleton className="h-64 w-full" />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <EnhancedSkeleton className="h-6 w-48" />
        </div>
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex justify-between">
              <EnhancedSkeleton className="h-4 w-32" />
              <EnhancedSkeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Governance Audit Skeleton
export function GovernanceAuditSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex gap-4 items-center p-4 border rounded-lg">
        <EnhancedSkeleton className="h-9 w-32" />
        <EnhancedSkeleton className="h-9 w-40" />
        <EnhancedSkeleton className="h-9 w-28" />
      </div>

      {/* Audit entries */}
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <EnhancedSkeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <EnhancedSkeleton className="h-4 w-48" />
                <EnhancedSkeleton className="h-3 w-32" />
              </div>
            </div>
            <EnhancedSkeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Enhanced Loading Overlay
export function LoadingOverlay({ 
  isLoading, 
  children, 
  message = "Carregando..."
}: {
  isLoading: boolean
  children: React.ReactNode
  message?: string
}) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}