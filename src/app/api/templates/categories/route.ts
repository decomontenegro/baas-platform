import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import {
  successResponse,
  errorResponse,
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/templates/categories
 * List all template categories
 */
export async function GET(_request: NextRequest) {
  try {
    const categories = await prisma.templateCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: {
            templates: {
              where: {
                deletedAt: null,
                isActive: true,
                isPublic: true,
              },
            },
          },
        },
      },
    })

    const formattedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      templateCount: category._count.templates,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    }))

    return successResponse(formattedCategories)
  } catch (error) {
    console.error('Error fetching template categories:', error)
    return errorResponse('Erro ao buscar categorias', 500)
  }
}
