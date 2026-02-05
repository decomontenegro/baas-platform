/**
 * Notification Scheduler - Quiet Hours & Business Hours Management
 * 
 * Controls when notifications can be sent based on:
 * - Business hours (when to prefer notifications)
 * - Quiet hours (when to block notifications)
 * - Timezone awareness
 * - Critical message exceptions
 */

export interface TimeRange {
  start: string; // HH:mm format (24h)
  end: string;   // HH:mm format (24h)
}

export interface NotificationConfig {
  timezone: string; // IANA timezone (e.g., 'America/Sao_Paulo')
  businessHours: {
    enabled: boolean;
    days: number[];     // 0=Sunday, 1=Monday, ..., 6=Saturday
    hours: TimeRange;   // e.g., { start: '09:00', end: '18:00' }
  };
  quietHours: {
    enabled: boolean;
    hours: TimeRange;   // e.g., { start: '22:00', end: '07:00' }
    weekendAllDay?: boolean; // Block all weekend
  };
  exceptCritical: boolean; // If true, critical notifications bypass quiet hours
}

export interface NotificationContext {
  isCritical?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

interface TimeInfo {
  hours: number;
  minutes: number;
  dayOfWeek: number;
  totalMinutes: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if notifications should be sent right now
 */
export function shouldNotifyNow(
  config: NotificationConfig,
  context: NotificationContext = {}
): boolean {
  const isCritical = context.isCritical || context.priority === 'critical';
  
  // Critical notifications bypass quiet hours if configured
  if (isCritical && config.exceptCritical) {
    return true;
  }
  
  // Check if we're in quiet hours (blocks notifications)
  if (isQuietHours(config)) {
    return false;
  }
  
  // If business hours are enabled, check if we're within them
  if (config.businessHours.enabled) {
    return isWithinBusinessHours(config);
  }
  
  // No restrictions, allow notification
  return true;
}

/**
 * Check if current time is within quiet hours
 */
export function isQuietHours(config: NotificationConfig): boolean {
  if (!config.quietHours.enabled) {
    return false;
  }
  
  const now = getCurrentTimeInfo(config.timezone);
  
  // Check weekend all-day quiet
  if (config.quietHours.weekendAllDay) {
    if (now.dayOfWeek === 0 || now.dayOfWeek === 6) {
      return true;
    }
  }
  
  return isWithinTimeRange(now, config.quietHours.hours);
}

/**
 * Get the next notification window (when notifications will be allowed again)
 * Returns null if notifications are currently allowed
 */
export function getNextNotificationWindow(
  config: NotificationConfig
): Date | null {
  // If we can notify now, no need to wait
  if (shouldNotifyNow(config)) {
    return null;
  }
  
  const now = new Date();
  const nowInfo = getCurrentTimeInfo(config.timezone);
  
  // If in quiet hours, find when they end
  if (isQuietHours(config)) {
    return getQuietHoursEnd(config, now, nowInfo);
  }
  
  // If business hours required but outside them, find next business hours start
  if (config.businessHours.enabled && !isWithinBusinessHours(config)) {
    return getNextBusinessHoursStart(config, now, nowInfo);
  }
  
  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if within business hours
 */
function isWithinBusinessHours(config: NotificationConfig): boolean {
  if (!config.businessHours.enabled) {
    return true;
  }
  
  const now = getCurrentTimeInfo(config.timezone);
  
  // Check if today is a business day
  if (!config.businessHours.days.includes(now.dayOfWeek)) {
    return false;
  }
  
  return isWithinTimeRange(now, config.businessHours.hours);
}

/**
 * Check if time is within a time range (handles overnight ranges)
 */
function isWithinTimeRange(timeInfo: TimeInfo, range: TimeRange): boolean {
  const start = parseTimeToMinutes(range.start);
  const end = parseTimeToMinutes(range.end);
  const current = timeInfo.totalMinutes;
  
  // Normal range (e.g., 09:00 to 18:00)
  if (start <= end) {
    return current >= start && current < end;
  }
  
  // Overnight range (e.g., 22:00 to 07:00)
  return current >= start || current < end;
}

/**
 * Parse HH:mm to total minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time info in the specified timezone
 */
function getCurrentTimeInfo(timezone: string): TimeInfo {
  const now = new Date();
  
  // Get time components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  
  // Get day of week (0-6)
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'narrow'
  });
  const dayStr = dayFormatter.format(now);
  const dayMap: Record<string, number> = { 'S': 0, 'M': 1, 'T': 2, 'W': 3, 'F': 5 };
  // Handle Tuesday vs Thursday ambiguity
  const fullDayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long'
  });
  const fullDay = fullDayFormatter.format(now);
  let dayOfWeek: number;
  
  switch (fullDay) {
    case 'Sunday': dayOfWeek = 0; break;
    case 'Monday': dayOfWeek = 1; break;
    case 'Tuesday': dayOfWeek = 2; break;
    case 'Wednesday': dayOfWeek = 3; break;
    case 'Thursday': dayOfWeek = 4; break;
    case 'Friday': dayOfWeek = 5; break;
    case 'Saturday': dayOfWeek = 6; break;
    default: dayOfWeek = 0;
  }
  
  return {
    hours,
    minutes,
    dayOfWeek,
    totalMinutes: hours * 60 + minutes
  };
}

/**
 * Calculate when quiet hours end
 */
function getQuietHoursEnd(
  config: NotificationConfig,
  now: Date,
  nowInfo: TimeInfo
): Date {
  const result = new Date(now);
  
  // Handle weekend all-day quiet
  if (config.quietHours.weekendAllDay && (nowInfo.dayOfWeek === 0 || nowInfo.dayOfWeek === 6)) {
    // Find next Monday
    const daysUntilMonday = nowInfo.dayOfWeek === 0 ? 1 : 2;
    result.setDate(result.getDate() + daysUntilMonday);
    
    // Set to business hours start or quiet hours end
    const targetTime = config.businessHours.enabled 
      ? config.businessHours.hours.start 
      : config.quietHours.hours.end;
    
    return setTimeInTimezone(result, targetTime, config.timezone);
  }
  
  // Regular quiet hours - find when they end
  const endMinutes = parseTimeToMinutes(config.quietHours.hours.end);
  const startMinutes = parseTimeToMinutes(config.quietHours.hours.start);
  
  // If overnight quiet hours and we're after midnight
  if (startMinutes > endMinutes && nowInfo.totalMinutes < endMinutes) {
    // End is today
    return setTimeInTimezone(result, config.quietHours.hours.end, config.timezone);
  }
  
  // End is tomorrow
  result.setDate(result.getDate() + 1);
  return setTimeInTimezone(result, config.quietHours.hours.end, config.timezone);
}

/**
 * Calculate next business hours start
 */
function getNextBusinessHoursStart(
  config: NotificationConfig,
  now: Date,
  nowInfo: TimeInfo
): Date {
  const result = new Date(now);
  const startMinutes = parseTimeToMinutes(config.businessHours.hours.start);
  
  // Check if we're before business hours today and today is a business day
  if (nowInfo.totalMinutes < startMinutes && config.businessHours.days.includes(nowInfo.dayOfWeek)) {
    return setTimeInTimezone(result, config.businessHours.hours.start, config.timezone);
  }
  
  // Find next business day
  let daysToAdd = 1;
  let nextDay = (nowInfo.dayOfWeek + 1) % 7;
  
  while (!config.businessHours.days.includes(nextDay) && daysToAdd < 8) {
    daysToAdd++;
    nextDay = (nextDay + 1) % 7;
  }
  
  result.setDate(result.getDate() + daysToAdd);
  return setTimeInTimezone(result, config.businessHours.hours.start, config.timezone);
}

/**
 * Set a specific time on a date in a timezone
 */
function setTimeInTimezone(date: Date, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Get the date string in the target timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = dateFormatter.format(date);
  
  // Create ISO string and parse
  const isoString = `${dateStr}T${time.padStart(5, '0')}:00`;
  
  // Create date in the target timezone
  const targetDate = new Date(isoString);
  
  // Adjust for timezone offset
  const utcDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(targetDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();
  
  return new Date(targetDate.getTime() + offset);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get human-readable status
 */
export function getNotificationStatus(config: NotificationConfig): {
  canNotify: boolean;
  reason: string;
  nextWindow: Date | null;
  nextWindowFormatted: string | null;
} {
  const canNotify = shouldNotifyNow(config);
  const nextWindow = getNextNotificationWindow(config);
  
  let reason: string;
  if (canNotify) {
    reason = 'Notifications are allowed';
  } else if (isQuietHours(config)) {
    reason = 'Currently in quiet hours';
  } else {
    reason = 'Outside business hours';
  }
  
  let nextWindowFormatted: string | null = null;
  if (nextWindow) {
    nextWindowFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: config.timezone,
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(nextWindow);
  }
  
  return {
    canNotify,
    reason,
    nextWindow,
    nextWindowFormatted
  };
}

/**
 * Create a default notification config
 */
export function createDefaultConfig(timezone: string = 'America/Sao_Paulo'): NotificationConfig {
  return {
    timezone,
    businessHours: {
      enabled: true,
      days: [1, 2, 3, 4, 5], // Monday to Friday
      hours: { start: '09:00', end: '18:00' }
    },
    quietHours: {
      enabled: true,
      hours: { start: '22:00', end: '08:00' },
      weekendAllDay: false
    },
    exceptCritical: true
  };
}

/**
 * Validate a notification config
 */
export function validateConfig(config: NotificationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: config.timezone });
  } catch {
    errors.push(`Invalid timezone: ${config.timezone}`);
  }
  
  // Validate time formats
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (config.businessHours.enabled) {
    if (!timeRegex.test(config.businessHours.hours.start)) {
      errors.push(`Invalid business hours start: ${config.businessHours.hours.start}`);
    }
    if (!timeRegex.test(config.businessHours.hours.end)) {
      errors.push(`Invalid business hours end: ${config.businessHours.hours.end}`);
    }
    if (!config.businessHours.days.every(d => d >= 0 && d <= 6)) {
      errors.push('Business days must be 0-6 (Sunday-Saturday)');
    }
  }
  
  if (config.quietHours.enabled) {
    if (!timeRegex.test(config.quietHours.hours.start)) {
      errors.push(`Invalid quiet hours start: ${config.quietHours.hours.start}`);
    }
    if (!timeRegex.test(config.quietHours.hours.end)) {
      errors.push(`Invalid quiet hours end: ${config.quietHours.hours.end}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
