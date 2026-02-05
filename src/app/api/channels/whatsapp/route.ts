import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse, requireAuth } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { ChannelType } from '@prisma/client'

/**
 * GET /api/channels/whatsapp
 * Returns all WhatsApp channels from database
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    // Get channels from database
    const channels = await prisma.channel.findMany({
      where: {
        type: ChannelType.WHATSAPP,
        deletedAt: null,
      },
      include: {
        workspace: {
          select: {
            name: true,
            tenant: {
              select: {
                name: true,
                slug: true,
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })
    
    // Transform to expected format
    const groupsList = channels.map(channel => {
      const config = channel.config as Record<string, unknown> || {}
      return {
        id: config.externalId as string || channel.id,
        channelId: channel.id,
        name: channel.name,
        requireMention: config.requireMention as boolean ?? true,
        prefix: config.prefix as string || null,
        model: config.model as string || 'default',
        enabled: channel.isActive && (config.enabled !== false),
        status: channel.status,
        workspace: channel.workspace?.name,
        tenant: channel.workspace?.tenant?.name,
      }
    })
    
    return successResponse({
      groups: groupsList,
      total: groupsList.length,
      activeCount: groupsList.filter(g => g.enabled).length,
      mentionRequired: groupsList.filter(g => g.requireMention).length,
      source: 'database',
    })
  } catch (error) {
    console.error('Error fetching WhatsApp channels:', error)
    return errorResponse('Erro ao buscar canais WhatsApp', 500)
  }
}

/**
 * PATCH /api/channels/whatsapp
 * Update a channel's settings
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const body = await request.json()
    const { channelId, groupId, settings } = body
    
    // Find channel by channelId or by externalId (groupId)
    let channel = null
    
    if (channelId) {
      channel = await prisma.channel.findUnique({
        where: { id: channelId }
      })
    } else if (groupId) {
      channel = await prisma.channel.findFirst({
        where: {
          type: ChannelType.WHATSAPP,
          config: {
            path: ['externalId'],
            equals: groupId
          }
        }
      })
    }
    
    if (!channel) {
      return errorResponse('Canal não encontrado', 404)
    }
    
    // Update channel config
    const currentConfig = channel.config as Record<string, unknown> || {}
    const newConfig = {
      ...currentConfig,
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    
    // Update in database
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        config: newConfig,
        isActive: settings.enabled !== undefined ? settings.enabled : channel.isActive,
      }
    })
    
    return successResponse({
      channelId: updated.id,
      settings: newConfig,
      message: 'Canal atualizado',
    })
  } catch (error) {
    console.error('Error updating channel:', error)
    return errorResponse('Erro ao atualizar canal', 500)
  }
}
