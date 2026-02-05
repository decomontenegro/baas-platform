'use client'

import { motion } from 'framer-motion'
import { Star, Users, ArrowRight, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Template } from '@/types/templates'

interface TemplateCardProps {
  template: Template
  isSelected?: boolean
  onClick?: () => void
  onPreview?: () => void
  onUse?: () => void
  compact?: boolean
}

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  green: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  teal: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800',
  indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800',
  amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
}

const gradientClasses: Record<string, string> = {
  blue: 'from-blue-500 to-blue-600',
  purple: 'from-purple-500 to-purple-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
  teal: 'from-teal-500 to-teal-600',
  indigo: 'from-indigo-500 to-indigo-600',
  amber: 'from-amber-500 to-amber-600',
}

export function TemplateCard({
  template,
  isSelected,
  onClick,
  onPreview,
  onUse,
  compact = false,
}: TemplateCardProps) {
  if (compact) {
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'w-full p-4 rounded-xl border-2 text-left transition-all',
          isSelected
            ? 'border-primary bg-primary/5 shadow-md'
            : 'border-border hover:border-primary/50 hover:shadow-sm'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{template.icon}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{template.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {template.description}
            </p>
          </div>
          {isSelected && (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
              <Check className="w-3 h-3" />
            </div>
          )}
        </div>
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={cn(
        'group relative rounded-2xl border-2 overflow-hidden transition-all cursor-pointer',
        isSelected
          ? 'border-primary shadow-lg ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50 hover:shadow-lg'
      )}
      onClick={onClick}
    >
      {/* Header with gradient */}
      <div
        className={cn(
          'relative h-24 bg-gradient-to-br flex items-center justify-center',
          gradientClasses[template.color] || gradientClasses.blue
        )}
      >
        <span className="text-5xl drop-shadow-lg">{template.icon}</span>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {template.isOfficial && (
            <Badge variant="secondary" className="bg-white/90 text-xs">
              Oficial
            </Badge>
          )}
          {template.isFeatured && (
            <Badge className="bg-amber-500 text-white text-xs">
              ⭐ Destaque
            </Badge>
          )}
        </div>
        
        {isSelected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md">
            <Check className="w-4 h-4 text-primary" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn('p-5', colorClasses[template.color] || colorClasses.blue)}>
        <h3 className="font-bold text-lg mb-2 line-clamp-1">{template.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-background/80 rounded-full text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs px-2 py-0.5 text-muted-foreground">
              +{template.tags.length - 3}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{template.usageCount.toLocaleString('pt-BR')} usos</span>
          </div>
          {template.rating && template.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{template.rating.toFixed(1)}</span>
              <span className="text-muted-foreground/60">({template.ratingCount})</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPreview()
              }}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-background transition-colors"
            >
              Preview
            </button>
          )}
          {onUse && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUse()
              }}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
            >
              Usar template
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
