/**
 * Health Checker Tests
 * 
 * Unit tests for the Admin Agent health checking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BotHealthStatus, AdminAlertSeverity, AdminAlertType } from '@prisma/client'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    adminAgent: {
      findUnique: vi.fn(),
    },
    botHealthLog: {
      create: vi.fn(),
    },
    adminAlert: {
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  checkBotHealth,
  runHealthCheckCycle,
  createAlert,
  logHealthCheck,
  checkAllBotsHealth,
} from '../health-checker'

// Type the mocked prisma for better autocomplete
const mockedPrisma = vi.mocked(prisma)

describe('Health Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkBotHealth', () => {
    it('returns HEALTHY status for enabled bot with fast response', async () => {
      const mockBot = {
        id: 'bot-123',
        isEnabled: true,
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      }

      mockedPrisma.bot.findUnique.mockResolvedValue(mockBot as any)

      const result = await checkBotHealth('bot-123')

      expect(result.botId).toBe('bot-123')
      expect(result.status).toBe('HEALTHY')
      expect(result.latencyMs).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('returns DEAD status when bot is not found', async () => {
      mockedPrisma.bot.findUnique.mockResolvedValue(null)

      const result = await checkBotHealth('non-existent-bot')

      expect(result.botId).toBe('non-existent-bot')
      expect(result.status).toBe('DEAD')
      expect(result.error).toBe('Bot not found')
    })

    it('returns DEAD status for disabled bot', async () => {
      const mockBot = {
        id: 'bot-123',
        isEnabled: false,
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      }

      mockedPrisma.bot.findUnique.mockResolvedValue(mockBot as any)

      const result = await checkBotHealth('bot-123')

      expect(result.botId).toBe('bot-123')
      expect(result.status).toBe('DEAD')
    })

    it('returns UNHEALTHY status when database query fails', async () => {
      mockedPrisma.bot.findUnique.mockRejectedValue(new Error('Database connection failed'))

      const result = await checkBotHealth('bot-123')

      expect(result.botId).toBe('bot-123')
      expect(result.status).toBe('UNHEALTHY')
      expect(result.error).toBe('Database connection failed')
      expect(result.latencyMs).toBeDefined()
    })

    it('returns DEGRADED status when latency exceeds 5000ms', async () => {
      const mockBot = {
        id: 'bot-123',
        isEnabled: true,
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      }

      // Simulate slow response by advancing time
      mockedPrisma.bot.findUnique.mockImplementation(async () => {
        vi.advanceTimersByTime(6000) // Advance 6 seconds
        return mockBot as any
      })

      const result = await checkBotHealth('bot-123')

      expect(result.botId).toBe('bot-123')
      expect(result.status).toBe('DEGRADED')
      expect(result.latencyMs).toBeGreaterThan(5000)
    })
  })

  describe('runHealthCheckCycle', () => {
    it('returns zeros when admin agent is not found', async () => {
      mockedPrisma.adminAgent.findUnique.mockResolvedValue(null)

      const result = await runHealthCheckCycle('tenant-1')

      expect(result).toEqual({
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        dead: 0,
        actions: [],
      })
    })

    it('returns zeros when admin agent is not active', async () => {
      mockedPrisma.adminAgent.findUnique.mockResolvedValue({
        id: 'admin-1',
        tenantId: 'tenant-1',
        status: 'PAUSED',
      } as any)

      const result = await runHealthCheckCycle('tenant-1')

      expect(result).toEqual({
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        dead: 0,
        actions: [],
      })
    })

    it('processes all bots and counts statuses correctly', async () => {
      const mockAdminAgent = {
        id: 'admin-1',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        autoRestartEnabled: false,
      }

      const mockBots = [
        { id: 'bot-1', tenantId: 'tenant-1', isEnabled: true },
        { id: 'bot-2', tenantId: 'tenant-1', isEnabled: true },
        { id: 'bot-3', tenantId: 'tenant-1', isEnabled: false }, // Will be DEAD
      ]

      mockedPrisma.adminAgent.findUnique.mockResolvedValue(mockAdminAgent as any)
      mockedPrisma.bot.findMany.mockResolvedValue(mockBots as any)
      mockedPrisma.bot.findUnique.mockImplementation(async ({ where }) => {
        const bot = mockBots.find(b => b.id === where.id)
        return bot ? { ...bot, tenant: { id: 'tenant-1' } } : null
      } as any)
      mockedPrisma.botHealthLog.create.mockResolvedValue({} as any)

      const result = await runHealthCheckCycle('tenant-1')

      expect(result.healthy).toBe(2)
      expect(result.dead).toBe(1)
      expect(result.actions).toEqual([])
      
      // Verify health logs were created for all bots
      expect(mockedPrisma.botHealthLog.create).toHaveBeenCalledTimes(3)
    })

    it('attempts restart for unhealthy bots when autoRestart is enabled', async () => {
      const mockAdminAgent = {
        id: 'admin-1',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        autoRestartEnabled: true,
      }

      const mockBots = [
        { id: 'bot-1', tenantId: 'tenant-1', isEnabled: false }, // DEAD bot
      ]

      mockedPrisma.adminAgent.findUnique.mockResolvedValue(mockAdminAgent as any)
      mockedPrisma.bot.findMany.mockResolvedValue(mockBots as any)
      mockedPrisma.bot.findUnique.mockResolvedValue({
        ...mockBots[0],
        tenant: { id: 'tenant-1' },
      } as any)
      mockedPrisma.bot.update.mockResolvedValue({} as any)
      mockedPrisma.botHealthLog.create.mockResolvedValue({} as any)

      // Use real timers for this test since it uses setTimeout
      vi.useRealTimers()

      const result = await runHealthCheckCycle('tenant-1')

      expect(result.dead).toBe(1)
      expect(result.actions.length).toBe(1)
      expect(result.actions[0]).toContain('Attempted restart of bot bot-1')
      
      // Verify bot update was called (restart logic)
      expect(mockedPrisma.bot.update).toHaveBeenCalled()
    })

    it('creates alert for degraded bots', async () => {
      const mockAdminAgent = {
        id: 'admin-1',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        autoRestartEnabled: false,
      }

      const mockBot = { id: 'bot-1', tenantId: 'tenant-1', isEnabled: true }

      mockedPrisma.adminAgent.findUnique.mockResolvedValue(mockAdminAgent as any)
      mockedPrisma.bot.findMany.mockResolvedValue([mockBot] as any)
      
      // Simulate slow response
      mockedPrisma.bot.findUnique.mockImplementation(async () => {
        vi.advanceTimersByTime(6000)
        return { ...mockBot, tenant: { id: 'tenant-1' } } as any
      })
      mockedPrisma.botHealthLog.create.mockResolvedValue({} as any)
      mockedPrisma.adminAlert.create.mockResolvedValue({} as any)

      const result = await runHealthCheckCycle('tenant-1')

      expect(result.degraded).toBe(1)
      expect(mockedPrisma.adminAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAgentId: 'admin-1',
          botId: 'bot-1',
          type: 'BOT_SLOW',
          severity: 'WARNING',
        }),
      })
    })
  })

  describe('createAlert', () => {
    it('creates alert with correct severity and type', async () => {
      mockedPrisma.adminAlert.create.mockResolvedValue({
        id: 'alert-1',
        adminAgentId: 'admin-1',
        botId: 'bot-1',
        type: 'BOT_DOWN',
        severity: 'CRITICAL',
        title: 'Bot não responde',
        message: 'O bot não está funcionando',
      } as any)

      await createAlert(
        'admin-1',
        'bot-1',
        'BOT_DOWN' as AdminAlertType,
        'CRITICAL' as AdminAlertSeverity,
        'Bot não responde',
        'O bot não está funcionando'
      )

      expect(mockedPrisma.adminAlert.create).toHaveBeenCalledWith({
        data: {
          adminAgentId: 'admin-1',
          botId: 'bot-1',
          type: 'BOT_DOWN',
          severity: 'CRITICAL',
          title: 'Bot não responde',
          message: 'O bot não está funcionando',
        },
      })
    })

    it('creates WARNING severity alert correctly', async () => {
      mockedPrisma.adminAlert.create.mockResolvedValue({} as any)

      await createAlert(
        'admin-1',
        'bot-1',
        'BOT_SLOW' as AdminAlertType,
        'WARNING' as AdminAlertSeverity,
        'Bot com lentidão',
        'Latência alta detectada'
      )

      expect(mockedPrisma.adminAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'WARNING',
          type: 'BOT_SLOW',
        }),
      })
    })

    it('creates INFO severity alert correctly', async () => {
      mockedPrisma.adminAlert.create.mockResolvedValue({} as any)

      await createAlert(
        'admin-1',
        'bot-1',
        'BOT_RECOVERED' as AdminAlertType,
        'INFO' as AdminAlertSeverity,
        'Bot recuperado',
        'O bot voltou a funcionar normalmente'
      )

      expect(mockedPrisma.adminAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'INFO',
          type: 'BOT_RECOVERED',
        }),
      })
    })
  })

  describe('logHealthCheck', () => {
    it('logs health check result to database', async () => {
      mockedPrisma.botHealthLog.create.mockResolvedValue({} as any)

      await logHealthCheck('admin-1', {
        botId: 'bot-1',
        status: 'HEALTHY',
        latencyMs: 150,
      })

      expect(mockedPrisma.botHealthLog.create).toHaveBeenCalledWith({
        data: {
          adminAgentId: 'admin-1',
          botId: 'bot-1',
          status: 'HEALTHY',
          latencyMs: 150,
          error: undefined,
          action: undefined,
          actionResult: undefined,
        },
      })
    })

    it('logs health check with error correctly', async () => {
      mockedPrisma.botHealthLog.create.mockResolvedValue({} as any)

      await logHealthCheck('admin-1', {
        botId: 'bot-1',
        status: 'UNHEALTHY',
        latencyMs: 5000,
        error: 'Connection timeout',
        action: 'restart',
        actionResult: 'failed',
      })

      expect(mockedPrisma.botHealthLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'UNHEALTHY',
          error: 'Connection timeout',
          action: 'restart',
          actionResult: 'failed',
        }),
      })
    })
  })

  describe('checkAllBotsHealth', () => {
    it('checks health of all bots for a tenant', async () => {
      const mockBots = [
        { id: 'bot-1', tenantId: 'tenant-1', isEnabled: true },
        { id: 'bot-2', tenantId: 'tenant-1', isEnabled: true },
      ]

      mockedPrisma.bot.findMany.mockResolvedValue(mockBots as any)
      mockedPrisma.bot.findUnique.mockImplementation(async ({ where }) => {
        const bot = mockBots.find(b => b.id === where.id)
        return bot ? { ...bot, tenant: { id: 'tenant-1' } } : null
      } as any)

      const results = await checkAllBotsHealth('tenant-1')

      expect(results).toHaveLength(2)
      expect(results[0].botId).toBe('bot-1')
      expect(results[1].botId).toBe('bot-2')
      expect(mockedPrisma.bot.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', deletedAt: null },
      })
    })

    it('returns empty array when no bots exist', async () => {
      mockedPrisma.bot.findMany.mockResolvedValue([])

      const results = await checkAllBotsHealth('tenant-1')

      expect(results).toEqual([])
    })
  })
})
