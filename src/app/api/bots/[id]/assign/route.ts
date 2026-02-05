import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import type { AssignBotInput, BotAssignment } from '@/types/bot'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/bots/[id]/assign
 * Assign a bot to a channel
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id: botId } = params
    const body: AssignBotInput = await request.json()

    // Validate input
    if (!body.channelId?.trim()) {
      return errorResponse('channelId é obrigatório')
    }

    // Check if bot exists and belongs to tenant
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        tenantId,
        deletedAt: null,
      },
    })

    if (!bot) {
      return errorResponse('Bot não encontrado', 404)
    }

    if (!bot.isActive) {
      return errorResponse('Não é possível atribuir um bot inativo')
    }

    // Check if there's already an active assignment for this channel
    const existingAssignment = await prisma.botAssignment.findFirst({
      where: {
        channelId: body.channelId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        bot: {
          select: { name: true },
        },
      },
    })

    // If there's an existing assignment to a different bot, deactivate it
    if (existingAssignment && existingAssignment.botId !== botId) {
      await prisma.botAssignment.update({
        where: { id: existingAssignment.id },
        data: { isActive: false },
      })
    }

    // Check if this bot already has an assignment for this channel
    const existingBotAssignment = await prisma.botAssignment.findFirst({
      where: {
        botId,
        channelId: body.channelId,
        deletedAt: null,
      },
    })

    let assignment

    if (existingBotAssignment) {
      // Reactivate existing assignment
      assignment = await prisma.botAssignment.update({
        where: { id: existingBotAssignment.id },
        data: {
          isActive: true,
          channelType: body.channelType,
          channelName: body.channelName,
          config: body.config || {},
        },
      })
    } else {
      // Create new assignment
      assignment = await prisma.botAssignment.create({
        data: {
          botId,
          channelId: body.channelId,
          channelType: body.channelType,
          channelName: body.channelName,
          isActive: true,
          config: body.config || {},
        },
      })
    }

    const response: BotAssignment = {
      id: assignment.id,
      botId: assignment.botId,
      channelId: assignment.channelId,
      channelType: assignment.channelType || undefined,
      channelName: assignment.channelName || undefined,
      isActive: assignment.isActive,
      config: assignment.config as any,
      messageCount: assignment.messageCount,
      lastActiveAt: assignment.lastActiveAt || undefined,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    }

    const message = existingAssignment && existingAssignment.botId !== botId
      ? `Bot atribuído. O bot "${existingAssignment.bot.name}" foi desativado neste canal.`
      : 'Bot atribuído com sucesso'

    return successResponse(response, message)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error assigning bot:', error)
    return errorResponse('Erro ao atribuir bot', 500)
  }
}

/**
 * DELETE /api/bots/[id]/assign
 * Unassign a bot from a channel
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id: botId } = params
    const searchParams = request.nextUrl.searchParams
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return errorResponse('channelId é obrigatório')
    }

    // Check if bot exists and belongs to tenant
    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        tenantId,
        deletedAt: null,
      },
    })

    if (!bot) {
      return errorResponse('Bot não encontrado', 404)
    }

    // Find and deactivate the assignment
    const assignment = await prisma.botAssignment.findFirst({
      where: {
        botId,
        channelId,
        deletedAt: null,
      },
    })

    if (!assignment) {
      return errorResponse('Atribuição não encontrada', 404)
    }

    await prisma.botAssignment.update({
      where: { id: assignment.id },
      data: { isActive: false },
    })

    return successResponse({ unassigned: true }, 'Bot desatribuído do canal')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error unassigning bot:', error)
    return errorResponse('Erro ao desatribuir bot', 500)
  }
}
