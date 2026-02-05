"use client"
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Mail, Sparkles, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const type = searchParams.get("type") // "email" for magic link verification request

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">
      <div className="text-center">
        {/* Animated envelope icon */}
        <div className="mx-auto w-20 h-20 relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-2xl animate-pulse" />
          <div className="absolute inset-0 bg-zinc-900 rounded-2xl m-0.5 flex items-center justify-center">
            <Mail className="w-8 h-8 text-violet-400 animate-bounce" />
          </div>
          
          {/* Floating sparkles */}
          <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-cyan-400 animate-ping" />
          <Sparkles className="absolute -bottom-1 -left-2 w-4 h-4 text-violet-400 animate-ping delay-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Check your inbox
        </h1>
        
        <p className="text-zinc-400 mb-6">
          We sent a magic link to
          {email ? (
            <span className="block text-white font-medium mt-1">{email}</span>
          ) : (
            <span className="block text-white font-medium mt-1">your email</span>
          )}
        </p>

        {/* Steps */}
        <div className="bg-zinc-800/50 rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-violet-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-violet-400 text-xs font-bold">1</span>
            </div>
            <p className="text-sm text-zinc-300">
              Open the email from <span className="text-white">BaaS</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-violet-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-violet-400 text-xs font-bold">2</span>
            </div>
            <p className="text-sm text-zinc-300">
              Click the <span className="text-white">"Sign in"</span> button
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-violet-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-violet-400 text-xs font-bold">3</span>
            </div>
            <p className="text-sm text-zinc-300">
              You'll be automatically signed in
            </p>
          </div>
        </div>

        {/* Help text */}
        <div className="bg-zinc-800/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-400">Didn't receive the email?</span>
            <br />
            Check your spam folder or{" "}
            <Link 
              href="/login" 
              className="text-violet-400 hover:text-violet-300 underline"
            >
              try a different email
            </Link>
          </p>
        </div>

        {/* Timer info */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 mb-6">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span>Link expires in 24 hours</span>
        </div>

        {/* Back to login */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </div>
    </div>
  )
}

function VerifyFallback() {
  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyContent />
    </Suspense>
  )
}
