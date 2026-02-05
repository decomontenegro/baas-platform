/**
 * Admin Agent - Cache Service
 * 
 * Redis-based caching with in-memory fallback for bot health and general caching.
 */

import Redis from 'ioredis'

// ============================================================================
// Types
// ============================================================================

interface BotHealthCacheEntry {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DEAD'
  latencyMs?: number
  memoryMb?: number
  error?: string
  checkedAt: number
}

interface InMemoryCacheEntry<T> {
  value: T
  expiresAt: number
}

// ============================================================================
// Redis Connection
// ============================================================================

let redis: Redis | null = null
let redisAvailable = false

function getRedisClient(): Redis | null {
  if (redis) return redis
  
  const redisUrl = process.env.REDIS_URL
  
  if (!redisUrl) {
    console.warn('[Cache] REDIS_URL not configured, using in-memory fallback')
    return null
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Cache] Redis connection failed, switching to in-memory fallback')
          redisAvailable = false
          return null // Stop retrying
        }
        return Math.min(times * 200, 1000)
      },
      lazyConnect: true,
      connectTimeout: 5000,
    })
    
    redis.on('connect', () => {
      redisAvailable = true
      console.log('[Cache] Redis connected')
    })
    
    redis.on('error', (err) => {
      console.warn('[Cache] Redis error:', err.message)
      redisAvailable = false
    })
    
    redis.on('close', () => {
      redisAvailable = false
    })
    
    // Attempt connection
    redis.connect().catch(() => {
      redisAvailable = false
    })
    
    return redis
  } catch (error) {
    console.warn('[Cache] Failed to create Redis client:', error)
    return null
  }
}

// ============================================================================
// In-Memory Fallback
// ============================================================================

const memoryCache = new Map<string, InMemoryCacheEntry<unknown>>()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  Array.from(memoryCache.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key)
    }
  })
}, 5 * 60 * 1000)

function memoryGet<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key)
    return null
  }
  
  return entry.value as T
}

function memorySet<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  })
}

function memoryDelete(pattern: string): number {
  let deleted = 0
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
  
  Array.from(memoryCache.keys()).forEach((key) => {
    if (regex.test(key)) {
      memoryCache.delete(key)
      deleted++
    }
  })
  
  return deleted
}

// ============================================================================
// Cache Key Prefixes
// ============================================================================

const CACHE_PREFIX = 'admin-agent:'
const BOT_HEALTH_PREFIX = `${CACHE_PREFIX}bot-health:`

// Default TTLs (in seconds)
const DEFAULT_TTL = 300 // 5 minutes
const BOT_HEALTH_TTL = 60 // 1 minute

// ============================================================================
// Generic Cache Functions
// ============================================================================

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const fullKey = `${CACHE_PREFIX}${key}`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      const value = await client.get(fullKey)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      console.warn('[Cache] Redis get error, falling back to memory:', error)
    }
  }
  
  return memoryGet<T>(fullKey)
}

/**
 * Set a value in cache with optional TTL
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  const fullKey = `${CACHE_PREFIX}${key}`
  const serialized = JSON.stringify(value)
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      await client.setex(fullKey, ttlSeconds, serialized)
      return
    } catch (error) {
      console.warn('[Cache] Redis set error, falling back to memory:', error)
    }
  }
  
  memorySet(fullKey, value, ttlSeconds)
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const fullKey = `${CACHE_PREFIX}${key}`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      const result = await client.del(fullKey)
      return result > 0
    } catch (error) {
      console.warn('[Cache] Redis delete error, falling back to memory:', error)
    }
  }
  
  const existed = memoryCache.has(fullKey)
  memoryCache.delete(fullKey)
  return existed
}

/**
 * Invalidate cache entries matching a pattern
 * Pattern supports * as wildcard (e.g., "tenant:abc:*")
 */
export async function invalidateCache(pattern: string): Promise<number> {
  const fullPattern = `${CACHE_PREFIX}${pattern}`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      const keys = await client.keys(fullPattern)
      if (keys.length === 0) return 0
      
      const result = await client.del(...keys)
      return result
    } catch (error) {
      console.warn('[Cache] Redis invalidate error, falling back to memory:', error)
    }
  }
  
  return memoryDelete(fullPattern)
}

// ============================================================================
// Bot Health Cache Functions
// ============================================================================

/**
 * Cache bot health status
 */
export async function cacheBotHealth(
  botId: string, 
  status: BotHealthCacheEntry
): Promise<void> {
  const key = `${BOT_HEALTH_PREFIX}${botId}`
  const entry: BotHealthCacheEntry = {
    ...status,
    checkedAt: Date.now()
  }
  
  const serialized = JSON.stringify(entry)
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      await client.setex(key, BOT_HEALTH_TTL, serialized)
      return
    } catch (error) {
      console.warn('[Cache] Redis cacheBotHealth error, falling back to memory:', error)
    }
  }
  
  memorySet(key, entry, BOT_HEALTH_TTL)
}

/**
 * Get cached bot health status
 */
export async function getCachedBotHealth(
  botId: string
): Promise<BotHealthCacheEntry | null> {
  const key = `${BOT_HEALTH_PREFIX}${botId}`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      const value = await client.get(key)
      if (!value) return null
      return JSON.parse(value) as BotHealthCacheEntry
    } catch (error) {
      console.warn('[Cache] Redis getCachedBotHealth error, falling back to memory:', error)
    }
  }
  
  return memoryGet<BotHealthCacheEntry>(key)
}

/**
 * Get all cached bot health statuses for a tenant
 */
export async function getAllCachedBotHealth(): Promise<Map<string, BotHealthCacheEntry>> {
  const results = new Map<string, BotHealthCacheEntry>()
  const pattern = `${BOT_HEALTH_PREFIX}*`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      const keys = await client.keys(pattern)
      if (keys.length === 0) return results
      
      const values = await client.mget(...keys)
      
      keys.forEach((key, index) => {
        const value = values[index]
        if (value) {
          const botId = key.replace(BOT_HEALTH_PREFIX, '')
          results.set(botId, JSON.parse(value))
        }
      })
      
      return results
    } catch (error) {
      console.warn('[Cache] Redis getAllCachedBotHealth error, falling back to memory:', error)
    }
  }
  
  // Fallback to memory
  const now = Date.now()
  Array.from(memoryCache.entries()).forEach(([key, entry]) => {
    if (key.startsWith(BOT_HEALTH_PREFIX) && entry.expiresAt > now) {
      const botId = key.replace(BOT_HEALTH_PREFIX, '')
      results.set(botId, entry.value as BotHealthCacheEntry)
    }
  })
  
  return results
}

/**
 * Invalidate health cache for a specific bot
 */
export async function invalidateBotHealthCache(botId: string): Promise<void> {
  const key = `${BOT_HEALTH_PREFIX}${botId}`
  const client = getRedisClient()
  
  if (client && redisAvailable) {
    try {
      await client.del(key)
      return
    } catch (error) {
      console.warn('[Cache] Redis invalidateBotHealthCache error:', error)
    }
  }
  
  memoryCache.delete(key)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Redis is currently available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  backend: 'redis' | 'memory'
  memoryEntries: number
  redisConnected: boolean
}> {
  return {
    backend: redisAvailable ? 'redis' : 'memory',
    memoryEntries: memoryCache.size,
    redisConnected: redisAvailable
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeCacheConnection(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    redisAvailable = false
  }
}

// ============================================================================
// Exports
// ============================================================================

export type { BotHealthCacheEntry }
