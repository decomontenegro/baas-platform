import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// Default settings structure
const defaultSettings = {
  profile: {
    firstName: '',
    lastName: '',
    company: '',
    avatar: null,
  },
  notifications: {
    email: true,
    push: false,
    weekly: true,
    handoffAlerts: true,
    usageAlerts: true,
  },
  appearance: {
    theme: 'system' as 'light' | 'dark' | 'system',
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30, // days
  },
}

type Settings = typeof defaultSettings

/**
 * GET /api/settings
 * Get current user's tenant settings
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    // Get user with tenant info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
            plan: true,
          },
        },
      },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    // Merge tenant settings with defaults
    const tenantSettings = (user.tenant?.settings as Partial<Settings>) || {}
    const mergedSettings: Settings = {
      profile: {
        firstName: user.name?.split(' ')[0] || tenantSettings.profile?.firstName || '',
        lastName: user.name?.split(' ').slice(1).join(' ') || tenantSettings.profile?.lastName || '',
        company: user.tenant?.name || tenantSettings.profile?.company || '',
        avatar: user.image || tenantSettings.profile?.avatar || null,
      },
      notifications: {
        ...defaultSettings.notifications,
        ...tenantSettings.notifications,
      },
      appearance: {
        ...defaultSettings.appearance,
        ...tenantSettings.appearance,
      },
      security: {
        ...defaultSettings.security,
        ...tenantSettings.security,
      },
    }

    return successResponse({
      settings: mergedSettings,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
      } : null,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return errorResponse('Erro ao buscar configurações', 500)
  }
}

/**
 * PATCH /api/settings
 * Update settings (partial update)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    const { profile, notifications, appearance, security } = body

    // Get user with tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    // Update user profile fields
    if (profile) {
      const nameParts = []
      if (profile.firstName) nameParts.push(profile.firstName)
      if (profile.lastName) nameParts.push(profile.lastName)
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: nameParts.length > 0 ? nameParts.join(' ') : undefined,
          image: profile.avatar !== undefined ? profile.avatar : undefined,
        },
      })
    }

    // Update tenant settings if user has a tenant
    if (user.tenantId) {
      const existingSettings = (user.tenant?.settings as Partial<Settings>) || {}
      
      const updatedSettings: Partial<Settings> = {
        ...existingSettings,
      }

      if (profile?.company) {
        updatedSettings.profile = {
          ...existingSettings.profile,
          ...profile,
        }
      }

      if (notifications) {
        updatedSettings.notifications = {
          ...defaultSettings.notifications,
          ...existingSettings.notifications,
          ...notifications,
        }
      }

      if (appearance) {
        updatedSettings.appearance = {
          ...defaultSettings.appearance,
          ...existingSettings.appearance,
          ...appearance,
        }
      }

      if (security) {
        updatedSettings.security = {
          ...defaultSettings.security,
          ...existingSettings.security,
          ...security,
        }
      }

      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
          settings: updatedSettings as object,
          name: profile?.company || undefined,
        },
      })
    }

    // Fetch updated data
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
            plan: true,
          },
        },
      },
    })

    if (!updatedUser) {
      return errorResponse('Erro ao atualizar', 500)
    }

    const tenantSettings = (updatedUser.tenant?.settings as Partial<Settings>) || {}
    const mergedSettings: Settings = {
      profile: {
        firstName: updatedUser.name?.split(' ')[0] || '',
        lastName: updatedUser.name?.split(' ').slice(1).join(' ') || '',
        company: updatedUser.tenant?.name || '',
        avatar: updatedUser.image || null,
      },
      notifications: {
        ...defaultSettings.notifications,
        ...tenantSettings.notifications,
      },
      appearance: {
        ...defaultSettings.appearance,
        ...tenantSettings.appearance,
      },
      security: {
        ...defaultSettings.security,
        ...tenantSettings.security,
      },
    }

    return successResponse({
      settings: mergedSettings,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        image: updatedUser.image,
        role: updatedUser.role,
      },
      tenant: updatedUser.tenant ? {
        id: updatedUser.tenant.id,
        name: updatedUser.tenant.name,
        slug: updatedUser.tenant.slug,
        plan: updatedUser.tenant.plan,
      } : null,
    }, 'Configurações atualizadas com sucesso')
  } catch (error) {
    console.error('Error updating settings:', error)
    return errorResponse('Erro ao atualizar configurações', 500)
  }
}
