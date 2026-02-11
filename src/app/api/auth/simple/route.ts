import { NextRequest, NextResponse } from "next/server"

// Senha simples para proteção temporária
const TEMP_PASSWORD = "baas2026"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (password === TEMP_PASSWORD) {
      const response = NextResponse.json({ success: true })
      
      // Set auth cookie (30 days)
      response.cookies.set("baas-auth", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })

      return response
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
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