/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Notification Preferences API
 * 
 * GET /api/notifications/preferences - Get user preferences
 * PATCH /api/notifications/preferences - Update user preferences
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { 
  handleApiError, 
  apiResponse, 
  UnauthorizedError,
} from '@/lib/api/errors'
import { 
  ALL_NOTIFICATION_TYPES, 
  NOTIFICATION_TYPE_META,
  NotificationType,
} from '@/types/notification'
import { z } from 'zod'

// Update preferences schema
const updatePreferencesSchema = z.object({
  preferences: z.array(z.object({
    type: z.enum(ALL_NOTIFICATION_TYPES as [string, ...string[]]),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    inApp: z.boolean().optional(),
  })),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/notifications/preferences
export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Get all preferences for user
    const existingPrefs = await prisma.notificationPreference.findMany({
      where: { userId },
    })

    // Build preferences map with defaults
    const preferencesMap = new Map(
      existingPrefs.map(p => [p.type, p])
    )

    const preferences = ALL_NOTIFICATION_TYPES.map(type => {
      const existing = preferencesMap.get(type)
      const meta = NOTIFICATION_TYPE_META[type]

      return {
        type,
        label: meta.label,
        description: meta.description,
        email: existing?.email ?? meta.defaultEmail,
        push: existing?.push ?? meta.defaultPush,
        inApp: existing?.inApp ?? meta.defaultInApp,
      }
    })

    return apiResponse({ preferences })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/notifications/preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // Parse body
    const body = await request.json()
    const { preferences } = updatePreferencesSchema.parse(body)

    // Upsert each preference
    const upsertPromises = preferences.map(pref => {
      const type = pref.type as NotificationType
      const meta = NOTIFICATION_TYPE_META[type]

      return prisma.notificationPreference.upsert({
        where: { userId_type: { userId, type } },
        update: {
          email: pref.email ?? undefined,
          push: pref.push ?? undefined,
          inApp: pref.inApp ?? undefined,
        },
        create: {
          userId,
          type,
          email: pref.email ?? meta.defaultEmail,
          push: pref.push ?? meta.defaultPush,
          inApp: pref.inApp ?? meta.defaultInApp,
        },
      })
    })

    await Promise.all(upsertPromises)

    // Return updated preferences
    const updatedPrefs = await prisma.notificationPreference.findMany({
      where: { userId },
    })

    const preferencesMap = new Map(
      updatedPrefs.map(p => [p.type, p])
    )

    const result = ALL_NOTIFICATION_TYPES.map(type => {
      const existing = preferencesMap.get(type)
      const meta = NOTIFICATION_TYPE_META[type]

      return {
        type,
        label: meta.label,
        description: meta.description,
        email: existing?.email ?? meta.defaultEmail,
        push: existing?.push ?? meta.defaultPush,
        inApp: existing?.inApp ?? meta.defaultInApp,
      }
    })

    return apiResponse({ 
      success: true,
      preferences: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
