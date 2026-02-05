import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  requireAuth,
} from '@/lib/api-utils'
import type { CreateBotInput, Bot, BotPersonality } from '@/types/bot'

const DEFAULT_PERSONALITY: BotPersonality = {
  creativity: 50,
  formality: 50,
  verbosity: 50,
  empathy: 70,
  humor: 30,
}

/**
 * GET /api/bots
 * Lista todos os bots do tenant
 * Query params: page, limit, active, search
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = getPaginationParams(searchParams)
    const activeOnly = searchParams.get('active') === 'true'
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {
      tenantId,
      deletedAt: null,
    }

    if (activeOnly) {
      where.isActive = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ]
    }

    // Get bots with assignment count
    const [bots, total] = await Promise.all([
      prisma.bot.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [
          { isDefault: 'desc' },
          { isActive: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          knowledgeBase: {
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
      }),
      prisma.bot.count({ where }),
    ])

    // Transform to API response format
    const data: Bot[] = bots.map((bot) => ({
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
      knowledgeBaseId: bot.knowledgeBaseId || undefined,
      knowledgeBaseName: bot.knowledgeBase?.name,
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
    }))

    return paginatedResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error listing bots:', error)
    return errorResponse('Erro ao listar bots', 500)
  }
}

/**
 * POST /api/bots
 * Cria um novo bot
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireAuth(request)
    const body: CreateBotInput = await request.json()

    // Validation
    if (!body.name?.trim()) {
      return errorResponse('Nome é obrigatório')
    }

    if (!body.systemPrompt?.trim()) {
      return errorResponse('System prompt é obrigatório')
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

    // Validate knowledge base if provided
    if (body.knowledgeBaseId) {
      const kb = await prisma.knowledgeBase.findFirst({
        where: {
          id: body.knowledgeBaseId,
          tenantId,
          deletedAt: null,
        },
      })
      if (!kb) {
        return errorResponse('Knowledge base não encontrada')
      }
    }

    // Merge personality with defaults
    const personality: BotPersonality = {
      ...DEFAULT_PERSONALITY,
      ...body.personality,
    }

    // Validate personality values
    for (const [key, value] of Object.entries(personality)) {
      if (typeof value !== 'number' || value < 0 || value > 100) {
        return errorResponse(`Valor inválido para ${key}: deve ser entre 0 e 100`)
      }
    }

    // Validate temperature
    const temperature = body.temperature ?? 0.7
    if (temperature < 0 || temperature > 2) {
      return errorResponse('Temperature deve ser entre 0 e 2')
    }

    // Validate maxTokens
    const maxTokens = body.maxTokens ?? 2048
    if (maxTokens < 100 || maxTokens > 128000) {
      return errorResponse('maxTokens deve ser entre 100 e 128000')
    }

    // Create bot
    const bot = await prisma.bot.create({
      data: {
        tenantId,
        name: body.name.trim(),
        description: body.description?.trim(),
        avatar: body.avatar,
        personality,
        systemPrompt: body.systemPrompt.trim(),
        model: body.model || 'gpt-4o-mini',
        temperature,
        maxTokens,
        knowledgeBaseId: body.knowledgeBaseId,
        welcomeMessage: body.welcomeMessage?.trim(),
        quickReplies: body.quickReplies || [],
        handoffEnabled: body.handoffEnabled ?? true,
        handoffTriggers: body.handoffTriggers || ['falar com humano', 'atendente', 'pessoa'],
        handoffMessage: body.handoffMessage?.trim(),
        tags: body.tags || [],
        metadata: body.metadata || {},
      },
      include: {
        knowledgeBase: {
          select: { id: true, name: true },
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
      knowledgeBaseId: bot.knowledgeBaseId || undefined,
      knowledgeBaseName: bot.knowledgeBase?.name,
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
      assignmentCount: 0,
    }

    return successResponse(response, 'Bot criado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error creating bot:', error)
    return errorResponse('Erro ao criar bot', 500)
  }
}
