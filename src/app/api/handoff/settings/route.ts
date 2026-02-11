import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, updateHandoffSettingsSchema } from '@/lib/api/validate'
import { z } from 'zod'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

const settingsQuerySchema = z.object({
  workspaceId: z.string().cuid(),
})

// GET /api/handoff/settings - Get handoff settings for a workspace
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { workspaceId } = parseQuery(request, settingsQuerySchema)

    // Verify workspace belongs to tenant
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!workspace) {
      throw new NotFoundError('Workspace')
    }

    if (workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this workspace')
    }

    // Get or create default settings
    let settings = await prisma.handoffSettings.findUnique({
      where: { workspaceId },
    })

    if (!settings) {
      settings = await prisma.handoffSettings.create({
        data: {
          workspaceId,
        },
      })
    }

    return apiResponse({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/handoff/settings - Update handoff settings
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { workspaceId } = parseQuery(request, settingsQuerySchema)
    const data = await parseBody(request, updateHandoffSettingsSchema)

    // Verify workspace belongs to tenant
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!workspace) {
      throw new NotFoundError('Workspace')
    }

    if (workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this workspace')
    }

    // Upsert settings
    const settings = await prisma.handoffSettings.upsert({
      where: { workspaceId },
      update: {
        slaMinutes: data.slaMinutes,
        escalationMinutes: data.escalationMinutes,
        notifyEmail: data.notifyEmail,
        notifyPush: data.notifyPush,
        notifySound: data.notifySound,
        notifyEmails: data.notifyEmails,
        enableBusinessHours: data.enableBusinessHours,
        timezone: data.timezone,
        businessHoursStart: data.businessHoursStart,
        businessHoursEnd: data.businessHoursEnd,
        workDays: data.workDays,
        enableAutoAssign: data.enableAutoAssign,
        roundRobinEnabled: data.roundRobinEnabled,
        outOfHoursMessage: data.outOfHoursMessage,
        maxConcurrentPerAgent: data.maxConcurrentPerAgent,
      },
      create: {
        workspaceId,
        slaMinutes: data.slaMinutes ?? 30,
        escalationMinutes: data.escalationMinutes ?? 15,
        notifyEmail: data.notifyEmail ?? true,
        notifyPush: data.notifyPush ?? true,
        notifySound: data.notifySound ?? true,
        notifyEmails: data.notifyEmails ?? [],
        enableBusinessHours: data.enableBusinessHours ?? false,
        timezone: data.timezone ?? 'America/Sao_Paulo',
        businessHoursStart: data.businessHoursStart ?? '09:00',
        businessHoursEnd: data.businessHoursEnd ?? '18:00',
        workDays: data.workDays ?? [1, 2, 3, 4, 5],
        enableAutoAssign: data.enableAutoAssign ?? false,
        roundRobinEnabled: data.roundRobinEnabled ?? false,
        outOfHoursMessage: data.outOfHoursMessage,
        maxConcurrentPerAgent: data.maxConcurrentPerAgent ?? 5,
      },
    })

    return apiResponse({ settings })
  } catch (error) {
    return handleApiError(error)
  }
}
