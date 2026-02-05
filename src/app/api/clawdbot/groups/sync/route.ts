import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { ChannelType, ChannelStatus } from '@prisma/client'

/**
 * POST /api/clawdbot/groups/sync
 * Sync WhatsApp groups from Clawdbot config to database
 * Called from local server (not from Vercel)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify sync secret
    const syncSecret = request.headers.get('x-sync-secret')
    const expectedSecret = process.env.CLAWDBOT_SYNC_SECRET
    
    if (!expectedSecret || syncSecret !== expectedSecret) {
      return errorResponse('Invalid sync secret', 401)
    }
    
    const body = await request.json()
    const { groups, workspaceId } = body
    
    if (!groups || !Array.isArray(groups)) {
      return errorResponse('groups array is required', 400)
    }
    
    // Get or create default workspace
    let workspace = null
    if (workspaceId) {
      workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId }
      })
    }
    
    if (!workspace) {
      // Try to find default workspace
      workspace = await prisma.workspace.findFirst({
        where: { name: 'Clawdbot Default' }
      })
      
      // Create if doesn't exist
      if (!workspace) {
        // Get default tenant
        const tenant = await prisma.tenant.findFirst()
        if (!tenant) {
          return errorResponse('No tenant found. Create a tenant first.', 400)
        }
        
        workspace = await prisma.workspace.create({
          data: {
            name: 'Clawdbot Default',
            tenantId: tenant.id,
          }
        })
      }
    }
    
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    }
    
    for (const group of groups) {
      try {
        const externalId = group.id
        
        // Find existing channel by externalId
        const existing = await prisma.channel.findFirst({
          where: {
            type: ChannelType.WHATSAPP,
            config: {
              path: ['externalId'],
              equals: externalId
            }
          }
        })
        
        const channelData = {
          name: group.name || externalId.replace('@g.us', '').substring(0, 12) + '...',
          type: ChannelType.WHATSAPP,
          status: ChannelStatus.ACTIVE,
          isActive: group.enabled !== false,
          workspaceId: workspace.id,
          config: {
            externalId,
            requireMention: group.requireMention ?? true,
            prefix: group.prefix || null,
            model: group.model || 'default',
            enabled: group.enabled !== false,
            syncedAt: new Date().toISOString(),
          }
        }
        
        if (existing) {
          await prisma.channel.update({
            where: { id: existing.id },
            data: channelData
          })
          results.updated++
        } else {
          await prisma.channel.create({
            data: channelData
          })
          results.created++
        }
      } catch (err) {
        results.errors.push(`Error syncing ${group.id}: ${err}`)
        results.skipped++
      }
    }
    
    return successResponse({
      message: 'Sync completed',
      workspaceId: workspace.id,
      ...results,
    })
  } catch (error) {
    console.error('Error syncing groups:', error)
    return errorResponse('Erro ao sincronizar grupos', 500)
  }
}

/**
 * GET /api/clawdbot/groups/sync
 * Returns sync instructions
 */
export async function GET() {
  return NextResponse.json({
    message: 'WhatsApp Groups Sync API',
    usage: 'POST with groups array and x-sync-secret header',
    example: {
      headers: { 'x-sync-secret': 'your-secret' },
      body: {
        groups: [
          {
            id: '123456789@g.us',
            name: 'Group Name',
            requireMention: true,
            prefix: null,
            model: 'default',
            enabled: true
          }
        ]
      }
    }
  })
}
