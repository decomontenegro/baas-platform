"use client"

import * as React from "react"
import { Toaster } from "@/components/ui/toast"

/**
 * Onboarding layout - simplified version without sidebar
 * This creates a focused, distraction-free experience for new users
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header - minimal */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              B
            </div>
            <span className="font-semibold">BaaS</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-8">
        {children}
      </main>

      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
  )
}
