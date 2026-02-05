'use client'

import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { BotPersonality } from '@/types/bot'
import { PERSONALITY_TRAITS } from '@/types/bot'

interface PersonalitySlidersProps {
  personality: BotPersonality
  onChange?: (personality: BotPersonality) => void
  readonly?: boolean
  compact?: boolean
}

export function PersonalitySliders({
  personality,
  onChange,
  readonly = false,
  compact = false,
}: PersonalitySlidersProps) {
  const handleChange = (key: keyof BotPersonality, value: number) => {
    if (readonly) return
    onChange?.({
      ...personality,
      [key]: value,
    })
  }

  const traits = Object.entries(PERSONALITY_TRAITS) as Array<
    [keyof BotPersonality, typeof PERSONALITY_TRAITS[keyof typeof PERSONALITY_TRAITS]]
  >

  return (
    <TooltipProvider>
      <div className={cn('space-y-4', compact && 'space-y-3')}>
        {traits.map(([key, trait]) => {
          const value = personality[key]
          const percentage = value / 100

          return (
            <div key={key} className="space-y-1.5">
              {/* Label */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">{trait.icon}</span>
                  <span className="font-medium">{trait.name}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p>{trait.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <strong>Baixo:</strong> {trait.low}
                        <br />
                        <strong>Alto:</strong> {trait.high}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-muted-foreground tabular-nums">{value}%</span>
              </div>

              {/* Slider */}
              <div className="relative">
                {/* Background track */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  {/* Filled track */}
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full"
                    initial={false}
                    animate={{ width: `${value}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>

                {/* Range input (invisible but interactive) */}
                {!readonly && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => handleChange(key, parseInt(e.target.value, 10))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label={trait.name}
                  />
                )}

                {/* Thumb indicator */}
                {!compact && (
                  <motion.div
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-md border-2 border-background',
                      readonly ? 'opacity-75' : 'cursor-grab active:cursor-grabbing'
                    )}
                    style={{ left: `calc(${value}% - 8px)` }}
                    initial={false}
                    animate={{ left: `calc(${value}% - 8px)` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </div>

              {/* Low/High labels */}
              {!compact && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{trait.low}</span>
                  <span>{trait.high}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

// Visual preview of personality
interface PersonalityPreviewProps {
  personality: BotPersonality
  className?: string
}

export function PersonalityPreview({ personality, className }: PersonalityPreviewProps) {
  const traits = Object.entries(PERSONALITY_TRAITS) as Array<
    [keyof BotPersonality, typeof PERSONALITY_TRAITS[keyof typeof PERSONALITY_TRAITS]]
  >

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {traits.map(([key, trait]) => {
        const value = personality[key]
        const intensity = value / 100

        return (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted cursor-help transition-colors hover:bg-muted/80"
                  style={{
                    opacity: 0.4 + intensity * 0.6,
                  }}
                >
                  <span className="text-base">{trait.icon}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  <strong>{trait.name}:</strong> {value}%
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}

// Radar chart visualization
interface PersonalityRadarProps {
  personality: BotPersonality
  size?: number
  className?: string
}

export function PersonalityRadar({ personality, size = 200, className }: PersonalityRadarProps) {
  const center = size / 2
  const radius = (size - 40) / 2
  const traits = ['creativity', 'formality', 'verbosity', 'empathy', 'humor'] as const
  const angleStep = (2 * Math.PI) / traits.length
  const startAngle = -Math.PI / 2 // Start from top

  // Calculate points for the personality polygon
  const points = traits.map((trait, i) => {
    const value = personality[trait] / 100
    const angle = startAngle + i * angleStep
    const r = radius * value
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  })

  // Generate path for the polygon
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <svg width={size} height={size} className={className}>
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <circle
          key={scale}
          cx={center}
          cy={center}
          r={radius * scale}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Grid lines */}
      {traits.map((_, i) => {
        const angle = startAngle + i * angleStep
        const endX = center + radius * Math.cos(angle)
        const endY = center + radius * Math.sin(angle)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={endX}
            y2={endY}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        )
      })}

      {/* Personality polygon */}
      <motion.path
        d={pathD}
        fill="hsl(var(--primary))"
        fillOpacity={0.2}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Points */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="hsl(var(--primary))"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        />
      ))}

      {/* Labels */}
      {traits.map((trait, i) => {
        const angle = startAngle + i * angleStep
        const labelRadius = radius + 20
        const x = center + labelRadius * Math.cos(angle)
        const y = center + labelRadius * Math.sin(angle)

        return (
          <text
            key={trait}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-muted-foreground"
          >
            {PERSONALITY_TRAITS[trait].icon}
          </text>
        )
      })}
    </svg>
  )
}
