'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Settings, 
  History, 
  Brain, 
  BarChart3,
  Edit2,
  Save,
  X,
  Trash2,
  Power,
  Copy,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Tabs, TabContent } from '@/components/ui/tabs'
import { mockChannels } from '@/hooks/use-channels'
import { formatDate, formatNumber, cn } from '@/lib/utils'
import type { Channel, Message, MemoryItem } from '@/types'

const channelIcons: Record<string, string> = {
  whatsapp: '💬',
  telegram: '📱',
  discord: '🎮',
  slack: '💼',
  api: '🔌',
}

// Mock data
const mockMessages: Message[] = [
  { id: '1', channelId: '1', role: 'user', content: 'Hello, I need help with my order', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: '2', channelId: '1', role: 'assistant', content: 'Hi! I\'d be happy to help you with your order. Could you please provide your order number?', createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
  { id: '3', channelId: '1', role: 'user', content: 'It\'s ORDER-12345', createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { id: '4', channelId: '1', role: 'assistant', content: 'Thank you! I found your order. It was shipped yesterday and should arrive within 2-3 business days.', createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: '5', channelId: '1', role: 'user', content: 'Great, thanks!', createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString() },
]

const mockMemory: MemoryItem[] = [
  { id: '1', channelId: '1', key: 'customer_name', value: 'John Doe', type: 'fact', createdAt: new Date().toISOString() },
  { id: '2', channelId: '1', key: 'preferred_language', value: 'English', type: 'preference', createdAt: new Date().toISOString() },
  { id: '3', channelId: '1', key: 'last_order', value: 'ORDER-12345', type: 'context', createdAt: new Date().toISOString() },
  { id: '4', channelId: '1', key: 'contact_reason', value: 'Order status inquiry', type: 'context', createdAt: new Date().toISOString() },
]

export default function ChannelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const channelId = params.id as string
  
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Find channel from mock data
  const channel = mockChannels.find(c => c.id === channelId)
  
  const [editedChannel, setEditedChannel] = useState<Partial<Channel>>(channel || {})

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Channel not found</h2>
          <Link href="/channels" className="text-primary-600 hover:underline">
            Back to channels
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'config', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'memory', label: 'Memory', icon: <Brain className="w-4 h-4" /> },
  ]

  const handleSave = () => {
    // In real app, would call API
    console.log('Saving:', editedChannel)
    setIsEditing(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        title={channel.name} 
        subtitle={`${channelIcons[channel.type]} ${channel.type.charAt(0).toUpperCase() + channel.type.slice(1)} Channel`}
      />
      
      <div className="flex-1 overflow-auto">
        {/* Back button and actions */}
        <div className="flex items-center justify-between p-6 pb-0">
          <Link 
            href="/channels" 
            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Channels
          </Link>
          
          <div className="flex gap-2">
            <button 
              className={cn(
                'btn-secondary flex items-center gap-2',
                channel.status === 'active' ? 'text-red-600' : 'text-green-600'
              )}
            >
              <Power className="w-4 h-4" />
              {channel.status === 'active' ? 'Disable' : 'Enable'}
            </button>
            <button className="btn-secondary flex items-center gap-2 text-red-600">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="p-6">
          <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab}>
            {/* Overview Tab */}
            <TabContent value="overview" className="outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="card p-6">
                    <p className="text-sm text-[var(--muted-foreground)]">Total Messages</p>
                    <p className="text-3xl font-bold mt-1">{formatNumber(channel.messagesCount)}</p>
                  </div>
                  <div className="card p-6">
                    <p className="text-sm text-[var(--muted-foreground)]">Status</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1 capitalize',
                      channel.status === 'active' && 'text-green-600',
                      channel.status === 'inactive' && 'text-yellow-600',
                      channel.status === 'error' && 'text-red-600'
                    )}>
                      {channel.status}
                    </p>
                  </div>
                  <div className="card p-6">
                    <p className="text-sm text-[var(--muted-foreground)]">Created</p>
                    <p className="text-lg font-semibold mt-1">{formatDate(channel.createdAt)}</p>
                  </div>
                  <div className="card p-6">
                    <p className="text-sm text-[var(--muted-foreground)]">Last Updated</p>
                    <p className="text-lg font-semibold mt-1">{formatDate(channel.updatedAt)}</p>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="card p-6">
                  <h3 className="font-semibold mb-4">Channel Info</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">ID</span>
                      <span className="font-mono">{channel.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Type</span>
                      <span className="capitalize">{channel.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">Last Activity</span>
                      <span>{channel.lastActivity ? formatDate(channel.lastActivity) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabContent>

            {/* Config Tab */}
            <TabContent value="config" className="outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 max-w-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Channel Configuration</h3>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)} className="btn-secondary flex items-center gap-2">
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="btn-secondary flex items-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Channel Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedChannel.name || ''}
                        onChange={(e) => setEditedChannel({ ...editedChannel, name: e.target.value })}
                        className="input"
                      />
                    ) : (
                      <p className="py-2">{channel.name}</p>
                    )}
                  </div>

                  {channel.type === 'whatsapp' && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                      <p className="py-2 font-mono">{channel.config.phoneNumber || 'Not configured'}</p>
                    </div>
                  )}

                  {channel.type === 'api' && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">API Key</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-[var(--muted)] rounded text-sm font-mono truncate">
                          {channel.config.apiKey || 'sk-xxxx...'}
                        </code>
                        <button 
                          onClick={() => copyToClipboard(channel.config.apiKey || '')}
                          className="btn-secondary p-2"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-[var(--muted)] rounded text-sm font-mono truncate">
                        https://api.baas.app/webhook/{channel.id}
                      </code>
                      <button 
                        onClick={() => copyToClipboard(`https://api.baas.app/webhook/${channel.id}`)}
                        className="btn-secondary p-2"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabContent>

            {/* History Tab */}
            <TabContent value="history" className="outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 max-w-3xl"
              >
                <h3 className="font-semibold mb-6">Recent Conversations</h3>
                <div className="space-y-4">
                  {mockMessages.map((message) => (
                    <div 
                      key={message.id}
                      className={cn(
                        'p-4 rounded-lg max-w-[80%]',
                        message.role === 'user' 
                          ? 'bg-[var(--muted)] ml-auto' 
                          : 'bg-primary-50 dark:bg-primary-900/20'
                      )}
                    >
                      <p className="text-xs text-[var(--muted-foreground)] mb-1 capitalize">
                        {message.role}
                      </p>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </TabContent>

            {/* Memory Tab */}
            <TabContent value="memory" className="outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 max-w-2xl"
              >
                <h3 className="font-semibold mb-6">Stored Memory</h3>
                <div className="space-y-3">
                  {mockMemory.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-start justify-between p-3 bg-[var(--muted)] rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.key}</p>
                        <p className="text-[var(--muted-foreground)]">{item.value}</p>
                      </div>
                      <span className={cn(
                        'badge',
                        item.type === 'fact' && 'badge-info',
                        item.type === 'preference' && 'badge-success',
                        item.type === 'context' && 'badge-warning',
                      )}>
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </TabContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
