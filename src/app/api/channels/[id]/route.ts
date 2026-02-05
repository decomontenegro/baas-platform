import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, noContent, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, updateChannelSchema } from '@/lib/api/validate'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// Helper to get and validate channel access
async function getChannelWithAccess(channelId: string, tenantId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          tenantId: true,
        },
      },
    },
  })

  if (!channel) {
    throw new NotFoundError('Channel')
  }

  if (channel.workspace.tenantId !== tenantId) {
    throw new ForbiddenError('Access denied to this channel')
  }

  return channel
}

// GET /api/channels/[id] - Get channel details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    const channel = await getChannelWithAccess(id, tenantId)

    return apiResponse({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        status: channel.status,
        workspaceId: channel.workspaceId,
        workspace: {
          id: channel.workspace.id,
          name: channel.workspace.name,
        },
        config: channel.config,
        metadata: channel.metadata,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/channels/[id] - Update channel
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    const existingChannel = await getChannelWithAccess(id, tenantId)

    const data = await parseBody(request, updateChannelSchema)

    const channel = await prisma.channel.update({
      where: { id: existingChannel.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.config !== undefined && {
          config: {
            ...(existingChannel.config as object),
            ...data.config,
          },
        }),
        ...(data.metadata !== undefined && {
          metadata: {
            ...(existingChannel.metadata as object),
            ...data.metadata,
          },
        }),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return apiResponse({ channel })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/channels/[id] - Delete channel
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params
    await getChannelWithAccess(id, tenantId)

    await prisma.channel.delete({
      where: { id },
    })

    return noContent()
  } catch (error) {
    return handleApiError(error)
  }
}
