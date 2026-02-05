import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import useSWRInfinite from 'swr/infinite'
import { fetcher, postData, patchData, deleteData } from '@/lib/api'
import type {
  Conversation,
  ConversationWithDetails,
  ConversationMessage,
  ConversationNote,
  ConversationsResponse,
  MessagesResponse,
  ConversationStats,
  ConversationFilters,
} from '@/types'

// Build query string from filters
function buildQueryString(filters: ConversationFilters & { page?: number; limit?: number }): string {
  const params = new URLSearchParams()
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  
  return params.toString()
}

// ============================================================================
// LIST CONVERSATIONS
// ============================================================================

export function useConversations(filters: ConversationFilters = {}, page = 1, limit = 20) {
  const queryString = buildQueryString({ ...filters, page, limit })
  
  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    `/conversations?${queryString}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  )

  return {
    conversations: data?.conversations || [],
    pagination: data?.pagination,
    filters: data?.filters,
    isLoading,
    isError: error,
    mutate,
  }
}

// ============================================================================
// INFINITE SCROLL CONVERSATIONS
// ============================================================================

export function useConversationsInfinite(filters: ConversationFilters = {}, limit = 20) {
  const getKey = (pageIndex: number, previousPageData: ConversationsResponse | null) => {
    // Reached the end
    if (previousPageData && !previousPageData.conversations.length) return null
    
    const queryString = buildQueryString({ ...filters, page: pageIndex + 1, limit })
    return `/conversations?${queryString}`
  }

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<ConversationsResponse>(
    getKey,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  )

  const conversations = data ? data.flatMap((page) => page.conversations) : []
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isEmpty = data?.[0]?.conversations.length === 0
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.conversations.length < limit)
  const total = data?.[0]?.pagination.total || 0

  return {
    conversations,
    total,
    isLoading,
    isLoadingMore,
    isError: error,
    isReachingEnd,
    isValidating,
    size,
    setSize,
    mutate,
    loadMore: () => setSize(size + 1),
  }
}

// ============================================================================
// SINGLE CONVERSATION
// ============================================================================

export function useConversation(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<{
    conversation: ConversationWithDetails
    stats: ConversationStats
  }>(
    id ? `/conversations/${id}` : null,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds for active conversations
    }
  )

  return {
    conversation: data?.conversation,
    stats: data?.stats,
    isLoading,
    isError: error,
    mutate,
  }
}

// ============================================================================
// CONVERSATION MESSAGES
// ============================================================================

export function useConversationMessages(conversationId: string | undefined, limit = 50) {
  const getKey = (pageIndex: number, previousPageData: MessagesResponse | null) => {
    if (!conversationId) return null
    // Reached the end
    if (previousPageData && !previousPageData.pagination.hasMore) return null
    
    return `/conversations/${conversationId}/messages?page=${pageIndex + 1}&limit=${limit}`
  }

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<MessagesResponse>(
    getKey,
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5 seconds for real-time feel
      revalidateOnFocus: true,
    }
  )

  const messages = data ? data.flatMap((page) => page.messages) : []
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isEmpty = data?.[0]?.messages.length === 0
  const hasMore = data?.[data.length - 1]?.pagination.hasMore ?? false
  const total = data?.[0]?.pagination.total || 0

  return {
    messages,
    total,
    isLoading,
    isLoadingMore,
    isError: error,
    hasMore,
    isValidating,
    size,
    setSize,
    mutate,
    loadMore: () => setSize(size + 1),
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

// Update conversation
async function updateConversationFn(
  url: string,
  { arg }: { arg: Partial<Conversation> }
) {
  return patchData<{ conversation: Conversation }>(url, arg)
}

export function useUpdateConversation(id: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    id ? `/conversations/${id}` : null,
    updateConversationFn
  )

  return {
    updateConversation: trigger,
    isUpdating: isMutating,
    error,
  }
}

// Delete/Archive conversation
async function deleteConversationFn(url: string) {
  return deleteData(url)
}

export function useDeleteConversation(id: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    id ? `/conversations/${id}` : null,
    deleteConversationFn
  )

  return {
    deleteConversation: trigger,
    isDeleting: isMutating,
    error,
  }
}

// Add note
async function addNoteFn(url: string, { arg }: { arg: { content: string } }) {
  return postData<{ note: ConversationNote }>(url, arg)
}

export function useAddNote(conversationId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    conversationId ? `/conversations/${conversationId}/note` : null,
    addNoteFn
  )

  return {
    addNote: trigger,
    isAdding: isMutating,
    error,
  }
}

// Add/Remove tag
async function updateTagFn(
  url: string,
  { arg }: { arg: { tag: string; action: 'add' | 'remove' } }
) {
  return postData<{ tags: string[]; modified: boolean }>(url, arg)
}

export function useUpdateTag(conversationId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    conversationId ? `/conversations/${conversationId}/tag` : null,
    updateTagFn
  )

  return {
    updateTag: trigger,
    isUpdating: isMutating,
    error,
  }
}

// Send message (operator message)
async function sendMessageFn(
  url: string,
  { arg }: { arg: { content: string; role?: 'OPERATOR' } }
) {
  return postData<{ message: ConversationMessage }>(url, {
    ...arg,
    role: arg.role || 'OPERATOR',
    contentType: 'TEXT',
  })
}

export function useSendMessage(conversationId: string | undefined) {
  const { trigger, isMutating, error } = useSWRMutation(
    conversationId ? `/conversations/${conversationId}/messages` : null,
    sendMessageFn
  )

  return {
    sendMessage: trigger,
    isSending: isMutating,
    error,
  }
}
