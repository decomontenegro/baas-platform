"use client"

import { useState } from "react"
import { CostMode, COST_MODE_INFO } from "@/types/cost-mode"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"

interface CostModeSelectorProps {
  value: CostMode
  onChange: (mode: CostMode) => void
  className?: string
}

export function CostModeSelector({ value, onChange, className }: CostModeSelectorProps) {
  const modes: CostMode[] = ['turbo', 'intelligent', 'economic']

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium text-gray-200">
        Modo de Operação
      </label>
      <div className="grid gap-3">
        {modes.map((mode) => {
          const info = COST_MODE_INFO[mode]
          const isSelected = value === mode
          
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className={cn(
                "flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                isSelected
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{info.emoji}</span>
                <span className="font-semibold text-white">{info.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{info.estimate}</span>
              </div>
              <p className="text-sm text-gray-400">{info.description}</p>
              {info.warning && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{info.warning}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Compact version for dashboard
export function CostModeDisplay({ mode, onChangeClick }: { mode: CostMode; onChangeClick?: () => void }) {
  const info = COST_MODE_INFO[mode]
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">{info.emoji}</span>
        <div>
          <p className="text-sm font-medium text-white">Modo {info.name}</p>
          <p className="text-xs text-gray-400">{info.estimate}</p>
        </div>
      </div>
      {onChangeClick && (
        <button
          onClick={onChangeClick}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          Alterar
        </button>
      )}
    </div>
  )
}
