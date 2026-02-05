'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  Grid3X3, 
  List, 
  Filter,
  MessageSquare,
  MoreVertical,
  Trash2,
  Edit,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Modal } from '@/components/ui/modal'
import { mockChannels } from '@/hooks/use-channels'
import { formatRelativeTime, formatNumber, cn } from '@/lib/utils'
import type { Channel } from '@/types'

const channelIcons: Record<string, string> = {
  whatsapp: '💬',
  telegram: '📱',
  discord: '🎮',
  slack: '💼',
  api: '🔌',
}

const statusColors = {
  active: 'badge-success',
  inactive: 'badge-warning',
  error: 'badge-error',
}

type ViewMode = 'grid' | 'list'
type FilterType = 'all' | 'active' | 'inactive' | 'error'

export default function ChannelsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newChannel, setNewChannel] = useState({ name: '', type: 'whatsapp' })

  const channels = mockChannels

  const filteredChannels = channels.filter((channel) => {
    const matchesSearch = channel.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || channel.status === filter
    return matchesSearch && matchesFilter
  })

  const handleAddChannel = () => {
    // In real app, would call API
    console.log('Adding channel:', newChannel)
    setShowAddModal(false)
    setNewChannel({ name: '', type: 'whatsapp' })
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Channels" subtitle="Manage your communication channels" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="input w-auto"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'hover:bg-[var(--muted)]'
                )}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'hover:bg-[var(--muted)]'
                )}
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            {/* Add button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Channel</span>
            </button>
          </div>
        </div>

        {/* Channel Grid/List */}
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredChannels.map((channel, index) => (
                <ChannelCard key={channel.id} channel={channel} delay={index * 0.05} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="card overflow-hidden"
            >
              <table className="w-full">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium">Channel</th>
                    <th className="text-left p-4 text-sm font-medium">Type</th>
                    <th className="text-left p-4 text-sm font-medium">Status</th>
                    <th className="text-left p-4 text-sm font-medium">Messages</th>
                    <th className="text-left p-4 text-sm font-medium">Last Activity</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChannels.map((channel) => (
                    <tr 
                      key={channel.id}
                      className="border-t border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      <td className="p-4">
                        <Link href={`/channels/${channel.id}`} className="font-medium hover:text-primary-600">
                          {channel.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-2">
                          <span>{channelIcons[channel.type]}</span>
                          <span className="capitalize">{channel.type}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn('badge', statusColors[channel.status])}>
                          {channel.status}
                        </span>
                      </td>
                      <td className="p-4">{formatNumber(channel.messagesCount)}</td>
                      <td className="p-4 text-[var(--muted-foreground)]">
                        {channel.lastActivity ? formatRelativeTime(channel.lastActivity) : 'Never'}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/channels/${channel.id}`}
                          className="btn-secondary text-sm py-1.5"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {filteredChannels.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-2">No channels found</h3>
            <p className="text-[var(--muted-foreground)] mb-4">
              {search ? 'Try adjusting your search or filters' : 'Get started by adding your first channel'}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                Add Channel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Channel Modal */}
      <Modal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        title="Add New Channel"
        description="Connect a new messaging platform to your bot"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Channel Name</label>
            <input
              type="text"
              placeholder="e.g., Customer Support"
              value={newChannel.name}
              onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5">Channel Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(channelIcons).map(([type, icon]) => (
                <button
                  key={type}
                  onClick={() => setNewChannel({ ...newChannel, type })}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    newChannel.type === type 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                      : 'border-[var(--border)] hover:border-primary-300'
                  )}
                >
                  <span className="text-2xl block mb-1">{icon}</span>
                  <span className="text-sm capitalize font-medium">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddChannel}
              className="btn-primary"
              disabled={!newChannel.name}
            >
              Create Channel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Channel Card Component
function ChannelCard({ channel, delay }: { channel: Channel; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{channelIcons[channel.type]}</span>
          <div>
            <h3 className="font-semibold">{channel.name}</h3>
            <p className="text-sm text-[var(--muted-foreground)] capitalize">{channel.type}</p>
          </div>
        </div>
        <span className={cn('badge', statusColors[channel.status])}>
          {channel.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">Messages</p>
          <p className="text-lg font-semibold">{formatNumber(channel.messagesCount)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">Last Activity</p>
          <p className="text-lg font-semibold">
            {channel.lastActivity ? formatRelativeTime(channel.lastActivity) : 'Never'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/channels/${channel.id}`}
          className="btn-primary flex-1 text-center text-sm py-2"
        >
          <Eye className="w-4 h-4 inline-block mr-1" />
          View
        </Link>
        <button className="btn-secondary p-2">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
