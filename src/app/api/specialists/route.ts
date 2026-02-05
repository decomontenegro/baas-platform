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
import { specialistTemplates, customSpecialists } from '@/lib/mock-data'
import type { Specialist, CreateSpecialistInput } from '@/types/api'

/**
 * GET /api/specialists
 * Lista todos os specialists disponíveis (templates + custom)
 * Query params: page, limit, type (all|template|custom), expertise
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = getPaginationParams(searchParams)
    const type = searchParams.get('type') || 'all'
    const expertise = searchParams.get('expertise')

    let specialists: Specialist[] = []

    // Get templates
    if (type === 'all' || type === 'template') {
      specialists = [...specialistTemplates]
    }

    // Get custom specialists for this org
    if (type === 'all' || type === 'custom') {
      const orgCustom = Array.from(customSpecialists.values()).filter(
        (s) => s.organizationId === orgId
      )
      specialists = [...specialists, ...orgCustom]
    }

    // Filter by expertise if provided
    if (expertise) {
      const searchExpertise = expertise.toLowerCase()
      specialists = specialists.filter((s) =>
        s.expertise.some((e) => e.toLowerCase().includes(searchExpertise))
      )
    }

    // Sort by name
    specialists.sort((a, b) => a.name.localeCompare(b.name))

    // Paginate
    const total = specialists.length
    const paginatedData = specialists.slice(offset, offset + limit)

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
 * POST /api/specialists
 * Cria um novo specialist customizado
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const body: CreateSpecialistInput = await request.json()

    // Validation
    if (!body.name?.trim()) {
      return errorResponse('Nome é obrigatório')
    }
    if (!body.systemPrompt?.trim()) {
      return errorResponse('System prompt é obrigatório')
    }
    if (!body.expertise || body.expertise.length === 0) {
      return errorResponse('Pelo menos uma expertise é obrigatória')
    }

    // Validate model if provided
    const validModels = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    if (body.model && !validModels.includes(body.model)) {
      return errorResponse(`Modelo inválido. Use: ${validModels.join(', ')}`)
    }

    // Validate temperature
    if (body.temperature !== undefined && (body.temperature < 0 || body.temperature > 2)) {
      return errorResponse('Temperature deve estar entre 0 e 2')
    }

    // Validate maxTokens
    if (body.maxTokens !== undefined && (body.maxTokens < 1 || body.maxTokens > 32000)) {
      return errorResponse('maxTokens deve estar entre 1 e 32000')
    }

    // Check for duplicate name in org
    const existingNames = Array.from(customSpecialists.values())
      .filter((s) => s.organizationId === orgId)
      .map((s) => s.name.toLowerCase())

    if (existingNames.includes(body.name.toLowerCase())) {
      return errorResponse('Já existe um specialist com esse nome')
    }

    const now = new Date()
    const specialist: Specialist = {
      id: generateId('spec'),
      name: body.name.trim(),
      description: body.description?.trim() || '',
      expertise: body.expertise.map((e) => e.trim()).filter((e) => e),
      systemPrompt: body.systemPrompt.trim(),
      model: body.model || 'claude-3-sonnet',
      maxTokens: body.maxTokens || 2048,
      temperature: body.temperature ?? 0.7,
      isTemplate: false,
      isCustom: true,
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    }

    customSpecialists.set(specialist.id, specialist)

    return successResponse(specialist, 'Specialist criado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error creating specialist:', error)
    return errorResponse('Erro ao criar specialist', 500)
  }
}
