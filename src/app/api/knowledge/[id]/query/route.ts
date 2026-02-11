import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError, BadRequestError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { z } from 'zod'
import { searchKnowledgeBase, buildContext } from '@/lib/knowledge'

// Schema for search query
const querySchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.7),
  includeContext: z.boolean().default(true),
  maxContextLength: z.number().int().min(100).max(16000).default(4000),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/knowledge/[id]/query - Semantic search in knowledge base
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id: knowledgeBaseId } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify knowledge base ownership
    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        tenantId,
        deletedAt: null,
      },
    })

    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge Base')
    }

    const data = await parseBody(request, querySchema)

    // Perform semantic search
    const results = await searchKnowledgeBase({
      knowledgeBaseId,
      query: data.query,
      topK: data.topK,
      threshold: data.threshold,
    })

    // Build context string if requested
    let context: string | undefined
    if (data.includeContext && results.length > 0) {
      context = buildContext(results, {
        maxLength: data.maxContextLength,
        includeSource: true,
        format: 'markdown',
      })
    }

    return apiResponse({
      query: data.query,
      results,
      context,
      resultCount: results.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
