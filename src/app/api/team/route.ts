/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Team API Routes
 * 
 * GET /api/team - List team members
 * POST /api/team - Add a user directly (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getUserPermissions,
  hasPermission,
  getEffectivePermissions,
  logTeamActivity,
  ROLE_PERMISSIONS,
  Permission,
} from '@/lib/permissions';
import { z } from 'zod';

// ============================================================================
// GET - List Team Members
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = req.headers.get('x-tenant-id') || 
                     req.nextUrl.searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    
    // Check permission
    const permissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(permissions, 'team:read')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    // Get team members
    const members = await prisma.teamMember.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastLoginAt: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });
    
    // Get pending invites
    const invites = await prisma.teamInvite.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Get activity log (last 50 entries)
    const activityLog = await prisma.teamActivityLog.findMany({
      where: { tenantId },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    // Format members with effective permissions
    const formattedMembers = members.map(member => ({
      id: member.id,
      userId: member.userId,
      user: member.user,
      role: member.role,
      permissions: member.permissions,
      effectivePermissions: getEffectivePermissions(member.role, member.permissions),
      invitedBy: member.invitedBy,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    }));
    
    return NextResponse.json({
      members: formattedMembers,
      pendingInvites: invites.map(invite => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        permissions: invite.permissions,
        invitedBy: invite.invitedBy,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      })),
      activityLog: activityLog.map(log => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        targetEmail: log.targetEmail,
        details: log.details,
        actor: log.actor,
        createdAt: log.createdAt,
      })),
      currentUserPermissions: permissions,
    });
  } catch (error) {
    console.error('[Team API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Add User Directly (Admin Only - for existing users)
// ============================================================================

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']),
  permissions: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tenantId = req.headers.get('x-tenant-id') || 
                     req.nextUrl.searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }
    
    // Check permission
    const permissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(permissions, 'team:manage')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const body = await req.json();
    const validation = addMemberSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { userId, role, permissions: customPerms } = validation.data;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });
    
    if (existingMember && !existingMember.deletedAt) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
    }
    
    // Validate custom permissions
    const validPerms = customPerms?.filter(p => p in ROLE_PERMISSIONS) || [];
    
    // Create or restore member
    const member = existingMember
      ? await prisma.teamMember.update({
          where: { id: existingMember.id },
          data: {
            role,
            permissions: validPerms,
            deletedAt: null,
            deletedBy: null,
            updatedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        })
      : await prisma.teamMember.create({
          data: {
            tenantId,
            userId,
            role,
            permissions: validPerms,
            invitedById: session.user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        });
    
    // Log activity
    await logTeamActivity(
      tenantId,
      session.user.id,
      'MEMBER_JOINED',
      'member',
      {
        targetId: member.id,
        targetEmail: user.email,
        role,
        addedDirectly: true,
      }
    );
    
    return NextResponse.json({
      member: {
        id: member.id,
        userId: member.userId,
        user: member.user,
        role: member.role,
        permissions: member.permissions,
        effectivePermissions: getEffectivePermissions(member.role, member.permissions as string[]),
        joinedAt: member.joinedAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Team API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
