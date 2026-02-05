'use client'

import { useState, useEffect } from 'react'
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Monitor,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import { NotificationType, NOTIFICATION_TYPE_META } from '@/types/notification'

interface Preference {
  type: NotificationType
  label: string
  description: string
  email: boolean
  push: boolean
  inApp: boolean
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Fetch preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/notifications/preferences')
        if (!res.ok) throw new Error('Failed to fetch preferences')
        const data = await res.json()
        setPreferences(data.preferences)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  // Toggle preference
  const togglePreference = async (
    type: NotificationType,
    channel: 'email' | 'push' | 'inApp'
  ) => {
    const currentPref = preferences.find(p => p.type === type)
    if (!currentPref) return

    const newValue = !currentPref[channel]
    
    // Optimistic update
    setPreferences(prev =>
      prev.map(p =>
        p.type === type ? { ...p, [channel]: newValue } : p
      )
    )

    // Save to server
    try {
      setIsSaving(true)
      setSaveMessage(null)

      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: [{ type, [channel]: newValue }],
        }),
      })

      if (!res.ok) throw new Error('Failed to save preference')
      
      setSaveMessage('Preferences saved')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      // Revert on error
      setPreferences(prev =>
        prev.map(p =>
          p.type === type ? { ...p, [channel]: !newValue } : p
        )
      )
      setError('Failed to save preference')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Notification Preferences
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Choose how you want to be notified about different events
          </p>
        </div>
        
        {/* Save indicator */}
        {(isSaving || saveMessage || error) && (
          <div className={`flex items-center gap-2 text-sm ${
            error ? 'text-red-500' : 'text-green-500'
          }`}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : error ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : error || saveMessage}
          </div>
        )}
      </div>

      {/* Channel headers */}
      <div className="hidden md:grid grid-cols-[1fr,auto,auto,auto] gap-4 pb-2 border-b border-[var(--border)]">
        <div />
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] uppercase w-16 justify-center">
          <Mail className="w-3.5 h-3.5" />
          Email
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] uppercase w-16 justify-center">
          <Smartphone className="w-3.5 h-3.5" />
          Push
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] uppercase w-16 justify-center">
          <Monitor className="w-3.5 h-3.5" />
          In-App
        </div>
      </div>

      {/* Preferences list */}
      <div className="space-y-1">
        {preferences.map(pref => (
            <div
              key={pref.type}
              className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto,auto] gap-4 py-4 border-b border-[var(--border)] last:border-0"
            >
              {/* Label & description */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Bell className="w-5 h-5 text-[var(--muted-foreground)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--foreground)]">
                    {pref.label}
                  </h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {pref.description}
                  </p>
                </div>
              </div>

              {/* Toggle buttons - Desktop */}
              <ToggleButton
                label="Email"
                enabled={pref.email}
                onToggle={() => togglePreference(pref.type, 'email')}
                className="hidden md:flex"
              />
              <ToggleButton
                label="Push"
                enabled={pref.push}
                onToggle={() => togglePreference(pref.type, 'push')}
                className="hidden md:flex"
              />
              <ToggleButton
                label="In-App"
                enabled={pref.inApp}
                onToggle={() => togglePreference(pref.type, 'inApp')}
                className="hidden md:flex"
              />

              {/* Toggle buttons - Mobile */}
              <div className="flex items-center gap-4 md:hidden pl-8">
                <ToggleButton
                  label="Email"
                  enabled={pref.email}
                  onToggle={() => togglePreference(pref.type, 'email')}
                  showLabel
                />
                <ToggleButton
                  label="Push"
                  enabled={pref.push}
                  onToggle={() => togglePreference(pref.type, 'push')}
                  showLabel
                />
                <ToggleButton
                  label="In-App"
                  enabled={pref.inApp}
                  onToggle={() => togglePreference(pref.type, 'inApp')}
                  showLabel
                />
              </div>
            </div>
        ))}
      </div>
    </div>
  )
}

// Toggle button component
function ToggleButton({
  label,
  enabled,
  onToggle,
  showLabel = false,
  className = '',
}: {
  label: string
  enabled: boolean
  onToggle: () => void
  showLabel?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center justify-center w-16 h-8 rounded-full transition-colors
        ${enabled
          ? 'bg-primary-500 text-white'
          : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
        }
        hover:opacity-90
        ${className}
      `}
      title={`${enabled ? 'Disable' : 'Enable'} ${label}`}
    >
      {showLabel ? (
        <span className="text-xs font-medium">{label}</span>
      ) : (
        enabled ? (
          <Check className="w-4 h-4" />
        ) : (
          <span className="text-xs">Off</span>
        )
      )}
    </button>
  )
}
