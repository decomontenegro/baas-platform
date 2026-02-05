'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  HandoffRequest,
  HandoffRule,
  HandoffSettings,
  HandoffQueueStats,
  HandoffStatus,
  HandoffPriority,
} from '@/types/handoff'

interface UseHandoffQueueOptions {
  workspaceId?: string
  status?: HandoffStatus | HandoffStatus[]
  priority?: HandoffPriority
  assignedTo?: string
  channelId?: string
  page?: number
  limit?: number
  pollInterval?: number // in milliseconds, 0 to disable
}

interface UseHandoffQueueResult {
  requests: HandoffRequest[]
  stats: HandoffQueueStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useHandoffQueue(options: UseHandoffQueueOptions = {}): UseHandoffQueueResult {
  const {
    workspaceId,
    status,
    priority,
    assignedTo,
    channelId,
    page = 1,
    limit = 20,
    pollInterval = 30000, // 30 seconds default
  } = options

  const [requests, setRequests] = useState<HandoffRequest[]>([])
  const [stats, setStats] = useState<HandoffQueueStats>({
    pending: 0,
    assigned: 0,
    inProgress: 0,
    onHold: 0,
    resolved: 0,
    total: 0,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (workspaceId) params.set('workspaceId', workspaceId)
      if (status) {
        if (Array.isArray(status)) {
          status.forEach((s) => params.append('status', s))
        } else {
          params.set('status', status)
        }
      }
      if (priority) params.set('priority', priority)
      if (assignedTo) params.set('assignedTo', assignedTo)
      if (channelId) params.set('channelId', channelId)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const response = await fetch(`/api/handoff/queue?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch handoff queue')
      }

      const data = await response.json()
      setRequests(data.requests)
      setStats(data.stats)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, status, priority, assignedTo, channelId, page, limit])

  useEffect(() => {
    fetchQueue()

    if (pollInterval > 0) {
      const interval = setInterval(fetchQueue, pollInterval)
      return () => clearInterval(interval)
    }
  }, [fetchQueue, pollInterval])

  return {
    requests,
    stats,
    pagination,
    isLoading,
    error,
    refetch: fetchQueue,
  }
}

interface UseHandoffRequestResult {
  request: HandoffRequest | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  assign: (userId: string) => Promise<void>
  unassign: () => Promise<void>
  resolve: (note?: string, returnToBot?: boolean) => Promise<void>
  addNote: (content: string, isInternal?: boolean) => Promise<void>
  updatePriority: (priority: HandoffPriority) => Promise<void>
}

export function useHandoffRequest(id: string): UseHandoffRequestResult {
  const [request, setRequest] = useState<HandoffRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchRequest = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/handoff/${id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch handoff request')
      }

      const data = await response.json()
      setRequest(data.handoffRequest)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchRequest()
    }
  }, [id, fetchRequest])

  const assign = useCallback(async (userId: string) => {
    const response = await fetch(`/api/handoff/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignTo: userId }),
    })

    if (!response.ok) {
      throw new Error('Failed to assign handoff')
    }

    await fetchRequest()
  }, [id, fetchRequest])

  const unassign = useCallback(async () => {
    const response = await fetch(`/api/handoff/${id}/assign`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to unassign handoff')
    }

    await fetchRequest()
  }, [id, fetchRequest])

  const resolve = useCallback(async (note?: string, returnToBot = true) => {
    const response = await fetch(`/api/handoff/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNote: note, returnToBot }),
    })

    if (!response.ok) {
      throw new Error('Failed to resolve handoff')
    }

    await fetchRequest()
  }, [id, fetchRequest])

  const addNote = useCallback(async (content: string, isInternal = true) => {
    const response = await fetch(`/api/handoff/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, isInternal }),
    })

    if (!response.ok) {
      throw new Error('Failed to add note')
    }

    await fetchRequest()
  }, [id, fetchRequest])

  const updatePriority = useCallback(async (priority: HandoffPriority) => {
    const response = await fetch(`/api/handoff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    })

    if (!response.ok) {
      throw new Error('Failed to update priority')
    }

    await fetchRequest()
  }, [id, fetchRequest])

  return {
    request,
    isLoading,
    error,
    refetch: fetchRequest,
    assign,
    unassign,
    resolve,
    addNote,
    updatePriority,
  }
}

interface UseHandoffRulesResult {
  rules: HandoffRule[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  createRule: (data: Partial<HandoffRule>) => Promise<HandoffRule>
  updateRule: (id: string, data: Partial<HandoffRule>) => Promise<HandoffRule>
  deleteRule: (id: string) => Promise<void>
  toggleRule: (id: string, isActive: boolean) => Promise<void>
}

export function useHandoffRules(workspaceId?: string): UseHandoffRulesResult {
  const [rules, setRules] = useState<HandoffRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (workspaceId) params.set('workspaceId', workspaceId)

      const response = await fetch(`/api/handoff/rules?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch handoff rules')
      }

      const data = await response.json()
      setRules(data.rules)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const createRule = useCallback(async (data: Partial<HandoffRule>): Promise<HandoffRule> => {
    const response = await fetch('/api/handoff/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create rule')
    }

    const result = await response.json()
    await fetchRules()
    return result.rule
  }, [fetchRules])

  const updateRule = useCallback(async (id: string, data: Partial<HandoffRule>): Promise<HandoffRule> => {
    const response = await fetch(`/api/handoff/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to update rule')
    }

    const result = await response.json()
    await fetchRules()
    return result.rule
  }, [fetchRules])

  const deleteRule = useCallback(async (id: string) => {
    const response = await fetch(`/api/handoff/rules/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete rule')
    }

    await fetchRules()
  }, [fetchRules])

  const toggleRule = useCallback(async (id: string, isActive: boolean) => {
    await updateRule(id, { isActive })
  }, [updateRule])

  return {
    rules,
    isLoading,
    error,
    refetch: fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  }
}

interface UseHandoffSettingsResult {
  settings: HandoffSettings | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateSettings: (data: Partial<HandoffSettings>) => Promise<void>
}

export function useHandoffSettings(workspaceId: string): UseHandoffSettingsResult {
  const [settings, setSettings] = useState<HandoffSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/handoff/settings?workspaceId=${workspaceId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch handoff settings')
      }

      const data = await response.json()
      setSettings(data.settings)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) {
      fetchSettings()
    }
  }, [workspaceId, fetchSettings])

  const updateSettings = useCallback(async (data: Partial<HandoffSettings>) => {
    const response = await fetch(`/api/handoff/settings?workspaceId=${workspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to update settings')
    }

    await fetchSettings()
  }, [workspaceId, fetchSettings])

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
    updateSettings,
  }
}
