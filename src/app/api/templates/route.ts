import { NextRequest } from 'next/server'
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  requireAuth,
  getPaginationParams,
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// Force dynamic rendering - these routes require DB access
export const dynamic = 'force-dynamic'

/**
 * GET /api/templates
 * List all templates with filtering and pagination
 * 
 * Query params:
 * - categoryId: Filter by category
 * - search: Search by name, description, or tags
 * - isOfficial: Filter official templates
 * - isFeatured: Filter featured templates
 * - sortBy: 'popular' | 'newest' | 'rating' | 'name'
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth optional for public templates
    let userId: string | null = null
    try {
      userId = await requireAuth(request)
    } catch {
      // Public access allowed for templates
    }

    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = getPaginationParams(searchParams)

    // Build filter conditions
    const where: Prisma.TemplateWhereInput = {
      deletedAt: null,
      isActive: true,
    }

    // Category filter
    const categoryId = searchParams.get('categoryId')
    if (categoryId) {
      where.categoryId = categoryId
    }

    // Search filter
    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ]
    }

    // Official filter
    const isOfficial = searchParams.get('isOfficial')
    if (isOfficial !== null) {
      where.isOfficial = isOfficial === 'true'
    }

    // Featured filter
    const isFeatured = searchParams.get('isFeatured')
    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    // Public filter (only show public unless owner)
    if (!userId) {
      where.isPublic = true
    } else {
      where.OR = [
        { isPublic: true },
        { authorId: userId },
      ]
    }

    // Sort order
    const sortBy = searchParams.get('sortBy') || 'popular'
    let orderBy: Prisma.TemplateOrderByWithRelationInput
    switch (sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'rating':
        orderBy = { rating: 'desc' }
        break
      case 'name':
        orderBy = { name: 'asc' }
        break
      case 'popular':
      default:
        orderBy = { usageCount: 'desc' }
        break
    }

    // Fetch templates with pagination
    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          TemplateCategory: true,
        },
      }),
      prisma.template.count({ where }),
    ])

    // Format response
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      slug: template.slug,
      description: template.description,
      categoryId: template.TemplateCategoryId,
      category: template.TemplateCategory ? {
        id: template.TemplateCategory.id,
        name: template.TemplateCategory.name,
        slug: template.TemplateCategory.slug,
        icon: template.TemplateCategory.icon,
        description: template.TemplateCategory.description,
        sortOrder: template.TemplateCategory.sortOrder,
        isActive: template.TemplateCategory.isActive,
        createdAt: template.TemplateCategory.createdAt.toISOString(),
        updatedAt: template.TemplateCategory.updatedAt.toISOString(),
      } : undefined,
      authorId: template.authorId,
      icon: template.icon,
      color: template.color,
      thumbnail: template.thumbnail,
      config: template.config,
      tags: template.tags,
      usageCount: template.usageCount,
      rating: template.rating,
      ratingCount: template.ratingCount,
      isPublic: template.isPublic,
      isOfficial: template.isOfficial,
      isFeatured: template.isFeatured,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    }))

    return paginatedResponse(formattedTemplates, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return errorResponse('Erro ao buscar templates', 500)
  }
}

/**
 * POST /api/templates
 * Create a new template
 * 
 * Body:
 * - name: Template name (required)
 * - slug: URL-friendly slug (required, unique)
 * - description: Template description (required)
 * - categoryId: Category ID (required)
 * - icon: Emoji icon (required)
 * - color: Color theme (default: 'blue')
 * - config: Template configuration (required)
 * - tags: Array of tags
 * - isPublic: Whether template is public (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request)

    const body = await request.json()
    const {
      name,
      slug,
      description,
      categoryId,
      icon,
      color = 'blue',
      thumbnail,
      config,
      tags = [],
      isPublic = true,
    } = body

    // Validate required fields
    if (!name || !slug || !description || !categoryId || !icon || !config) {
      return errorResponse('Campos obrigatórios: name, slug, description, categoryId, icon, config')
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(slug)) {
      return errorResponse('Slug deve conter apenas letras minúsculas, números e hífens')
    }

    // Check if slug already exists
    const existingTemplate = await prisma.template.findUnique({
      where: { slug },
    })
    if (existingTemplate) {
      return errorResponse('Um template com esse slug já existe')
    }

    // Validate category exists
    const category = await prisma.templateCategory.findUnique({
      where: { id: categoryId },
    })
    if (!category) {
      return errorResponse('Categoria não encontrada', 404)
    }

    // Validate config structure
    if (!config.systemPrompt || !config.personality || !config.welcomeMessage) {
      return errorResponse('Config deve conter: systemPrompt, personality, welcomeMessage')
    }

    // Create template
    const template = await prisma.template.create({
      data: {
        name,
        slug,
        description,
        categoryId,
        authorId: userId,
        icon,
        color,
        thumbnail,
        config,
        tags: tags.map((tag: string) => tag.toLowerCase()),
        isPublic,
        isOfficial: false, // Only admin can create official templates
        isFeatured: false,
        isActive: true,
        usageCount: 0,
        rating: 0,
        ratingCount: 0,
      },
      include: {
        TemplateCategory: true,
      },
    })

    const formattedTemplate = {
      id: template.id,
      name: template.name,
      slug: template.slug,
      description: template.description,
      categoryId: template.TemplateCategoryId,
      category: template.TemplateCategory ? {
        id: template.TemplateCategory.id,
        name: template.TemplateCategory.name,
        slug: template.TemplateCategory.slug,
        icon: template.TemplateCategory.icon,
        description: template.TemplateCategory.description,
        sortOrder: template.TemplateCategory.sortOrder,
        isActive: template.TemplateCategory.isActive,
        createdAt: template.TemplateCategory.createdAt.toISOString(),
        updatedAt: template.TemplateCategory.updatedAt.toISOString(),
      } : undefined,
      authorId: template.authorId,
      icon: template.icon,
      color: template.color,
      thumbnail: template.thumbnail,
      config: template.config,
      tags: template.tags,
      usageCount: template.usageCount,
      rating: template.rating,
      ratingCount: template.ratingCount,
      isPublic: template.isPublic,
      isOfficial: template.isOfficial,
      isFeatured: template.isFeatured,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    }

    return successResponse(formattedTemplate, 'Template criado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error creating template:', error)
    return errorResponse('Erro ao criar template', 500)
  }
}
