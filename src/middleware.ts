import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public paths - no auth needed
  const publicPaths = [
    "/simple-login",
    "/api/simple-auth", 
    "/api/docs",
    "/api/clawdbot",
    "/api/health",
    "/api/templates",
    "/_next",
    "/favicon.ico"
  ]
  
  const isPublic = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path)
  )
  
  if (isPublic) {
    return NextResponse.next()
  }
  
  // Check for simple auth cookie
  const authCookie = request.cookies.get("baas-auth")?.value
  const isAuthenticated = authCookie === "authenticated"
  
  if (!isAuthenticated) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      )
    }
    
    // Redirect to simple login
    return NextResponse.redirect(new URL("/simple-login", request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
