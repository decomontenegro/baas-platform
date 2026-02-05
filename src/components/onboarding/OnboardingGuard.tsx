"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const STORAGE_KEY = "baas_onboarding_state"

interface OnboardingState {
  completed: boolean
  whatsappConnected: boolean
  selectedGroupId: string | null
}

interface OnboardingGuardProps {
  children: React.ReactNode
}

/**
 * Guards dashboard routes and redirects to onboarding if not completed.
 * Wrap your dashboard layout with this component.
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Skip check if already on onboarding page
    if (pathname?.startsWith("/onboarding")) {
      setIsChecking(false)
      return
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      
      if (!saved) {
        // No onboarding state = new user, redirect to onboarding
        router.push("/onboarding")
        return
      }

      const state = JSON.parse(saved) as OnboardingState

      // Check if onboarding is completed
      if (!state.completed) {
        router.push("/onboarding")
        return
      }

      // User has completed onboarding, allow access
      setIsChecking(false)
    } catch (error) {
      console.error("Failed to check onboarding status:", error)
      // On error, allow access but log it
      setIsChecking(false)
    }
  }, [pathname, router])

  // Show nothing while checking (prevents flash)
  if (isChecking && !pathname?.startsWith("/onboarding")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Hook to check if user needs onboarding
 */
export function useNeedsOnboarding(): boolean | null {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      
      if (!saved) {
        setNeedsOnboarding(true)
        return
      }

      const state = JSON.parse(saved) as OnboardingState
      setNeedsOnboarding(!state.completed)
    } catch {
      setNeedsOnboarding(false)
    }
  }, [])

  return needsOnboarding
}

/**
 * Mark onboarding as skipped (for users who want to skip)
 */
export function skipOnboarding(): void {
  const state: OnboardingState = {
    completed: true,
    whatsappConnected: false,
    selectedGroupId: null,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Reset onboarding state (for testing or re-onboarding)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY)
}
