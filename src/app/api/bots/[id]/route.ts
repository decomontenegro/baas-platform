import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import type { UpdateBotInput, Bot, BotPersonality, BotAssignment } from '@/types/bot'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/bots/[id]
 * Get a specific bot with details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id } = params

    const bot = await prisma.bot.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        KnowledgeBase: {
          select: { id: true, name: true },
        },
        assignments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!bot) {
      return errorResponse('Bot não encontrado', 404)
    }

    const assignments: BotAssignment[] = bot.assignments.map((a) => ({
      id: a.id,
      botId: a.botId,
      channelId: a.channelId,
      channelType: a.channelType || undefined,
      channelName: a.channelName || undefined,
      isActive: a.isActive,
      config: a.config as any,
      messageCount: a.messageCount,
      lastActiveAt: a.lastActiveAt || undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))

    const response: Bot = {
      id: bot.id,
      tenantId: bot.tenantId,
      name: bot.name,
      description: bot.description || undefined,
      avatar: bot.avatar || undefined,
      personality: bot.personality as BotPersonality,
      systemPrompt: bot.systemPrompt,
      model: bot.model,
      temperature: bot.temperature,
      maxTokens: bot.maxTokens,
      knowledgeBaseId: bot.KnowledgeBaseId || undefined,
      knowledgeBaseName: bot.KnowledgeBase?.name,
      welcomeMessage: bot.welcomeMessage || undefined,
      quickReplies: bot.quickReplies,
      handoffEnabled: bot.handoffEnabled,
      handoffTriggers: bot.handoffTriggers,
      handoffMessage: bot.handoffMessage || undefined,
      isActive: bot.isActive,
      isDefault: bot.isDefault,
      messageCount: bot.messageCount,
      conversationCount: bot.conversationCount,
      lastUsedAt: bot.lastUsedAt || undefined,
      tags: bot.tags,
      metadata: bot.metadata as Record<string, unknown>,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      assignments,
      assignmentCount: assignments.length,
    }

    return successResponse(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error fetching bot:', error)
    return errorResponse('Erro ao buscar bot', 500)
  }
}

/**
 * PATCH /api/bots/[id]
 * Update a bot
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id } = params
    const body: UpdateBotInput = await request.json()

    // Check if bot exists
    const existingBot = await prisma.bot.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    })

    if (!existingBot) {
      return errorResponse('Bot não encontrado', 404)
    }

    // Check for duplicate name if updating
    if (body.name && body.name.trim() !== existingBot.name) {
      const duplicate = await prisma.bot.findFirst({
        where: {
          tenantId,
          name: body.name.trim(),
          id: { not: id },
          deletedAt: null,
        },
      })
      if (duplicate) {
        return errorResponse('Já existe um bot com esse nome')
      }
    }

    // Validate knowledge base if changing
    if (body.KnowledgeBaseId) {
      const kb = await prisma.KnowledgeBase.findFirst({
        where: {
          id: body.KnowledgeBaseId,
          tenantId,
          deletedAt: null,
        },
      })
      if (!kb) {
        return errorResponse('Knowledge base não encontrada')
      }
    }

    // Validate personality if updating
    if (body.personality) {
      const personality = {
        ...(existingBot.personality as BotPersonality),
        ...body.personality,
      }
      for (const [key, value] of Object.entries(personality)) {
        if (typeof value !== 'number' || value < 0 || value > 100) {
          return errorResponse(`Valor inválido para ${key}: deve ser entre 0 e 100`)
        }
      }
    }

    // Validate temperature
    if (body.temperature !== undefined) {
      if (body.temperature < 0 || body.temperature > 2) {
        return errorResponse('Temperature deve ser entre 0 e 2')
      }
    }

    // Validate maxTokens
    if (body.maxTokens !== undefined) {
      if (body.maxTokens < 100 || body.maxTokens > 128000) {
        return errorResponse('maxTokens deve ser entre 100 e 128000')
      }
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await prisma.bot.updateMany({
        where: {
          tenantId,
          id: { not: id },
          isDefault: true,
          deletedAt: null,
        },
        data: { isDefault: false },
      })
    }

    // Build update data
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim()
    if (body.avatar !== undefined) updateData.avatar = body.avatar
    if (body.personality !== undefined) {
      updateData.personality = {
        ...(existingBot.personality as BotPersonality),
        ...body.personality,
      }
    }
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt.trim()
    if (body.model !== undefined) updateData.model = body.model
    if (body.temperature !== undefined) updateData.temperature = body.temperature
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens
    if (body.KnowledgeBaseId !== undefined) updateData.KnowledgeBaseId = body.KnowledgeBaseId
    if (body.welcomeMessage !== undefined) updateData.welcomeMessage = body.welcomeMessage?.trim()
    if (body.quickReplies !== undefined) updateData.quickReplies = body.quickReplies
    if (body.handoffEnabled !== undefined) updateData.handoffEnabled = body.handoffEnabled
    if (body.handoffTriggers !== undefined) updateData.handoffTriggers = body.handoffTriggers
    if (body.handoffMessage !== undefined) updateData.handoffMessage = body.handoffMessage?.trim()
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    const bot = await prisma.bot.update({
      where: { id },
      data: updateData,
      include: {
        KnowledgeBase: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            assignments: {
              where: { deletedAt: null },
            },
          },
        },
      },
    })

    const response: Bot = {
      id: bot.id,
      tenantId: bot.tenantId,
      name: bot.name,
      description: bot.description || undefined,
      avatar: bot.avatar || undefined,
      personality: bot.personality as BotPersonality,
      systemPrompt: bot.systemPrompt,
      model: bot.model,
      temperature: bot.temperature,
      maxTokens: bot.maxTokens,
      knowledgeBaseId: bot.KnowledgeBaseId || undefined,
      knowledgeBaseName: bot.KnowledgeBase?.name,
      welcomeMessage: bot.welcomeMessage || undefined,
      quickReplies: bot.quickReplies,
      handoffEnabled: bot.handoffEnabled,
      handoffTriggers: bot.handoffTriggers,
      handoffMessage: bot.handoffMessage || undefined,
      isActive: bot.isActive,
      isDefault: bot.isDefault,
      messageCount: bot.messageCount,
      conversationCount: bot.conversationCount,
      lastUsedAt: bot.lastUsedAt || undefined,
      tags: bot.tags,
      metadata: bot.metadata as Record<string, unknown>,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      assignmentCount: bot._count.assignments,
    }

    return successResponse(response, 'Bot atualizado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error updating bot:', error)
    return errorResponse('Erro ao atualizar bot', 500)
  }
}

/**
 * DELETE /api/bots/[id]
 * Soft delete a bot
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id } = params

    // Check if bot exists
    const existingBot = await prisma.bot.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    })

    if (!existingBot) {
      return errorResponse('Bot não encontrado', 404)
    }

    // Check if it's the only active bot
    const activeBotsCount = await prisma.bot.count({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    })

    if (activeBotsCount === 1 && existingBot.isActive) {
      return errorResponse('Não é possível deletar o único bot ativo')
    }

    // Soft delete bot and its assignments
    await prisma.$transaction([
      prisma.bot.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.botAssignment.updateMany({
        where: { botId: id },
        data: { deletedAt: new Date() },
      }),
    ])

    return successResponse({ deleted: true }, 'Bot deletado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error deleting bot:', error)
    return errorResponse('Erro ao deletar bot', 500)
  }
}
