'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  description?: string
  leftLabel?: string
  rightLabel?: string
  color?: 'blue' | 'purple' | 'green' | 'orange'
  className?: string
}

const colorStyles = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  description,
  leftLabel,
  rightLabel,
  color = 'blue',
  className,
}: SliderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
          )}
        </div>
        <span className="text-sm font-medium text-[var(--muted-foreground)]">
          {value}%
        </span>
      </div>
      
      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-[var(--muted)]">
          <SliderPrimitive.Range 
            className={cn('absolute h-full rounded-full', colorStyles[color])} 
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb 
          className={cn(
            'block w-5 h-5 bg-white rounded-full shadow-lg border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
            color === 'blue' && 'border-blue-500 focus:ring-blue-500',
            color === 'purple' && 'border-purple-500 focus:ring-purple-500',
            color === 'green' && 'border-green-500 focus:ring-green-500',
            color === 'orange' && 'border-orange-500 focus:ring-orange-500'
          )}
        />
      </SliderPrimitive.Root>
      
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  )
}
