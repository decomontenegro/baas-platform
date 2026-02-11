import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, UnauthorizedError, BadRequestError } from '@/lib/api/errors'
import { parseQuery, paginationSchema } from '@/lib/api/validate'
import { z } from 'zod'
import { addDocument } from '@/lib/knowledge'

// Schemas
const documentFilterSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  search: z.string().optional(),
})

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/knowledge/[id]/documents - List documents in knowledge base
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
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

    const { page, limit, status, search } = parseQuery(request, documentFilterSchema)
    const skip = (page - 1) * limit

    const where = {
      knowledgeBaseId,
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { fileName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [documents, total] = await Promise.all([
      prisma.knowledgeDocument.findMany({
        where,
        include: {
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.knowledgeDocument.count({ where }),
    ])

    return apiResponse({
      documents,
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

// POST /api/knowledge/[id]/documents - Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
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

    // Handle multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const content = formData.get('content') as string | null
    const processImmediately = formData.get('processImmediately') !== 'false'

    if (!file && !content) {
      throw new BadRequestError('Either file or content is required')
    }

    let documentOptions: {
      title: string
      content?: string
      file?: {
        buffer: Buffer
        mimeType: string
        fileName?: string
        size?: number
      }
      processImmediately: boolean
    }

    if (file) {
      // Process file upload
      const buffer = Buffer.from(await file.arrayBuffer())
      documentOptions = {
        title: title || file.name,
        file: {
          buffer,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
          size: file.size,
        },
        processImmediately,
      }
    } else {
      // Process text content
      documentOptions = {
        title: title || 'Untitled Document',
        content: content!,
        processImmediately,
      }
    }

    const result = await addDocument(knowledgeBaseId, documentOptions)

    return apiResponse(result, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
