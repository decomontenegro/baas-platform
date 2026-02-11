import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip auth for login page and API auth
  if (pathname === "/auth/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    return NextResponse.next()
  }
  
  // Check for auth cookie
  const authCookie = request.cookies.get("baas-auth")?.value
  
  if (authCookie !== "authenticated") {
    const loginUrl = new URL("/auth/login", request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/login|api/auth).*)",
  ],
}