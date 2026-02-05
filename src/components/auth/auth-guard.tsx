"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  requireTenant?: boolean
  requireRole?: ("owner" | "admin" | "member")[]
  fallback?: React.ReactNode
}

export function AuthGuard({ 
  children, 
  requireTenant = false,
  requireRole,
  fallback
}: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "loading") return

    // Not authenticated - redirect to login
    if (!session) {
      const callbackUrl = encodeURIComponent(pathname)
      router.push(`/login?callbackUrl=${callbackUrl}`)
      return
    }

    // No tenant - redirect to onboarding
    if (requireTenant && !session.user.tenantId) {
      router.push("/onboarding")
      return
    }

    // Role check
    if (requireRole && !requireRole.includes(session.user.role)) {
      router.push("/dashboard?error=unauthorized")
      return
    }
  }, [session, status, router, pathname, requireTenant, requireRole])

  // Loading state
  if (status === "loading") {
    return fallback || <LoadingScreen />
  }

  // Not authenticated
  if (!session) {
    return fallback || <LoadingScreen />
  }

  // Missing tenant
  if (requireTenant && !session.user.tenantId) {
    return fallback || <LoadingScreen />
  }

  // Role check failed
  if (requireRole && !requireRole.includes(session.user.role)) {
    return fallback || <LoadingScreen />
  }

  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-zinc-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

/**
 * HOC version for wrapping components
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AuthGuardProps, "children">
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}
