import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, createHandoffRequestSchema } from '@/lib/api/validate'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/handoff/request - Create a new handoff request
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const data = await parseBody(request, createHandoffRequestSchema)

    // Verify workspace belongs to tenant
    const workspace = await prisma.Workspace.findUnique({
      where: { id: data.WorkspaceId },
      include: { handoffSettings: true },
    })

    if (!workspace) {
      throw new NotFoundError('Workspace')
    }

    if (workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this workspace')
    }

    // Calculate SLA deadline if settings exist
    let slaDeadline: Date | undefined
    if (workspace.handoffSettings?.slaMinutes) {
      slaDeadline = new Date(Date.now() + workspace.handoffSettings.slaMinutes * 60 * 1000)
    }

    // Create the handoff request
    const handoffRequest = await prisma.handoffRequest.create({
      data: {
        workspaceId: data.WorkspaceId,
        channelId: data.channelId,
        conversationId: data.conversationId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerMeta: data.customerMeta || {},
        reason: data.reason,
        reasonText: data.reasonText,
        priority: data.priority,
        conversationHistory: data.conversationHistory || [],
        metadata: data.metadata || {},
        slaDeadline,
      },
      include: {
        Workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return apiResponse({ handoffRequest }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
