import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import type { DuplicateBotInput, Bot, BotPersonality } from '@/types/bot'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/bots/[id]/duplicate
 * Duplicate a bot with a new name
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireAuth(request)
    const { id: botId } = params
    const body: DuplicateBotInput = await request.json()

    // Validate name
    if (!body.name?.trim()) {
      return errorResponse('Nome é obrigatório')
    }

    // Check if original bot exists
    const originalBot = await prisma.bot.findFirst({
      where: {
        id: botId,
        tenantId,
        deletedAt: null,
      },
    })

    if (!originalBot) {
      return errorResponse('Bot não encontrado', 404)
    }

    // Check for duplicate name
    const existing = await prisma.bot.findFirst({
      where: {
        tenantId,
        name: body.name.trim(),
        deletedAt: null,
      },
    })

    if (existing) {
      return errorResponse('Já existe um bot com esse nome')
    }

    // Create duplicate
    const newBot = await prisma.bot.create({
      data: {
        tenantId,
        name: body.name.trim(),
        description: body.description?.trim() || originalBot.description,
        avatar: originalBot.avatar,
        personality: originalBot.personality,
        systemPrompt: originalBot.systemPrompt,
        model: originalBot.model,
        temperature: originalBot.temperature,
        maxTokens: originalBot.maxTokens,
        knowledgeBaseId: originalBot.KnowledgeBaseId,
        welcomeMessage: originalBot.welcomeMessage,
        quickReplies: originalBot.quickReplies,
        handoffEnabled: originalBot.handoffEnabled,
        handoffTriggers: originalBot.handoffTriggers,
        handoffMessage: originalBot.handoffMessage,
        tags: originalBot.tags,
        metadata: {
          ...(originalBot.metadata as Record<string, unknown>),
          duplicatedFrom: originalBot.id,
          duplicatedAt: new Date().toISOString(),
        },
        isActive: false, // Start as inactive
        isDefault: false, // Never duplicate as default
      },
      include: {
        KnowledgeBase: {
          select: { id: true, name: true },
        },
      },
    })

    const response: Bot = {
      id: newBot.id,
      tenantId: newBot.tenantId,
      name: newBot.name,
      description: newBot.description || undefined,
      avatar: newBot.avatar || undefined,
      personality: newBot.personality as BotPersonality,
      systemPrompt: newBot.systemPrompt,
      model: newBot.model,
      temperature: newBot.temperature,
      maxTokens: newBot.maxTokens,
      knowledgeBaseId: newBot.KnowledgeBaseId || undefined,
      knowledgeBaseName: newBot.KnowledgeBase?.name,
      welcomeMessage: newBot.welcomeMessage || undefined,
      quickReplies: newBot.quickReplies,
      handoffEnabled: newBot.handoffEnabled,
      handoffTriggers: newBot.handoffTriggers,
      handoffMessage: newBot.handoffMessage || undefined,
      isActive: newBot.isActive,
      isDefault: newBot.isDefault,
      messageCount: newBot.messageCount,
      conversationCount: newBot.conversationCount,
      lastUsedAt: newBot.lastUsedAt || undefined,
      tags: newBot.tags,
      metadata: newBot.metadata as Record<string, unknown>,
      createdAt: newBot.createdAt,
      updatedAt: newBot.updatedAt,
      assignmentCount: 0,
    }

    return successResponse(response, `Bot duplicado de "${originalBot.name}"`)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error duplicating bot:', error)
    return errorResponse('Erro ao duplicar bot', 500)
  }
}
