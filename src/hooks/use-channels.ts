import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, postData, patchData, deleteData } from '@/lib/api'
import type { Channel, Message, MemoryItem } from '@/types'

// Fetch all channels
export function useChannels() {
  const { data, error, isLoading, mutate } = useSWR<Channel[]>(
    '/channels',
    fetcher
  )

  return {
    channels: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch single channel
export function useChannel(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Channel>(
    id ? `/channels/${id}` : null,
    fetcher
  )

  return {
    channel: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch channel messages/history
export function useChannelHistory(id: string | undefined, limit = 50) {
  const { data, error, isLoading, mutate } = useSWR<Message[]>(
    id ? `/channels/${id}/messages?limit=${limit}` : null,
    fetcher
  )

  return {
    messages: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch channel memory
export function useChannelMemory(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<MemoryItem[]>(
    id ? `/channels/${id}/memory` : null,
    fetcher
  )

  return {
    memory: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Create channel mutation
async function createChannelFn(url: string, { arg }: { arg: Partial<Channel> }) {
  return postData<Channel>(url, arg)
}

export function useCreateChannel() {
  const { trigger, isMutating, error } = useSWRMutation('/channels', createChannelFn)
  
  return {
    createChannel: trigger,
    isCreating: isMutating,
    error,
  }
}

// Update channel mutation
async function updateChannelFn(url: string, { arg }: { arg: Partial<Channel> }) {
  return patchData<Channel>(url, arg)
}

export function useUpdateChannel(id: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    id ? `/channels/${id}` : null,
    updateChannelFn
  )
  
  return {
    updateChannel: trigger,
    isUpdating: isMutating,
    error,
  }
}

// Delete channel mutation
async function deleteChannelFn(url: string) {
  return deleteData(url)
}

export function useDeleteChannel(id: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    id ? `/channels/${id}` : null,
    deleteChannelFn
  )
  
  return {
    deleteChannel: trigger,
    isDeleting: isMutating,
    error,
  }
}

// Mock data for development
export const mockChannels: Channel[] = [
  {
    id: '1',
    name: 'WhatsApp Support',
    type: 'whatsapp',
    status: 'active',
    config: { phoneNumber: '+1234567890' },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    messagesCount: 1247,
    lastActivity: '2024-01-20T15:30:00Z',
  },
  {
    id: '2',
    name: 'Discord Community',
    type: 'discord',
    status: 'active',
    config: { serverId: '123456789' },
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-20T14:00:00Z',
    messagesCount: 3892,
    lastActivity: '2024-01-20T14:00:00Z',
  },
  {
    id: '3',
    name: 'Telegram Alerts',
    type: 'telegram',
    status: 'inactive',
    config: { botToken: 'xxx' },
    createdAt: '2024-01-05T12:00:00Z',
    updatedAt: '2024-01-18T09:00:00Z',
    messagesCount: 456,
    lastActivity: '2024-01-18T09:00:00Z',
  },
  {
    id: '4',
    name: 'API Integration',
    type: 'api',
    status: 'active',
    config: { apiKey: 'sk-xxx' },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-20T16:00:00Z',
    messagesCount: 8234,
    lastActivity: '2024-01-20T16:00:00Z',
  },
  {
    id: '5',
    name: 'Slack Workspace',
    type: 'slack',
    status: 'error',
    config: {},
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-19T11:00:00Z',
    messagesCount: 234,
    lastActivity: '2024-01-19T11:00:00Z',
  },
]
