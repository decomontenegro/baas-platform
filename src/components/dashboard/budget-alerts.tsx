"use client"

import { useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { CostMode, COST_MODE_PRESETS, COST_MODE_INFO } from "@/types/cost-mode"
import { AlertTriangle, AlertCircle, TrendingUp } from "lucide-react"

interface UsageData {
  dailyCost: number
  monthlyCost: number
}

interface AlertState {
  warningShown: boolean
  criticalShown: boolean
  lastCheck: number
}

const ALERT_STORAGE_KEY = "budget-alert-state"
const CHECK_INTERVAL = 60000 // Check every minute
const ALERT_COOLDOWN = 3600000 // Don't show same alert type more than once per hour

function getAlertState(): AlertState {
  if (typeof window === "undefined") {
    return { warningShown: false, criticalShown: false, lastCheck: 0 }
  }
  
  try {
    const stored = localStorage.getItem(ALERT_STORAGE_KEY)
    if (stored) {
      const state = JSON.parse(stored)
      // Reset alerts if it's been more than ALERT_COOLDOWN
      const now = Date.now()
      if (now - state.lastCheck > ALERT_COOLDOWN) {
        return { warningShown: false, criticalShown: false, lastCheck: now }
      }
      return state
    }
  } catch {
    // Ignore parse errors
  }
  return { warningShown: false, criticalShown: false, lastCheck: Date.now() }
}

function setAlertState(state: AlertState): void {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify({
      ...state,
      lastCheck: Date.now()
    }))
  } catch {
    // Ignore storage errors
  }
}

export function BudgetAlerts() {
  const alertStateRef = useRef<AlertState>(getAlertState())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkBudget = useCallback(async () => {
    try {
      // Fetch current mode
      const modeRes = await fetch('/api/cost-mode')
      let mode: CostMode = 'intelligent'
      if (modeRes.ok) {
        const modeData = await modeRes.json()
        mode = modeData.data?.mode || 'intelligent'
      }

      // Fetch usage
      const usageRes = await fetch('/api/clawdbot/usage')
      if (!usageRes.ok) return

      const usageData = await usageRes.json()
      if (!usageData.success || !usageData.data) return

      const usage: UsageData = {
        dailyCost: usageData.data.dailyCost || 0,
        monthlyCost: usageData.data.monthlyCost || 0,
      }

      const preset = COST_MODE_PRESETS[mode]
      const modeInfo = COST_MODE_INFO[mode]
      const { budgetAlerts } = preset
      
      // Calculate percentages
      const dailyPercent = (usage.dailyCost / budgetAlerts.dailyLimitUsd) * 100
      const monthlyPercent = (usage.monthlyCost / budgetAlerts.monthlyLimitUsd) * 100

      const state = alertStateRef.current
      
      // Critical alert (90%)
      if ((dailyPercent >= 90 || monthlyPercent >= 90) && !state.criticalShown) {
        const isDaily = dailyPercent >= 90
        const percent = isDaily ? dailyPercent : monthlyPercent
        const limit = isDaily ? budgetAlerts.dailyLimitUsd : budgetAlerts.monthlyLimitUsd
        const spent = isDaily ? usage.dailyCost : usage.monthlyCost
        const period = isDaily ? "diário" : "mensal"

        toast.error(
          `⚠️ Limite ${period} crítico!`,
          {
            description: `${modeInfo.emoji} Modo ${modeInfo.name}: $${spent.toFixed(2)} de $${limit} (${percent.toFixed(0)}%)`,
            duration: 10000,
            icon: <AlertCircle className="w-5 h-5 text-red-500" />,
            action: {
              label: "Ver detalhes",
              onClick: () => window.location.href = "/dashboard",
            },
          }
        )

        state.criticalShown = true
        state.warningShown = true // Also mark warning as shown
        setAlertState(state)
        alertStateRef.current = state
      }
      // Warning alert (75% or configured threshold)
      else if ((dailyPercent >= 75 || monthlyPercent >= 75) && !state.warningShown) {
        const isDaily = dailyPercent >= 75
        const percent = isDaily ? dailyPercent : monthlyPercent
        const limit = isDaily ? budgetAlerts.dailyLimitUsd : budgetAlerts.monthlyLimitUsd
        const spent = isDaily ? usage.dailyCost : usage.monthlyCost
        const period = isDaily ? "diário" : "mensal"

        toast.warning(
          `Alerta de orçamento ${period}`,
          {
            description: `${modeInfo.emoji} Modo ${modeInfo.name}: $${spent.toFixed(2)} de $${limit} (${percent.toFixed(0)}%)`,
            duration: 8000,
            icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
            action: {
              label: "Ajustar modo",
              onClick: () => window.location.href = "/dashboard",
            },
          }
        )

        state.warningShown = true
        setAlertState(state)
        alertStateRef.current = state
      }

    } catch (error) {
      console.error("[BudgetAlerts] Check failed:", error)
    }
  }, [])

  useEffect(() => {
    // Initial check after a short delay (let the page load)
    const initialTimeout = setTimeout(checkBudget, 2000)

    // Periodic checks
    intervalRef.current = setInterval(checkBudget, CHECK_INTERVAL)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkBudget])

  // This component doesn't render anything - it just manages alerts
  return null
}

// Export a standalone function to manually trigger budget check
export async function checkBudgetAlerts(): Promise<void> {
  try {
    const modeRes = await fetch('/api/cost-mode')
    let mode: CostMode = 'intelligent'
    if (modeRes.ok) {
      const modeData = await modeRes.json()
      mode = modeData.data?.mode || 'intelligent'
    }

    const usageRes = await fetch('/api/clawdbot/usage')
    if (!usageRes.ok) return

    const usageData = await usageRes.json()
    if (!usageData.success || !usageData.data) return

    const preset = COST_MODE_PRESETS[mode]
    const modeInfo = COST_MODE_INFO[mode]
    
    const dailyPercent = (usageData.data.dailyCost / preset.budgetAlerts.dailyLimitUsd) * 100
    const monthlyPercent = (usageData.data.monthlyCost / preset.budgetAlerts.monthlyLimitUsd) * 100

    if (dailyPercent >= 90 || monthlyPercent >= 90) {
      toast.error("Limite de orçamento crítico!", {
        description: `${modeInfo.emoji} ${monthlyPercent.toFixed(0)}% do limite mensal atingido`,
        duration: 10000,
      })
    } else if (dailyPercent >= 75 || monthlyPercent >= 75) {
      toast.warning("Alerta de orçamento", {
        description: `${modeInfo.emoji} ${monthlyPercent.toFixed(0)}% do limite mensal atingido`,
        duration: 8000,
      })
    }
  } catch (error) {
    console.error("[checkBudgetAlerts] Failed:", error)
  }
}
