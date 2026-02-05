import useSWR from 'swr'
import { fetcher } from '@/lib/api'

interface OverviewData {
  messages: {
    total: number
    incoming: number
    outgoing: number
    growth: number
  }
  conversations: {
    started: number
    ended: number
    ongoing: number
  }
  channels: {
    total: number
    active: number
    byType: Record<string, number>
  }
  performance: {
    avgResponseTimeMs: number | null
    p50ResponseTimeMs: number | null
    p95ResponseTimeMs: number | null
    p99ResponseTimeMs: number | null
    resolutionRate: number
    errorRate: number
  }
  costs: {
    total: number
    tokensIn: number
    tokensOut: number
    currency: string
    perMessage: number | null
  }
  satisfaction: {
    positive: number
    negative: number
    score: number | null
  }
  uniqueUsers: number
}

interface TrendActivity {
  date: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  uniqueUsers: number
}

interface ChannelBreakdown {
  channelId: string
  channelName: string
  channelType: string
  messagesIn: number
  messagesOut: number
  cost: number
  avgResponseTimeMs: number | null
  percentage: number
}

interface TrendsData {
  activity: TrendActivity[]
  channelBreakdown: ChannelBreakdown[] | null
  insights: {
    avgDaily: { messages: number; cost: number }
    busiestDay: { date: string; messages: number } | null
    quietestDay: { date: string; messages: number } | null
    peakHour: { hour: number; label: string; messages: number } | null
    totalMessages: number
    totalCost: number
  }
}

interface ActivityItem {
  id: string
  type: 'message' | 'channel_created' | 'channel_updated' | 'error'
  description: string
  channelId: string | null
  channelName: string
  channelType: string | null
  createdAt: string
  data: Record<string, unknown>
}

interface ActivityResponse {
  activity: ActivityItem[]
  total: number
}

/**
 * Hook to fetch all overview data in parallel
 * Combines analytics, trends, and activity into a single state
 */
export function useOverview() {
  // Get date range for last 30 days
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  // Fetch all data in parallel
  const { 
    data: overviewData, 
    error: overviewError,
    isLoading: overviewLoading 
  } = useSWR<OverviewData>(
    `/analytics?start=${startStr}&end=${endStr}`,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  )

  const { 
    data: trendsData, 
    error: trendsError,
    isLoading: trendsLoading 
  } = useSWR<TrendsData>(
    `/analytics/trends?start=${startStr}&end=${endStr}`,
    fetcher,
    { refreshInterval: 60000 }
  )

  const { 
    data: activityData, 
    error: activityError,
    isLoading: activityLoading 
  } = useSWR<ActivityResponse>(
    '/analytics/activity?limit=20',
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  const isLoading = overviewLoading || trendsLoading || activityLoading
  const error = overviewError?.message || trendsError?.message || activityError?.message || null

  return {
    overview: overviewData,
    trends: trendsData,
    activity: activityData?.activity || [],
    isLoading,
    error,
  }
}

/**
 * Hook for just the main analytics metrics
 */
export function useAnalyticsMetrics(days = 30) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  const { data, error, isLoading, mutate } = useSWR<OverviewData>(
    `/analytics?start=${startStr}&end=${endStr}`,
    fetcher
  )

  return {
    metrics: data,
    isLoading,
    error: error?.message || null,
    mutate,
  }
}

/**
 * Hook for trend data (charts)
 */
export function useTrends(days = 30, channelId?: string) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]
  
  let url = `/analytics/trends?start=${startStr}&end=${endStr}`
  if (channelId) {
    url += `&channelId=${channelId}`
  }

  const { data, error, isLoading } = useSWR<TrendsData>(
    url,
    fetcher
  )

  return {
    trends: data,
    isLoading,
    error: error?.message || null,
  }
}

/**
 * Hook for recent activity feed
 */
export function useActivity(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<ActivityResponse>(
    `/analytics/activity?limit=${limit}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  return {
    activity: data?.activity || [],
    isLoading,
    error: error?.message || null,
    mutate,
  }
}
