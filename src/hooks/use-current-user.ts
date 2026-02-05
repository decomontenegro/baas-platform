"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"

export function useCurrentUser() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Only call useSession on client side
  const sessionResult = useSession()
  
  // During SSR/build or before mount, return loading state
  if (!mounted) {
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      tenantId: null,
      role: null,
      isOwner: false,
      isAdmin: false,
      hasTenant: false,
      updateSession: undefined,
    }
  }
  
  // Handle case when SessionProvider is not available
  const session = sessionResult?.data
  const status = sessionResult?.status ?? "loading"
  const update = sessionResult?.update

  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    tenantId: session?.user?.tenantId ?? null,
    role: session?.user?.role ?? null,
    
    // Helper methods
    isOwner: session?.user?.role === "owner",
    isAdmin: session?.user?.role === "admin" || session?.user?.role === "owner",
    hasTenant: !!session?.user?.tenantId,
    
    // Update session (e.g., after tenant switch)
    updateSession: update,
  }
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading, user } = useCurrentUser()
  
  return {
    isReady: !isLoading && isAuthenticated,
    user,
    isLoading,
  }
}
