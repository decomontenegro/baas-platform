import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import { features, featureStates } from '@/lib/mock-data'
import type { Feature, FeatureUpdateInput } from '@/types/api'

// Get feature states for an org (with defaults from template)
function getOrgFeatures(orgId: string): Feature[] {
  const orgStates = featureStates.get(orgId) || new Map<string, boolean>()

  return features.map((feature) => ({
    ...feature,
    enabled: orgStates.has(feature.key) ? orgStates.get(feature.key)! : feature.enabled,
  }))
}

/**
 * GET /api/features
 * Lista todas as features com status (enabled/disabled)
 * Query params: category, tier
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const tier = searchParams.get('tier')

    let orgFeatures = getOrgFeatures(orgId)

    // Filter by category
    if (category) {
      orgFeatures = orgFeatures.filter((f) => f.category === category)
    }

    // Filter by tier
    if (tier) {
      orgFeatures = orgFeatures.filter((f) => f.tier === tier)
    }

    // Group by category for better organization
    const grouped = orgFeatures.reduce((acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = []
      }
      acc[feature.category].push(feature)
      return acc
    }, {} as Record<string, Feature[]>)

    return successResponse({
      features: orgFeatures,
      grouped,
      summary: {
        total: orgFeatures.length,
        enabled: orgFeatures.filter((f) => f.enabled).length,
        disabled: orgFeatures.filter((f) => !f.enabled).length,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    return errorResponse('Internal server error', 500)
  }
}

/**
 * PATCH /api/features
 * Bulk update de features (enable/disable)
 */
export async function PATCH(request: NextRequest) {
  try {
    const orgId = await requireAuth(request)
    const body: { updates: FeatureUpdateInput[] } = await request.json()

    if (!body.updates || !Array.isArray(body.updates)) {
      return errorResponse('Updates array é obrigatório')
    }

    if (body.updates.length === 0) {
      return errorResponse('Pelo menos um update é necessário')
    }

    // Validate all feature keys exist
    const validKeys = features.map((f) => f.key)
    const invalidKeys = body.updates
      .map((u) => u.key)
      .filter((key) => !validKeys.includes(key))

    if (invalidKeys.length > 0) {
      return errorResponse(`Features não encontradas: ${invalidKeys.join(', ')}`)
    }

    // Get or create org feature states
    if (!featureStates.has(orgId)) {
      featureStates.set(orgId, new Map<string, boolean>())
    }
    const orgStates = featureStates.get(orgId)!

    // Check tier restrictions (mock - in production would check org's plan)
    const orgTier = 'pro' // Mock: assume pro tier
    const tierOrder = { free: 0, pro: 1, enterprise: 2 }
    const orgTierLevel = tierOrder[orgTier]

    const tierRestricted: string[] = []
    for (const update of body.updates) {
      const feature = features.find((f) => f.key === update.key)!
      const featureTierLevel = tierOrder[feature.tier]

      if (update.enabled && featureTierLevel > orgTierLevel) {
        tierRestricted.push(`${feature.name} (requer ${feature.tier})`)
      }
    }

    if (tierRestricted.length > 0) {
      return errorResponse(
        `Algumas features requerem upgrade: ${tierRestricted.join(', ')}`,
        403
      )
    }

    // Apply updates
    const applied: string[] = []
    for (const update of body.updates) {
      orgStates.set(update.key, update.enabled)
      applied.push(update.key)

      // Handle config if provided
      if (update.config) {
        // In production, store config separately
        console.log(`Config for ${update.key}:`, update.config)
      }
    }

    // Get updated features
    const updatedFeatures = getOrgFeatures(orgId)

    return successResponse(
      {
        features: updatedFeatures,
        applied,
        summary: {
          total: updatedFeatures.length,
          enabled: updatedFeatures.filter((f) => f.enabled).length,
          disabled: updatedFeatures.filter((f) => !f.enabled).length,
        },
      },
      `${applied.length} feature(s) atualizada(s) com sucesso`
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error updating features:', error)
    return errorResponse('Erro ao atualizar features', 500)
  }
}
