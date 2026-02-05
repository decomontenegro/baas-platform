/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Team Member Management API
 * 
 * GET /api/team/[id] - Get member details
 * PATCH /api/team/[id] - Update member role/permissions
 * DELETE /api/team/[id] - Remove member from team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getUserPermissions,
  hasPermission,
  getEffectivePermissions,
  canModifyRole,
  logTeamActivity,
  getTeamMember,
  PERMISSIONS,
  Permission,
} from '@/lib/permissions';
import { MemberRole } from '@prisma/client';
import { z } from 'zod';

// ============================================================================
// GET - Get Member Details
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const { id: memberId } = params;
    
    // Get member
    const member = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
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
            createdAt: true,
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
    });
    
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    
    // Get member's activity
    const activity = await prisma.teamActivityLog.findMany({
      where: {
        OR: [
          { actorId: member.userId },
          { targetId: member.id },
        ],
        tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    return NextResponse.json({
      member: {
        id: member.id,
        userId: member.userId,
        user: member.user,
        role: member.role,
        permissions: member.permissions,
        effectivePermissions: getEffectivePermissions(member.role, member.permissions),
        invitedBy: member.invitedBy,
        joinedAt: member.joinedAt,
        createdAt: member.createdAt,
      },
      activity,
    });
  } catch (error) {
    console.error('[Team Member API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH - Update Member Role/Permissions
// ============================================================================

const updateSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const userPermissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(userPermissions, 'team:manage')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const { id: memberId } = params;
    
    const body = await req.json();
    const validation = updateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { role: newRole, permissions: customPerms } = validation.data;
    
    // Get the target member
    const targetMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        tenantId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
    
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    
    // Get current user's membership to check hierarchy
    const currentUserMember = await getTeamMember(session.user.id, tenantId);
    
    if (!currentUserMember) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }
    
    // Cannot modify yourself (except owner can do anything)
    if (targetMember.userId === session.user.id && currentUserMember.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot modify your own role/permissions' },
        { status: 403 }
      );
    }
    
    // Cannot modify owner
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot modify the owner\'s role' },
        { status: 403 }
      );
    }
    
    // Check hierarchy - can only modify roles below yours
    if (!canModifyRole(currentUserMember.role, targetMember.role)) {
      return NextResponse.json(
        { error: 'Cannot modify a member with equal or higher role' },
        { status: 403 }
      );
    }
    
    // If changing role, verify new role is lower than actor's role
    if (newRole && !canModifyRole(currentUserMember.role, newRole as MemberRole)) {
      return NextResponse.json(
        { error: 'Cannot assign a role equal to or higher than your own' },
        { status: 403 }
      );
    }
    
    // Validate custom permissions
    const validPerms = customPerms?.filter(p => p in PERMISSIONS) || undefined;
    
    // Build update data
    const updateData: { role?: MemberRole; permissions?: string[]; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    
    if (newRole) {
      updateData.role = newRole as MemberRole;
    }
    
    if (validPerms !== undefined) {
      updateData.permissions = validPerms;
    }
    
    // Update member
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: updateData,
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
    if (newRole && newRole !== targetMember.role) {
      await logTeamActivity(
        tenantId,
        session.user.id,
        'MEMBER_ROLE_CHANGED',
        'member',
        {
          targetId: memberId,
          targetEmail: targetMember.user.email,
          oldRole: targetMember.role,
          newRole,
        }
      );
    }
    
    if (validPerms !== undefined) {
      await logTeamActivity(
        tenantId,
        session.user.id,
        'MEMBER_PERMISSIONS_CHANGED',
        'permission',
        {
          targetId: memberId,
          targetEmail: targetMember.user.email,
          oldPermissions: targetMember.permissions,
          newPermissions: validPerms,
        }
      );
    }
    
    return NextResponse.json({
      member: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        user: updatedMember.user,
        role: updatedMember.role,
        permissions: updatedMember.permissions,
        effectivePermissions: getEffectivePermissions(
          updatedMember.role,
          updatedMember.permissions
        ),
      },
    });
  } catch (error) {
    console.error('[Team Member API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Remove Member from Team
// ============================================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const userPermissions = await getUserPermissions(session.user.id, tenantId);
    if (!hasPermission(userPermissions, 'team:manage')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const { id: memberId } = params;
    
    // Get the target member
    const targetMember = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        tenantId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
    
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    
    // Get current user's membership
    const currentUserMember = await getTeamMember(session.user.id, tenantId);
    
    if (!currentUserMember) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }
    
    // Cannot remove yourself (use leave team instead)
    if (targetMember.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself. Use leave team instead.' },
        { status: 403 }
      );
    }
    
    // Cannot remove owner
    if (targetMember.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot remove the owner from the team' },
        { status: 403 }
      );
    }
    
    // Check hierarchy
    if (!canModifyRole(currentUserMember.role, targetMember.role)) {
      return NextResponse.json(
        { error: 'Cannot remove a member with equal or higher role' },
        { status: 403 }
      );
    }
    
    // Soft delete member
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    });
    
    // Log activity
    await logTeamActivity(
      tenantId,
      session.user.id,
      'MEMBER_REMOVED',
      'member',
      {
        targetId: memberId,
        targetEmail: targetMember.user.email,
        role: targetMember.role,
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Member API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
