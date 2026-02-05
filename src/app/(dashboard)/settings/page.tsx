'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Bell, 
  Shield, 
  Key, 
  Palette,
  Save,
  Moon,
  Sun,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Tabs, TabContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Settings {
  profile: {
    firstName: string
    lastName: string
    company: string
    avatar: string | null
  }
  notifications: {
    email: boolean
    push: boolean
    weekly: boolean
    handoffAlerts: boolean
    usageAlerts: boolean
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    language: string
    timezone: string
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: number
  }
}

interface UserInfo {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
}

interface TenantInfo {
  id: string
  name: string
  slug: string
  plan: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Data states
  const [settings, setSettings] = useState<Settings | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  // Form states
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true,
  })
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'api', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  ]

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        
        if (data.success) {
          setSettings(data.data.settings)
          setUser(data.data.user)
          setTenant(data.data.tenant)
          
          // Initialize form states
          setFirstName(data.data.settings.profile.firstName || '')
          setLastName(data.data.settings.profile.lastName || '')
          setCompany(data.data.settings.profile.company || '')
          setNotifications({
            email: data.data.settings.notifications.email,
            push: data.data.settings.notifications.push,
            weekly: data.data.settings.notifications.weekly,
          })
          setTheme(data.data.settings.appearance.theme)
        } else {
          setError(data.error || 'Erro ao carregar configurações')
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
        setError('Erro ao conectar com o servidor')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSettings()
  }, [])

  // Save settings
  const saveSettings = async (section: string, data: object) => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [section]: data }),
      })
      
      const result = await res.json()
      
      if (result.success) {
        setSettings(result.data.settings)
        setSuccessMessage(result.message || 'Configurações salvas!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Erro ao salvar')
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Erro ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveProfile = () => {
    saveSettings('profile', {
      firstName,
      lastName,
      company,
    })
  }

  const handleToggleNotification = (key: keyof typeof notifications) => {
    const newValue = !notifications[key]
    setNotifications({ ...notifications, [key]: newValue })
    saveSettings('notifications', { [key]: newValue })
  }

  const handleThemeChange = (newTheme: typeof theme) => {
    setTheme(newTheme)
    saveSettings('appearance', { theme: newTheme })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Settings" subtitle="Manage your account and preferences" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Settings" subtitle="Manage your account and preferences" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-lg font-medium mb-2">Erro ao carregar</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Settings" subtitle="Manage your account and preferences" />
      
      {/* Success/Error Messages */}
      {(successMessage || error) && (
        <div className={cn(
          'mx-6 mt-4 p-4 rounded-lg flex items-center gap-2',
          successMessage ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {successMessage ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {successMessage || error}
        </div>
      )}
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab}>
          {/* Profile Tab */}
          <TabContent value="profile" className="outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 max-w-2xl"
            >
              <h3 className="font-semibold mb-6">Profile Information</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center overflow-hidden">
                    {settings?.profile.avatar ? (
                      <img 
                        src={settings.profile.avatar} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <User className="w-10 h-10 text-white" />
                    )}
                  </div>
                  <button className="btn-secondary">Change Avatar</button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">First Name</label>
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Last Name</label>
                    <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled
                    className="input bg-muted cursor-not-allowed" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email não pode ser alterado
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Company</label>
                  <input 
                    type="text" 
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="input" 
                  />
                </div>

                {tenant && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Plano atual: <span className="text-primary">{tenant.plan}</span></p>
                    <p className="text-xs text-muted-foreground">Tenant: {tenant.slug}</p>
                  </div>
                )}

                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2 mt-4"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </TabContent>

          {/* Notifications Tab */}
          <TabContent value="notifications" className="outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 max-w-2xl"
            >
              <h3 className="font-semibold mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { key: 'email' as const, label: 'Email Notifications', description: 'Receive email updates about your channels' },
                  { key: 'push' as const, label: 'Push Notifications', description: 'Get browser notifications for new messages' },
                  { key: 'weekly' as const, label: 'Weekly Digest', description: 'Receive a weekly summary of activity' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-[var(--muted)] rounded-lg">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggleNotification(item.key)}
                      disabled={isSaving}
                      className={cn(
                        'w-12 h-6 rounded-full transition-colors relative',
                        notifications[item.key] 
                          ? 'bg-primary-600' 
                          : 'bg-gray-300'
                      )}
                    >
                      <motion.div
                        animate={{ 
                          x: notifications[item.key] ? 24 : 2 
                        }}
                        className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabContent>

          {/* Appearance Tab */}
          <TabContent value="appearance" className="outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 max-w-2xl"
            >
              <h3 className="font-semibold mb-6">Theme</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light' as const, label: 'Light', icon: Sun },
                  { value: 'dark' as const, label: 'Dark', icon: Moon },
                  { value: 'system' as const, label: 'System', icon: Palette },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    disabled={isSaving}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all',
                      theme === option.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-[var(--border)] hover:border-primary-300'
                    )}
                  >
                    <option.icon className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-medium">{option.label}</p>
                    {theme === option.value && (
                      <Check className="w-4 h-4 mx-auto mt-2 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </TabContent>

          {/* Security Tab */}
          <TabContent value="security" className="outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 max-w-2xl"
            >
              <h3 className="font-semibold mb-6">Security Settings</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Current Password</label>
                  <input type="password" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <input type="password" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                  <input type="password" className="input" />
                </div>
                <button className="btn-primary">Update Password</button>
              </div>
            </motion.div>
          </TabContent>

          {/* API Keys Tab */}
          <TabContent value="api" className="outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 max-w-2xl"
            >
              <h3 className="font-semibold mb-6">API Keys</h3>
              <div className="space-y-4">
                <div className="p-4 bg-[var(--muted)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Production Key</p>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <code className="text-sm font-mono text-[var(--muted-foreground)]">
                    sk-prod-xxxx...xxxx
                  </code>
                </div>
                <div className="p-4 bg-[var(--muted)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Development Key</p>
                    <span className="badge badge-info">Active</span>
                  </div>
                  <code className="text-sm font-mono text-[var(--muted-foreground)]">
                    sk-dev-xxxx...xxxx
                  </code>
                </div>
                <button className="btn-secondary">Generate New Key</button>
              </div>
            </motion.div>
          </TabContent>
        </Tabs>
      </div>
    </div>
  )
}
