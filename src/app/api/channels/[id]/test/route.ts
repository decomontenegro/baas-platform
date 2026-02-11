import { NextRequest } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { handleApiError, apiResponse, NotFoundError, ForbiddenError, BadRequestError, UnauthorizedError } from '@/lib/api/errors'
import { parseBody, testChannelSchema } from '@/lib/api/validate'

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

// POST /api/channels/[id]/test - Test bot on channel
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth()
    const tenantId = session.user.tenantId

    if (!tenantId) {
      throw new NotFoundError('Tenant')
    }

    const { id } = await params

    // Get channel and verify access
    const channel = await prisma.Channel.findUnique({
      where: { id },
      include: {
        Workspace: {
          select: {
            id: true,
            name: true,
            tenantId: true,
            settings: true,
          },
        },
      },
    })

    if (!channel) {
      throw new NotFoundError('Channel')
    }

    if (channel.Workspace.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this channel')
    }

    // Check if channel is properly configured
    if (channel.status === 'ERROR') {
      throw new BadRequestError('Channel is in error state. Please fix configuration first.')
    }

    const data = await parseBody(request, testChannelSchema)

    // Mock bot response based on channel type
    // In production, this would connect to actual bot engine
    const mockResponses: Record<string, string> = {
      WHATSAPP: '📱 [WhatsApp Bot] Received your message!',
      TELEGRAM: '🤖 [Telegram Bot] Message processed!',
      DISCORD: '🎮 [Discord Bot] I heard you!',
      SLACK: '💼 [Slack Bot] Got it!',
      WEBCHAT: '💬 [Webchat Bot] Thanks for your message!',
      API: '🔌 [API Bot] Request received!',
    }

    // Simulate processing delay
    const processingTime = Math.floor(Math.random() * 300) + 100

    // Build mock response
    const response = {
      success: true,
      Channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        status: channel.status,
      },
      test: {
        input: {
          message: data.message,
          timestamp: new Date().toISOString(),
        },
        output: {
          response: mockResponses[channel.type] || 'Bot response received!',
          processingTimeMs: processingTime,
          timestamp: new Date(Date.now() + processingTime).toISOString(),
        },
        metadata: {
          workspaceId: channel.Workspace.id,
          workspaceName: channel.Workspace.name,
          channelConfig: Object.keys(channel.config as object || {}).length > 0 
            ? 'configured' 
            : 'default',
          simulatedResponse: true,
        },
      },
    }

    return apiResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
}
