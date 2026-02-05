import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import { personalityTemplates, customPersonalities } from '@/lib/mock-data'
import type { Personality, UpdatePersonalityInput } from '@/types/api'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Helper to find personality by ID
function findPersonality(id: string, orgId: string): Personality | null {
  // Check templates first
  const template = personalityTemplates.find((p) => p.id === id)
  if (template) {
    return template
  }

  // Check custom personalities
  const custom = customPersonalities.get(id)
  if (custom && custom.organizationId === orgId) {
    return custom
  }

  return null
}

/**
 * GET /api/personalities/[id]
 * Retorna uma personality específica
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const orgId = await requireAuth(request)
    const { id } = await params

    const personality = findPersonality(id, orgId)
    if (!personality) {
      return errorResponse('Personality não encontrada', 404)
    }

    return successResponse(personality)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return errorResponse('Internal server error', 500)
  }
}

/**
 * PATCH /api/personalities/[id]
 * Atualiza uma personality customizada
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const orgId = await requireAuth(request)
    const { id } = await params
    const body: UpdatePersonalityInput = await request.json()

    const personality = findPersonality(id, orgId)
    if (!personality) {
      return errorResponse('Personality não encontrada', 404)
    }

    // Can't edit templates
    if (personality.isTemplate) {
      return errorResponse('Não é possível editar uma personality template', 403)
    }

    // Validate tone if provided
    if (body.tone) {
      const validTones = ['professional', 'friendly', 'casual', 'formal', 'technical']
      if (!validTones.includes(body.tone)) {
        return errorResponse(`Tom inválido. Use: ${validTones.join(', ')}`)
      }
    }

    // Check for duplicate name if changing
    if (body.name && body.name.toLowerCase() !== personality.name.toLowerCase()) {
      const existingNames = Array.from(customPersonalities.values())
        .filter((p) => p.organizationId === orgId && p.id !== id)
        .map((p) => p.name.toLowerCase())

      if (existingNames.includes(body.name.toLowerCase())) {
        return errorResponse('Já existe uma personality com esse nome')
      }
    }

    // Update
    const updated: Personality = {
      ...personality,
      name: body.name?.trim() || personality.name,
      description: body.description?.trim() ?? personality.description,
      systemPrompt: body.systemPrompt?.trim() || personality.systemPrompt,
      tone: body.tone || personality.tone,
      language: body.language || personality.language,
      metadata: body.metadata !== undefined
        ? { ...personality.metadata, ...body.metadata }
        : personality.metadata,
      updatedAt: new Date(),
    }

    customPersonalities.set(id, updated)

    return successResponse(updated, 'Personality atualizada com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error updating personality:', error)
    return errorResponse('Erro ao atualizar personality', 500)
  }
}

/**
 * DELETE /api/personalities/[id]
 * Remove uma personality customizada
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const orgId = await requireAuth(request)
    const { id } = await params

    const personality = findPersonality(id, orgId)
    if (!personality) {
      return errorResponse('Personality não encontrada', 404)
    }

    // Can't delete templates
    if (personality.isTemplate) {
      return errorResponse('Não é possível excluir uma personality template', 403)
    }

    customPersonalities.delete(id)

    return successResponse({ id }, 'Personality excluída com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return errorResponse('Internal server error', 500)
  }
}
