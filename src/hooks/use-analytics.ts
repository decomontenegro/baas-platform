import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import type { Analytics, DailyStats, ActivityItem, ChannelBreakdown } from '@/types'

// Fetch dashboard analytics
export function useAnalytics() {
  const { data, error, isLoading, mutate } = useSWR<Analytics>(
    '/analytics',
    fetcher
  )

  return {
    analytics: data,
    isLoading,
    isError: error,
    mutate,
  }
}

// Fetch daily stats for charts
export function useDailyStats(days = 30) {
  const { data, error, isLoading } = useSWR<DailyStats[]>(
    `/analytics/daily?days=${days}`,
    fetcher
  )

  return {
    stats: data || [],
    isLoading,
    isError: error,
  }
}

// Fetch recent activity feed
export function useRecentActivity(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<ActivityItem[]>(
    `/analytics/activity?limit=${limit}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  return {
    activity: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

// Mock data for development
export const mockAnalytics: Analytics = {
  totalMessages: 13829,
  totalChannels: 5,
  activeChannels: 3,
  avgResponseTime: 1.2,
  messagesPerDay: generateMockDailyStats(30),
  channelBreakdown: [
    { type: 'whatsapp', count: 3500, percentage: 25 },
    { type: 'discord', count: 5600, percentage: 40 },
    { type: 'telegram', count: 1400, percentage: 10 },
    { type: 'api', count: 2800, percentage: 20 },
    { type: 'slack', count: 529, percentage: 5 },
  ],
  recentActivity: generateMockActivity(),
}

function generateMockDailyStats(days: number): DailyStats[] {
  const stats: DailyStats[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    stats.push({
      date: date.toISOString().split('T')[0],
      messages: Math.floor(Math.random() * 500) + 200,
      users: Math.floor(Math.random() * 50) + 10,
    })
  }
  
  return stats
}

function generateMockActivity(): ActivityItem[] {
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'message',
      description: 'New conversation started',
      channelId: '1',
      channelName: 'WhatsApp Support',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      type: 'message',
      description: 'User inquiry handled',
      channelId: '2',
      channelName: 'Discord Community',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      type: 'channel_updated',
      description: 'Channel configuration updated',
      channelId: '4',
      channelName: 'API Integration',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      type: 'error',
      description: 'Connection lost - attempting reconnect',
      channelId: '5',
      channelName: 'Slack Workspace',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      type: 'channel_created',
      description: 'New channel created',
      channelId: '3',
      channelName: 'Telegram Alerts',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6',
      type: 'message',
      description: 'Support ticket resolved',
      channelId: '1',
      channelName: 'WhatsApp Support',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ]
  
  return activities
}

// Stats for sparklines
export function generateSparklineData(length = 7): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 100) + 20)
}
