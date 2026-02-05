import useSWR from 'swr'
import { fetcher } from '@/lib/api'

interface ChannelsResponse {
  channels: Array<{
    id: string
    name: string
    type: string
    status: string
    workspace?: { id: string; name: string }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface WorkspacesResponse {
  workspaces: Array<{
    id: string
    name: string
    description?: string
    _count?: { channels: number }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface TeamMember {
  id: string
  userId: string
  role: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface TeamResponse {
  members: TeamMember[]
  pendingInvites: Array<unknown>
  activityLog: Array<unknown>
  currentUserPermissions: string[]
}

// ============================================================================
// CHANNELS
// ============================================================================

export function useChannels(workspaceId?: string) {
  const queryParams = workspaceId ? `?workspaceId=${workspaceId}&limit=100` : '?limit=100'
  
  const { data, error, isLoading, mutate } = useSWR<ChannelsResponse>(
    `/channels${queryParams}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  return {
    channels: data?.channels || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// ============================================================================
// WORKSPACES
// ============================================================================

export function useWorkspaces() {
  const { data, error, isLoading, mutate } = useSWR<WorkspacesResponse>(
    '/workspaces?limit=100',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  return {
    workspaces: data?.workspaces || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// ============================================================================
// TEAM MEMBERS (Operators)
// ============================================================================

export function useTeamMembers(tenantId?: string) {
  const queryParams = tenantId ? `?tenantId=${tenantId}` : ''
  
  const { data, error, isLoading, mutate } = useSWR<TeamResponse>(
    tenantId ? `/team${queryParams}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  // Filter to only OPERATOR and MANAGER roles (those who can handle conversations)
  const operators = (data?.members || [])
    .filter(m => ['OPERATOR', 'MANAGER', 'ADMIN'].includes(m.role))
    .map(m => ({
      id: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
    }))

  return {
    operators,
    allMembers: data?.members || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// ============================================================================
// COMBINED FILTER DATA
// ============================================================================

export function useConversationFilterData() {
  const { channels, isLoading: isLoadingChannels } = useChannels()
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces()

  return {
    channels: channels.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
    workspaces: workspaces.map(w => ({
      id: w.id,
      name: w.name,
    })),
    isLoading: isLoadingChannels || isLoadingWorkspaces,
  }
}
