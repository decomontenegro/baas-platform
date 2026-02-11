import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, parseQuery, paginationSchema } from '@/lib/api/validate'
import { z } from 'zod'

// Schemas
const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  embeddingModel: z.string().default('text-embedding-3-small'),
  chunkSize: z.number().int().min(100).max(8000).default(1000),
  chunkOverlap: z.number().int().min(0).max(1000).default(200),
  settings: z.record(z.unknown()).optional(),
})

const knowledgeBaseFilterSchema = paginationSchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/knowledge - List knowledge bases for current tenant
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { page, limit, search, isActive } = parseQuery(request, knowledgeBaseFilterSchema)
    const skip = (page - 1) * limit

    const where = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(isActive !== undefined && { isActive }),
    }

    const [knowledgeBases, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where,
        include: {
          _count: {
            select: {
              documents: {
                where: { deletedAt: null },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.knowledgeBase.count({ where }),
    ])

    // Get document stats for each knowledge base
    const knowledgeBasesWithStats = await Promise.all(
      knowledgeBases.map(async (kb) => {
        const stats = await prisma.knowledgeDocument.aggregate({
          where: { knowledgeBaseId: kb.id, deletedAt: null },
          _sum: { tokenCount: true },
          _count: true,
        })
        
        return {
          ...kb,
          stats: {
            documentCount: kb._count.documents,
            totalTokens: stats._sum.tokenCount || 0,
          },
        }
      })
    )

    return apiResponse({
      knowledgeBases: knowledgeBasesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/knowledge - Create new knowledge base
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createKnowledgeBaseSchema)

    const knowledgeBase = await prisma.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        embeddingModel: data.embeddingModel,
        chunkSize: data.chunkSize,
        chunkOverlap: data.chunkOverlap,
        settings: data.settings || {},
        tenantId,
      },
    })

    return apiResponse({ knowledgeBase }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
