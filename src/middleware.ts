import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Auth re-enabled after testing (2026-02-11)
  
  // Public paths that don't need authentication
  const publicPaths = ["/login", "/verify", "/api/auth", "/api/docs", "/api/clawdbot", "/api/health", "/api/templates", "/_next", "/favicon.ico"]
  const isPublic = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path)
  )
  
  if (isPublic) {
    return NextResponse.next()
  }
  
  // Check for session cookie (database sessions, not JWT)
  // NextAuth with database sessions uses session token cookies
  const sessionToken = request.cookies.get("__Secure-next-auth.session-token")?.value 
    || request.cookies.get("next-auth.session-token")?.value
  
  if (!sessionToken) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      )
    }
    
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Let the request through - actual session validation happens in route handlers
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
