import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
  requireAuth,
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/templates/[id]
 * Get a single template by ID or slug
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // Try to find by ID or slug
    const template = await prisma.template.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
        deletedAt: null,
        isActive: true,
      },
      include: {
        TemplateCategory: true,
      },
    })

    if (!template) {
      return errorResponse('Template não encontrado', 404)
    }

    // Check if public or user is owner
    if (!template.isPublic) {
      try {
        const userId = await requireAuth(request)
        if (template.authorId !== userId) {
          return errorResponse('Acesso negado', 403)
        }
      } catch {
        return errorResponse('Acesso negado', 403)
      }
    }

    // Increment view count (fire and forget)
    prisma.template.update({
      where: { id: template.id },
      data: { usageCount: { increment: 1 } },
    }).catch(() => {})

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

    return successResponse(formattedTemplate)
  } catch (error) {
    console.error('Error fetching template:', error)
    return errorResponse('Erro ao buscar template', 500)
  }
}

/**
 * PUT /api/templates/[id]
 * Update a template (only by owner)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await requireAuth(request)
    const { id } = await params
    const body = await request.json()

    // Find template
    const template = await prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!template) {
      return errorResponse('Template não encontrado', 404)
    }

    // Check ownership
    if (template.authorId !== userId) {
      return errorResponse('Você não tem permissão para editar este template', 403)
    }

    const {
      name,
      description,
      categoryId,
      icon,
      color,
      thumbnail,
      config,
      tags,
      isPublic,
    } = body

    // If changing slug, validate uniqueness
    if (body.slug && body.slug !== template.slug) {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugRegex.test(body.slug)) {
        return errorResponse('Slug deve conter apenas letras minúsculas, números e hífens')
      }
      const existingTemplate = await prisma.template.findUnique({
        where: { slug: body.slug },
      })
      if (existingTemplate && existingTemplate.id !== id) {
        return errorResponse('Um template com esse slug já existe')
      }
    }

    // If changing category, validate it exists
    if (categoryId && categoryId !== template.TemplateCategoryId) {
      const category = await prisma.templateCategory.findUnique({
        where: { id: categoryId },
      })
      if (!category) {
        return errorResponse('Categoria não encontrada', 404)
      }
    }

    // Update template
    const updatedTemplate = await prisma.template.update({
      where: { id },
      data: {
        name: name ?? undefined,
        slug: body.slug ?? undefined,
        description: description ?? undefined,
        categoryId: categoryId ?? undefined,
        icon: icon ?? undefined,
        color: color ?? undefined,
        thumbnail: thumbnail ?? undefined,
        config: config ?? undefined,
        tags: tags ? tags.map((tag: string) => tag.toLowerCase()) : undefined,
        isPublic: isPublic ?? undefined,
        updatedAt: new Date(),
      },
      include: {
        TemplateCategory: true,
      },
    })

    const formattedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      slug: updatedTemplate.slug,
      description: updatedTemplate.description,
      categoryId: updatedTemplate.categoryId,
      category: updatedTemplate.category ? {
        id: updatedTemplate.category.id,
        name: updatedTemplate.category.name,
        slug: updatedTemplate.category.slug,
        icon: updatedTemplate.category.icon,
        description: updatedTemplate.category.description,
        sortOrder: updatedTemplate.category.sortOrder,
        isActive: updatedTemplate.category.isActive,
        createdAt: updatedTemplate.category.createdAt.toISOString(),
        updatedAt: updatedTemplate.category.updatedAt.toISOString(),
      } : undefined,
      authorId: updatedTemplate.authorId,
      icon: updatedTemplate.icon,
      color: updatedTemplate.color,
      thumbnail: updatedTemplate.thumbnail,
      config: updatedTemplate.config,
      tags: updatedTemplate.tags,
      usageCount: updatedTemplate.usageCount,
      rating: updatedTemplate.rating,
      ratingCount: updatedTemplate.ratingCount,
      isPublic: updatedTemplate.isPublic,
      isOfficial: updatedTemplate.isOfficial,
      isFeatured: updatedTemplate.isFeatured,
      isActive: updatedTemplate.isActive,
      createdAt: updatedTemplate.createdAt.toISOString(),
      updatedAt: updatedTemplate.updatedAt.toISOString(),
    }

    return successResponse(formattedTemplate, 'Template atualizado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error updating template:', error)
    return errorResponse('Erro ao atualizar template', 500)
  }
}

/**
 * DELETE /api/templates/[id]
 * Soft delete a template (only by owner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await requireAuth(request)
    const { id } = await params

    // Find template
    const template = await prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    })

    if (!template) {
      return errorResponse('Template não encontrado', 404)
    }

    // Check ownership
    if (template.authorId !== userId) {
      return errorResponse('Você não tem permissão para deletar este template', 403)
    }

    // Soft delete
    await prisma.template.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false,
      },
    })

    return successResponse({ id }, 'Template deletado com sucesso')
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('Error deleting template:', error)
    return errorResponse('Erro ao deletar template', 500)
  }
}
