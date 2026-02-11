import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { 
  handleApiError, 
  apiResponse, 
  NotFoundError, 
  ForbiddenError, 
  UnauthorizedError,
  BadRequestError,
} from '@/lib/api/errors'
import { parseBody } from '@/lib/api/validate'
import { executeActionSchema } from '@/lib/api/actions-schemas'
import { executeAction, parseCommand } from '@/lib/actions'
import { ActionContext } from '@/lib/actions/types'

// Helper to get authenticated session
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// POST /api/actions/[id]/execute - Execute a specific action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.TenantId
    const { id } = await params

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const action = await prisma.quickAction.findUnique({
      where: { id },
    })

    if (!action || action.deletedAt) {
      throw new NotFoundError('Action')
    }

    if (action.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this action')
    }

    if (!action.isEnabled) {
      throw new BadRequestError('Action is disabled')
    }

    const data = await parseBody(request, executeActionSchema)

    // Parse args from message or use provided args
    let args = data.args || []
    if (!args.length && data.message) {
      const parsed = parseCommand(data.message)
      args = parsed.args
    }

    // Build context
    const context: ActionContext = {
      tenantId,
      channelId: data.channelId,
      conversationId: data.conversationId,
      userId: data.userId,
      userName: data.userName,
      message: data.message,
      recentMessages: data.recentMessages?.map(m => ({
        ...m,
        createdAt: new Date(m.createdAt),
      })),
      metadata: data.metadata,
    }

    // Execute the action
    const result = await executeAction(action, context, args)

    return apiResponse({
      success: result.success,
      output: result.output,
      error: result.error,
      data: result.data,
      durationMs: result.durationMs,
      action: {
        id: action.id,
        name: action.name,
        trigger: action.trigger,
        type: action.type,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
