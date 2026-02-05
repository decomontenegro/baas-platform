import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError, ForbiddenError, noContent } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { z } from 'zod'
import { getKnowledgeBaseStats } from '@/lib/knowledge'

// Schemas
const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  embeddingModel: z.string().optional(),
  chunkSize: z.number().int().min(100).max(8000).optional(),
  chunkOverlap: z.number().int().min(0).max(1000).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/knowledge/[id] - Get knowledge base details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            contentType: true,
            fileName: true,
            fileSize: true,
            status: true,
            tokenCount: true,
            createdAt: true,
            processedAt: true,
            errorMessage: true,
            _count: {
              select: { chunks: true },
            },
          },
        },
      },
    })

    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge Base')
    }

    // Get stats
    const stats = await getKnowledgeBaseStats(id)

    return apiResponse({
      knowledgeBase: {
        ...knowledgeBase,
        stats,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/knowledge/[id] - Update knowledge base
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const existing = await prisma.knowledgeBase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    })

    if (!existing) {
      throw new NotFoundError('Knowledge Base')
    }

    const data = await parseBody(request, updateKnowledgeBaseSchema)

    const knowledgeBase = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    return apiResponse({ knowledgeBase })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/knowledge/[id] - Soft delete knowledge base
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const existing = await prisma.knowledgeBase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    })

    if (!existing) {
      throw new NotFoundError('Knowledge Base')
    }

    // Soft delete knowledge base and all its documents
    await prisma.$transaction([
      prisma.knowledgeDocument.updateMany({
        where: { knowledgeBaseId: id },
        data: {
          deletedAt: new Date(),
          deletedBy: session.user.id,
        },
      }),
      prisma.knowledgeBase.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: session.user.id,
        },
      }),
    ])

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
