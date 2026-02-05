import { auth } from "./auth"
import { redirect } from "next/navigation"
import { cache } from "react"

/**
 * Get the current session (cached per request)
 */
export const getSession = cache(async () => {
  return await auth()
})

/**
 * Get session or redirect to login
 */
export async function requireSession() {
  const session = await getSession()
  
  if (!session?.user) {
    redirect("/login")
  }
  
  return session
}

/**
 * Get session with tenant or redirect to onboarding
 */
export async function requireTenant() {
  const session = await requireSession()
  
  if (!session.user.tenantId) {
    redirect("/onboarding")
  }
  
  return session
}

/**
 * Check if user has required role
 */
export async function requireRole(roles: ("owner" | "admin" | "member")[]) {
  const session = await requireTenant()
  
  if (!roles.includes(session.user.role)) {
    redirect("/dashboard?error=unauthorized")
  }
  
  return session
}

/**
 * Get current user ID (throws if not authenticated)
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await requireSession()
  return session.user.id
}

/**
 * Get current tenant ID (throws if not authenticated or no tenant)
 */
export async function getCurrentTenantId(): Promise<string> {
  const session = await requireTenant()
  return session.user.tenantId!
}
