/**
 * Analytics Library
 * 
 * Provides real-time event tracking, daily aggregation, and metric calculations
 * for BaaS dashboard analytics.
 */

// Event tracking
export {
  trackEvent,
  trackMessageIn,
  trackMessageOut,
  trackConversationStart,
  trackConversationEnd,
  trackHandoffRequest,
  trackHandoffCompleted,
  trackError,
  trackFeedback,
  trackSpecialistInvoked,
  trackEventsBatch,
  type TrackEventInput,
} from './tracker'

// Aggregation
export {
  aggregateDailyStats,
  aggregateHourlyStats,
  aggregateYesterdayForAllTenants,
  cleanupOldEvents,
  cleanupOldHourlyStats,
} from './aggregator'

// Calculations and metrics
export {
  getOverviewMetrics,
  getTrendData,
  getChannelBreakdown,
  getPeakHours,
  getCostBreakdown,
  getUsageSummary,
  exportAnalyticsCSV,
  type OverviewMetrics,
  type TrendData,
  type ChannelBreakdown,
  type PeakHoursData,
  type CostBreakdown,
} from './calculator'
