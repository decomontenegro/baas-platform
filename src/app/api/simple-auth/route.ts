import { NextResponse } from "next/server"

// Simple password - change this!
const ADMIN_PASSWORD = "baas2026"

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    
    if (password === ADMIN_PASSWORD) {
      const response = NextResponse.json({ success: true })
      
      // Set auth cookie - 30 days
      response.cookies.set("baas-auth", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })
      
      return response
    }
    
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    )
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  
  // Clear auth cookie
  response.cookies.set("baas-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  
  return response
}
