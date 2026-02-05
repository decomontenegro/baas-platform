'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Users, 
  Check, 
  X, 
  AlertCircle,
  LogIn,
  Mail,
  Shield,
  Clock,
} from 'lucide-react'
import { signIn, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Full access to everything including ownership transfer',
  ADMIN: 'Full access to all features, can manage team and billing',
  MANAGER: 'Manage channels, knowledge base, and view analytics',
  OPERATOR: 'Respond to conversations and view data',
  VIEWER: 'Read-only access to data',
}

interface InviteData {
  id: string
  email: string
  role: string
  permissions: string[]
  tenant: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
  }
  invitedBy: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  expiresAt: string
  createdAt: string
}

export default function AcceptInvitePage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/team/invite/${params.token}/accept`)
        const data = await res.json()
        
        if (res.ok) {
          setInvite(data.invite)
        } else {
          setError(data.error || 'Invitation not found')
        }
      } catch (err) {
        setError('Failed to load invitation')
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvite()
  }, [params.token])

  // Accept invitation
  const handleAccept = async () => {
    if (!session) {
      // Redirect to sign in with callback to this page
      signIn('email', { 
        email: invite?.email,
        callbackUrl: `/invite/${params.token}`,
      })
      return
    }

    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/team/invite/${params.token}/accept`, {
        method: 'POST',
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setSuccess(true)
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setError(data.message || data.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setError('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invitation Invalid</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Go to Homepage
          </button>
        </motion.div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-8 h-8 text-green-600" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Welcome to the Team!</h1>
          <p className="text-gray-600 dark:text-gray-400">
            You've joined <strong>{invite?.tenant.name}</strong> as {ROLE_LABELS[invite?.role || 'VIEWER']}.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
            Redirecting to dashboard...
          </p>
        </motion.div>
      </div>
    )
  }

  const isExpired = invite && new Date(invite.expiresAt) < new Date()
  const isEmailMismatch = session && invite && 
    session.user?.email?.toLowerCase() !== invite.email.toLowerCase()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 p-6 text-white">
          <div className="flex items-center gap-4">
            {invite?.tenant.logoUrl ? (
              <img
                src={invite.tenant.logoUrl}
                alt={invite.tenant.name}
                className="w-12 h-12 rounded-lg bg-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Team Invitation</h1>
              <p className="text-white/80">{invite?.tenant.name}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Inviter */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            {invite?.invitedBy.image ? (
              <img
                src={invite.invitedBy.image}
                alt={invite.invitedBy.name || invite.invitedBy.email}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-medium">
                {(invite?.invitedBy.name || invite?.invitedBy.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium">
                {invite?.invitedBy.name || invite?.invitedBy.email}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                invited you to join
              </p>
            </div>
          </div>

          {/* Role info */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <p className="font-medium">Your Role: {ROLE_LABELS[invite?.role || 'VIEWER']}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {ROLE_DESCRIPTIONS[invite?.role || 'VIEWER']}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {invite?.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary-600 mt-0.5" />
              <div>
                <p className="font-medium">Expires</p>
                <p className={cn(
                  'text-sm',
                  isExpired ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
                )}>
                  {isExpired 
                    ? 'This invitation has expired'
                    : new Date(invite?.expiresAt || '').toLocaleDateString()
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Email mismatch warning */}
          {isEmailMismatch && (
            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Email mismatch</p>
                <p>
                  This invitation was sent to <strong>{invite?.email}</strong> but you're signed in as <strong>{session?.user?.email}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!session ? (
              <button
                onClick={handleAccept}
                disabled={isExpired}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign in to Accept
              </button>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting || isExpired || isEmailMismatch}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Accept Invitation
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={() => router.push('/')}
              className="btn-secondary w-full"
            >
              Decline
            </button>
          </div>

          {/* Session info */}
          {session && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-500 mt-4">
              Signed in as {session.user?.email}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
