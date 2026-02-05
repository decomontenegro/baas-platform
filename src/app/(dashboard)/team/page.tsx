'use client'
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  UserPlus, 
  Mail,
  Shield,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  Send,
  X,
  Check,
  AlertCircle,
  History,
  ChevronDown,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Tabs, TabContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/use-current-user'

// Types
interface TeamMember {
  id: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    lastLoginAt: string | null
  }
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'
  permissions: string[]
  effectivePermissions: string[]
  invitedBy: { id: string; name: string | null; email: string } | null
  joinedAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: string
  permissions: string[]
  invitedBy: { id: string; name: string | null; email: string }
  expiresAt: string
  createdAt: string
}

interface ActivityLog {
  id: string
  action: string
  targetType: string
  targetId: string | null
  targetEmail: string | null
  details: Record<string, unknown>
  actor: { id: string; name: string | null; email: string; image: string | null }
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  MANAGER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  OPERATOR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
}

const PERMISSION_LABELS: Record<string, string> = {
  'channels:read': 'View Channels',
  'channels:write': 'Edit Channels',
  'channels:delete': 'Delete Channels',
  'conversations:read': 'View Conversations',
  'conversations:respond': 'Respond to Conversations',
  'knowledge:read': 'View Knowledge Base',
  'knowledge:write': 'Edit Knowledge Base',
  'analytics:read': 'View Analytics',
  'analytics:export': 'Export Analytics',
  'team:read': 'View Team',
  'team:invite': 'Invite Members',
  'team:manage': 'Manage Team',
  'billing:read': 'View Billing',
  'billing:manage': 'Manage Billing',
  'settings:read': 'View Settings',
  'settings:write': 'Edit Settings',
}

const ACTION_LABELS: Record<string, string> = {
  MEMBER_INVITED: 'Invited member',
  MEMBER_JOINED: 'Joined team',
  MEMBER_ROLE_CHANGED: 'Changed role',
  MEMBER_PERMISSIONS_CHANGED: 'Changed permissions',
  MEMBER_REMOVED: 'Removed member',
  INVITE_CANCELLED: 'Cancelled invite',
  INVITE_RESENT: 'Resent invite',
  INVITE_EXPIRED: 'Invite expired',
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState('members')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([])
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Get tenant ID from session
  const { tenantId, isLoading: sessionLoading } = useCurrentUser()

  const tabs = [
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { id: 'invites', label: 'Pending Invites', icon: <Mail className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  ]

  // Fetch team data
  useEffect(() => {
    async function fetchTeam() {
      if (!tenantId) {
        setLoading(false)
        return
      }
      
      try {
        const res = await fetch(`/api/team?tenantId=${tenantId}`)
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members || [])
          setPendingInvites(data.pendingInvites || [])
          setActivityLog(data.activityLog || [])
          setUserPermissions(data.currentUserPermissions || [])
        } else if (res.status === 401) {
          toast.error('Session expired. Please login again.')
        }
      } catch (error) {
        console.error('Failed to fetch team:', error)
        toast.error('Failed to load team data')
      } finally {
        setLoading(false)
      }
    }
    
    if (!sessionLoading) {
      fetchTeam()
    }
  }, [tenantId, sessionLoading])

  const canInvite = tenantId && userPermissions.includes('team:invite')
  const canManage = tenantId && userPermissions.includes('team:manage')

  // Handle member removal
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    
    try {
      const res = await fetch(`/api/team/${memberId}?tenantId=${tenantId}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        setMembers(members.filter(m => m.id !== memberId))
        toast.success('Member removed successfully')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to remove member')
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('Failed to remove member')
    }
  }

  // Handle invite cancellation
  const handleCancelInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/invite?tenantId=${tenantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      
      if (res.ok) {
        setPendingInvites(pendingInvites.filter(i => i.id !== inviteId))
        toast.success('Invitation cancelled')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to cancel invitation')
      }
    } catch (error) {
      console.error('Failed to cancel invite:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  // Handle resend invite
  const handleResendInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/team/invite?tenantId=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setPendingInvites(pendingInvites.map(i => 
          i.id === inviteId ? { ...i, expiresAt: data.invite.expiresAt } : i
        ))
        toast.success('Invitation resent')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to resend invitation')
      }
    } catch (error) {
      console.error('Failed to resend invite:', error)
      toast.error('Failed to resend invitation')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Team" 
        subtitle="Manage your team members and permissions" 
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">
              {members.length} member{members.length !== 1 ? 's' : ''} • {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canInvite && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          )}
        </div>

        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab}>
          {/* Members Tab */}
          <TabContent value="members" className="outline-none">
            <div className="space-y-4">
              {(loading || sessionLoading) ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : !tenantId ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                  <p className="text-lg font-medium">No workspace selected</p>
                  <p className="text-[var(--muted-foreground)]">
                    Please select a workspace to manage team members
                  </p>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
                  <p className="text-lg font-medium">No team members yet</p>
                  <p className="text-[var(--muted-foreground)]">
                    Invite your first team member to get started
                  </p>
                </div>
              ) : (
                <div className="card divide-y divide-[var(--border)]">
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      canManage={canManage}
                      isOpen={openDropdown === member.id}
                      onToggle={() => setOpenDropdown(openDropdown === member.id ? null : member.id)}
                      onEdit={() => setEditMember(member)}
                      onRemove={() => handleRemoveMember(member.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabContent>

          {/* Invites Tab */}
          <TabContent value="invites" className="outline-none">
            <div className="space-y-4">
              {pendingInvites.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
                  <p className="text-lg font-medium">No pending invites</p>
                  <p className="text-[var(--muted-foreground)]">
                    All invitations have been accepted or expired
                  </p>
                </div>
              ) : (
                <div className="card divide-y divide-[var(--border)]">
                  {pendingInvites.map((invite) => (
                    <InviteRow
                      key={invite.id}
                      invite={invite}
                      canManage={canInvite}
                      onCancel={() => handleCancelInvite(invite.id)}
                      onResend={() => handleResendInvite(invite.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabContent>

          {/* Activity Tab */}
          <TabContent value="activity" className="outline-none">
            <div className="space-y-4">
              {activityLog.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
                  <p className="text-lg font-medium">No activity yet</p>
                  <p className="text-[var(--muted-foreground)]">
                    Team activity will appear here
                  </p>
                </div>
              ) : (
                <div className="card divide-y divide-[var(--border)]">
                  {activityLog.map((log) => (
                    <ActivityRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </TabContent>
        </Tabs>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <InviteModal
            tenantId={tenantId}
            onClose={() => setShowInviteModal(false)}
            onSuccess={(invite) => {
              setPendingInvites([invite, ...pendingInvites])
              setShowInviteModal(false)
              toast.success('Invitation sent!')
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editMember && (
          <EditMemberModal
            tenantId={tenantId}
            member={editMember}
            onClose={() => setEditMember(null)}
            onSuccess={(updated) => {
              setMembers(members.map(m => m.id === updated.id ? { ...m, ...updated } : m))
              setEditMember(null)
              toast.success('Member updated!')
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Member Row Component
// ============================================================================

function MemberRow({
  member,
  canManage,
  isOpen,
  onToggle,
  onEdit,
  onRemove,
}: {
  member: TeamMember
  canManage: boolean
  isOpen: boolean
  onToggle: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const isOwner = member.role === 'OWNER'
  
  return (
    <div className="p-4 flex items-center gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {member.user.image ? (
          <img
            src={member.user.image}
            alt={member.user.name || member.user.email}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-medium">
            {(member.user.name || member.user.email)[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{member.user.name || member.user.email}</p>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', ROLE_COLORS[member.role])}>
            {ROLE_LABELS[member.role]}
          </span>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] truncate">{member.user.email}</p>
        {member.user.lastLoginAt && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Last active: {new Date(member.user.lastLoginAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Actions */}
      {canManage && !isOwner && (
        <div className="relative">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-10"
              >
                <button
                  onClick={() => { onEdit(); onToggle(); }}
                  className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-[var(--muted)] transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Role & Permissions
                </button>
                <button
                  onClick={() => { onRemove(); onToggle(); }}
                  className="w-full px-4 py-2 text-left flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove from Team
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Invite Row Component
// ============================================================================

function InviteRow({
  invite,
  canManage,
  onCancel,
  onResend,
}: {
  invite: PendingInvite
  canManage: boolean
  onCancel: () => void
  onResend: () => void
}) {
  const expiresAt = new Date(invite.expiresAt)
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000

  return (
    <div className="p-4 flex items-center gap-4">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center">
          <Mail className="w-5 h-5 text-[var(--muted-foreground)]" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{invite.email}</p>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', ROLE_COLORS[invite.role])}>
            {ROLE_LABELS[invite.role]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Clock className="w-3 h-3" />
          <span className={isExpiringSoon ? 'text-yellow-600' : ''}>
            Expires {expiresAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          <button
            onClick={onResend}
            className="btn-secondary text-sm py-1"
          >
            <Send className="w-3 h-3 mr-1" />
            Resend
          </button>
          <button
            onClick={onCancel}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Activity Row Component
// ============================================================================

function ActivityRow({ log }: { log: ActivityLog }) {
  return (
    <div className="p-4 flex items-start gap-4">
      <div className="flex-shrink-0">
        {log.actor.image ? (
          <img
            src={log.actor.image}
            alt={log.actor.name || log.actor.email}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-medium">
            {(log.actor.name || log.actor.email)[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{log.actor.name || log.actor.email}</span>
          {' '}
          <span className="text-[var(--muted-foreground)]">
            {ACTION_LABELS[log.action] || log.action}
          </span>
          {log.targetEmail && (
            <>
              {' '}<span className="font-medium">{log.targetEmail}</span>
            </>
          )}
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          {new Date(log.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Invite Modal Component
// ============================================================================

function InviteModal({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: string | null
  onClose: () => void
  onSuccess: (invite: PendingInvite) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'>('OPERATOR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/team/invite?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess(data.invite)
      } else {
        setError(data.error || 'Failed to send invitation')
      }
    } catch (err) {
      setError('Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--card)] rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Invite Team Member</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="input appearance-none pr-10"
              >
                <option value="ADMIN">Administrator</option>
                <option value="MANAGER">Manager</option>
                <option value="OPERATOR">Operator</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)]" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {role === 'ADMIN' && 'Full access to all features, can manage team and billing'}
              {role === 'MANAGER' && 'Manage channels, knowledge base, and view analytics'}
              {role === 'OPERATOR' && 'Respond to conversations and view data'}
              {role === 'VIEWER' && 'Read-only access to data'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invite
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ============================================================================
// Edit Member Modal Component
// ============================================================================

function EditMemberModal({
  tenantId,
  member,
  onClose,
  onSuccess,
}: {
  tenantId: string | null
  member: TeamMember
  onClose: () => void
  onSuccess: (member: Partial<TeamMember>) => void
}) {
  const [role, setRole] = useState(member.role)
  const [permissions, setPermissions] = useState<string[]>(member.permissions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const togglePermission = (perm: string) => {
    setPermissions(
      permissions.includes(perm)
        ? permissions.filter(p => p !== perm)
        : [...permissions, perm]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/team/${member.id}?tenantId=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess(data.member)
      } else {
        setError(data.error || 'Failed to update member')
      }
    } catch (err) {
      setError('Failed to update member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--card)] rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Edit Member</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {member.user.name || member.user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--muted)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="input appearance-none pr-10"
              >
                <option value="ADMIN">Administrator</option>
                <option value="MANAGER">Manager</option>
                <option value="OPERATOR">Operator</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Additional Permissions</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PERMISSION_LABELS).map(([perm, label]) => (
                <label
                  key={perm}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                    permissions.includes(perm)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-[var(--border)] hover:border-primary-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                    className="sr-only"
                  />
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    permissions.includes(perm)
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-[var(--border)]'
                  )}>
                    {permissions.includes(perm) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-xs">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
