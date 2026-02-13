"use client"

import { useState, useEffect } from "react"
import { CostMode, COST_MODE_INFO, COST_MODE_PRESETS } from "@/types/cost-mode"
import { CostModeSelector } from "@/components/cost-mode-selector"
import { TrendingDown, TrendingUp, DollarSign, Settings2 } from "lucide-react"

interface UsageData {
  dailySpent: number
  monthlySpent: number
  dailyLimit: number
  monthlyLimit: number
}

export function CostWidget() {
  const [mode, setMode] = useState<CostMode>('intelligent')
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch cost mode
      const modeRes = await fetch('/api/cost-mode')
      if (modeRes.ok) {
        const modeData = await modeRes.json()
        setMode(modeData.data.mode)
      }

      // Fetch usage from Clawdbot
      const usageRes = await fetch('/api/clawdbot/usage')
      if (usageRes.ok) {
        const usageData = await usageRes.json()
        if (usageData.success && usageData.data) {
          const preset = COST_MODE_PRESETS[mode]
          setUsage({
            dailySpent: usageData.data.dailyCost || 0,
            monthlySpent: usageData.data.monthlyCost || 0,
            dailyLimit: preset.budgetAlerts.dailyLimitUsd,
            monthlyLimit: preset.budgetAlerts.monthlyLimitUsd,
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch cost data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleModeChange = async (newMode: CostMode) => {
    setMode(newMode)
    setShowSettings(false)
    
    try {
      await fetch('/api/cost-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      })
      
      // Update usage limits based on new mode
      const preset = COST_MODE_PRESETS[newMode]
      if (usage) {
        setUsage({
          ...usage,
          dailyLimit: preset.budgetAlerts.dailyLimitUsd,
          monthlyLimit: preset.budgetAlerts.monthlyLimitUsd,
        })
      }
    } catch (error) {
      console.error("Failed to update cost mode:", error)
    }
  }

  const info = COST_MODE_INFO[mode]
  const monthlyPercent = usage ? (usage.monthlySpent / usage.monthlyLimit) * 100 : 0
  const isWarning = monthlyPercent >= 75
  const isCritical = monthlyPercent >= 90

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-800 rounded w-1/3"></div>
          <div className="h-8 bg-gray-800 rounded w-2/3"></div>
          <div className="h-2 bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-white">Custo Este Mês</h3>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {showSettings ? (
        <CostModeSelector value={mode} onChange={handleModeChange} />
      ) : (
        <>
          {/* Usage */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-bold text-white">
                ${usage?.monthlySpent.toFixed(2) || '0.00'}
              </span>
              <span className="text-sm text-gray-400">
                / ${usage?.monthlyLimit || 100}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isCritical ? 'bg-red-500' :
                  isWarning ? 'bg-amber-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              {monthlyPercent.toFixed(0)}% do limite mensal
            </p>
          </div>

          {/* Mode info */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-lg">{info.emoji}</span>
              <div>
                <p className="text-sm font-medium text-white">Modo {info.name}</p>
                <p className="text-xs text-gray-400">{info.estimate}</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Alterar
            </button>
          </div>

          {/* Savings estimate */}
          {mode !== 'turbo' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
              <TrendingDown className="w-4 h-4" />
              <span>Economia estimada: ~70% vs Turbo</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
