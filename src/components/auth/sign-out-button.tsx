"use client"

import { LogOut, Loader2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface SignOutButtonProps {
  className?: string
  variant?: "default" | "ghost" | "danger"
  showIcon?: boolean
  children?: React.ReactNode
}

export function SignOutButton({ 
  className = "",
  variant = "default",
  showIcon = true,
  children 
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      // Use simple auth logout
      await fetch("/api/simple-auth", { method: "DELETE" })
      router.push("/simple-login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const baseStyles = "inline-flex items-center gap-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variantStyles = {
    default: "bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg",
    ghost: "text-zinc-400 hover:text-white hover:bg-zinc-800/50 px-3 py-2 rounded-lg",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-red-500/20",
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : showIcon ? (
        <LogOut className="w-4 h-4" />
      ) : null}
      {children || "Sign out"}
    </button>
  )
}
