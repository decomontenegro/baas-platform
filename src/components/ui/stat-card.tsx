'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { Sparkline } from './sparkline'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: number
  sparklineData?: number[]
  color?: 'blue' | 'green' | 'purple' | 'orange'
  delay?: number
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400',
    sparkline: '#3b82f6',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'text-green-600 dark:text-green-400',
    sparkline: '#22c55e',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    icon: 'text-purple-600 dark:text-purple-400',
    sparkline: '#a855f7',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    icon: 'text-orange-600 dark:text-orange-400',
    sparkline: '#f97316',
  },
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  sparklineData,
  color = 'blue',
  delay = 0,
}: StatCardProps) {
  const styles = colorStyles[color]
  const displayValue = typeof value === 'number' ? formatNumber(value) : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-lg', styles.bg)}>
          <Icon className={cn('w-6 h-6', styles.icon)} />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              'text-sm font-medium',
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
            )}
          >
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
        <p className="text-3xl font-bold tracking-tight">{displayValue}</p>
      </div>
      
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4">
          <Sparkline data={sparklineData} color={styles.sparkline} />
        </div>
      )}
    </motion.div>
  )
}
