import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, updateTenantSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// GET /api/tenants - Get current user's tenant
export async function GET() {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            memberships: true,
            workspaces: true,
          },
        },
      },
    })

    if (!tenant) {
      throw new NotFoundError('Tenant')
    }

    return apiResponse({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        settings: tenant.settings,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        _count: tenant._count,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/tenants - Update current user's tenant settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId
    const role = session.user.role

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    // Only owners and admins can update tenant
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only owners and admins can update tenant settings')
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    })

    if (!tenant) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, updateTenantSchema)

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.settings && {
          settings: {
            ...(tenant.settings as object),
            ...data.settings,
          },
        }),
      },
    })

    return apiResponse({
      tenant: updatedTenant,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
