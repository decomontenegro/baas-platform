"use client"

import { useState, useEffect, useCallback } from "react"

export type UsageType = "personal" | "business" | null
export type PersonalityType = "friendly" | "professional" | "casual" | "formal" | null

export interface OnboardingState {
  currentStep: number
  usageType: UsageType
  whatsappConnected: boolean
  selectedGroupId: string | null
  personality: PersonalityType
  testMessageSent: boolean
  completed: boolean
}

const STORAGE_KEY = "baas_onboarding_state"
const TOTAL_STEPS = 6

const defaultState: OnboardingState = {
  currentStep: 1,
  usageType: null,
  whatsappConnected: false,
  selectedGroupId: null,
  personality: null,
  testMessageSent: false,
  completed: false,
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(defaultState)
  const [isLoading, setIsLoading] = useState(true)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as OnboardingState
        setState(parsed)
      }
    } catch (error) {
      console.error("Failed to load onboarding state:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Persist state to localStorage
  const persistState = useCallback((newState: OnboardingState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    } catch (error) {
      console.error("Failed to save onboarding state:", error)
    }
  }, [])

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates }
      persistState(newState)
      return newState
    })
  }, [persistState])

  const nextStep = useCallback(() => {
    if (state.currentStep < TOTAL_STEPS) {
      updateState({ currentStep: state.currentStep + 1 })
    }
  }, [state.currentStep, updateState])

  const prevStep = useCallback(() => {
    if (state.currentStep > 1) {
      updateState({ currentStep: state.currentStep - 1 })
    }
  }, [state.currentStep, updateState])

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      updateState({ currentStep: step })
    }
  }, [updateState])

  const setUsageType = useCallback((usageType: UsageType) => {
    updateState({ usageType })
  }, [updateState])

  const setWhatsAppConnected = useCallback((connected: boolean) => {
    updateState({ whatsappConnected: connected })
  }, [updateState])

  const setSelectedGroup = useCallback((groupId: string | null) => {
    updateState({ selectedGroupId: groupId })
  }, [updateState])

  const setPersonality = useCallback((personality: PersonalityType) => {
    updateState({ personality })
  }, [updateState])

  const setTestMessageSent = useCallback((sent: boolean) => {
    updateState({ testMessageSent: sent })
  }, [updateState])

  const completeOnboarding = useCallback(() => {
    updateState({ completed: true })
  }, [updateState])

  const resetOnboarding = useCallback(() => {
    setState(defaultState)
    persistState(defaultState)
  }, [persistState])

  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return state.usageType !== null
      case 2:
        return state.whatsappConnected
      case 3:
        return state.selectedGroupId !== null
      case 4:
        return state.personality !== null
      case 5:
        return state.testMessageSent
      case 6:
        return true
      default:
        return false
    }
  }, [state])

  const getProgress = useCallback((): number => {
    return ((state.currentStep - 1) / (TOTAL_STEPS - 1)) * 100
  }, [state.currentStep])

  return {
    state,
    isLoading,
    totalSteps: TOTAL_STEPS,
    nextStep,
    prevStep,
    goToStep,
    setUsageType,
    setWhatsAppConnected,
    setSelectedGroup,
    setPersonality,
    setTestMessageSent,
    completeOnboarding,
    resetOnboarding,
    canProceed,
    getProgress,
  }
}
