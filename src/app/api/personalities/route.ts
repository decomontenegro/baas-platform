import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  requireAuth,
  generateId,
} from '@/lib/api-utils'
import { personalityTemplates, customPersonalities } from '@/lib/mock-data'
import type { Personality, CreatePersonalityInput } from '@/types/api'

/**
 * GET /api/personalities
 * Lista todas as personalities (templates + custom)
 * Query params: page, limit, type (all|template|custom)
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = getPaginationParams(searchParams)
    const type = searchParams.get('type') || 'all'

    let personalities: Personality[] = []

    // Get templates
    if (type === 'all' || type === 'template') {
      personalities = [...personalityTemplates]
    }

    // Get custom personalities for this org
    if (type === 'all' || type === 'custom') {
      const orgCustom = Array.from(customPersonalities.values()).filter(
        (p) => p.organizationId === orgId
      )
      personalities = [...personalities, ...orgCustom]
    }

    // Sort by name
    personalities.sort((a, b) => a.name.localeCompare(b.name))

    // Paginate
    const total = personalities.length
    const paginatedData = personalities.slice(offset, offset + limit)

    return paginatedResponse(paginatedData, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return errorResponse('Internal server error', 500)
  }
}

/**
 * POST /api/personalities
 * Cria uma nova personality customizada
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const body: CreatePersonalityInput = await request.json()

    // Validation
    if (!body.name?.trim()) {
      return errorResponse('Nome é obrigatório')
    }
    if (!body.systemPrompt?.trim()) {
      return errorResponse('System prompt é obrigatório')
    }
    if (!body.tone) {
      return errorResponse('Tom é obrigatório')
    }

    const validTones = ['professional', 'friendly', 'casual', 'formal', 'technical']
    if (!validTones.includes(body.tone)) {
      return errorResponse(`Tom inválido. Use: ${validTones.join(', ')}`)
    }

    // Check for duplicate name in org
    const existingNames = Array.from(customPersonalities.values())
      .filter((p) => p.organizationId === orgId)
      .map((p) => p.name.toLowerCase())

    if (existingNames.includes(body.name.toLowerCase())) {
      return errorResponse('Já existe uma personality com esse nome')
    }

    const now = new Date()
    const personality: Personality = {
      id: generateId('pers'),
      name: body.name.trim(),
      description: body.description?.trim() || '',
      systemPrompt: body.systemPrompt.trim(),
      tone: body.tone,
      language: body.language || 'pt-BR',
      isTemplate: false,
      isCustom: true,
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
      metadata: body.metadata,
    }

    customPersonalities.set(personality.id, personality)

    return successResponse(personality, 'Personality criada com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error creating personality:', error)
    return errorResponse('Erro ao criar personality', 500)
  }
}
