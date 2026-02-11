import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError, noContent } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { z } from 'zod'
import { processDocument } from '@/lib/knowledge'

// Schemas
const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/knowledge/[id]/documents/[docId] - Get document details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id: knowledgeBaseId, docId } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const document = await prisma.knowledgeDocument.findFirst({
      where: {
        id: docId,
        knowledgeBaseId,
        deletedAt: null,
        KnowledgeBase: {
          tenantId,
          deletedAt: null,
        },
      },
      include: {
        chunks: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            content: true,
            tokenCount: true,
            metadata: true,
          },
        },
        _count: {
          select: { chunks: true },
        },
      },
    })

    if (!document) {
      throw new NotFoundError('Document')
    }

    return apiResponse({ document })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/knowledge/[id]/documents/[docId] - Update document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id: knowledgeBaseId, docId } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const existing = await prisma.knowledgeDocument.findFirst({
      where: {
        id: docId,
        knowledgeBaseId,
        deletedAt: null,
        KnowledgeBase: {
          tenantId,
          deletedAt: null,
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Document')
    }

    const data = await parseBody(request, updateDocumentSchema)

    const document = await prisma.knowledgeDocument.update({
      where: { id: docId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    return apiResponse({ document })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/knowledge/[id]/documents/[docId] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id: knowledgeBaseId, docId } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const existing = await prisma.knowledgeDocument.findFirst({
      where: {
        id: docId,
        knowledgeBaseId,
        deletedAt: null,
        KnowledgeBase: {
          tenantId,
          deletedAt: null,
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Document')
    }

    // Soft delete document (chunks will be orphaned but that's ok)
    await prisma.knowledgeDocument.update({
      where: { id: docId },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/knowledge/[id]/documents/[docId] - Reprocess document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id: knowledgeBaseId, docId } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Verify ownership
    const existing = await prisma.knowledgeDocument.findFirst({
      where: {
        id: docId,
        knowledgeBaseId,
        deletedAt: null,
        KnowledgeBase: {
          tenantId,
          deletedAt: null,
        },
      },
    })

    if (!existing) {
      throw new NotFoundError('Document')
    }

    // Reprocess document
    const result = await processDocument(docId)

    return apiResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
