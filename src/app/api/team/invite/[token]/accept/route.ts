/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Accept Team Invite API
 * 
 * POST /api/team/invite/[token]/accept - Accept invitation and join team
 * GET /api/team/invite/[token]/accept - Get invitation details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logTeamActivity } from '@/lib/permissions';

// ============================================================================
// GET - Get Invitation Details
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    // Find invitation
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
    
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 410 }
      );
    }
    
    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }
    
    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        permissions: invite.permissions,
        tenant: invite.tenant,
        invitedBy: invite.invitedBy,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error('[Accept Invite API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Accept Invitation
// ============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { token } = params;
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    // Find invitation
    const invite = await prisma.teamInvite.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 410 }
      );
    }
    
    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }
    
    // Get current user's email
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if email matches
    if (currentUser.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { 
          error: 'Email mismatch',
          message: `This invitation was sent to ${invite.email}. Please sign in with that email address.`,
        },
        { status: 403 }
      );
    }
    
    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: invite.tenantId,
          userId: session.user.id,
        },
      },
    });
    
    if (existingMember && !existingMember.deletedAt) {
      return NextResponse.json(
        { error: 'You are already a member of this team' },
        { status: 409 }
      );
    }
    
    // Accept invitation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or restore team member
      const member = existingMember
        ? await tx.teamMember.update({
            where: { id: existingMember.id },
            data: {
              role: invite.role,
              permissions: invite.permissions,
              invitedById: invite.invitedById,
              joinedAt: new Date(),
              deletedAt: null,
              deletedBy: null,
              updatedAt: new Date(),
            },
          })
        : await tx.teamMember.create({
            data: {
              tenantId: invite.tenantId,
              userId: session.user.id,
              role: invite.role,
              permissions: invite.permissions,
              invitedById: invite.invitedById,
            },
          });
      
      // Mark invitation as accepted
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: new Date(),
          acceptedById: session.user.id,
        },
      });
      
      // Update user's default tenant if not set
      if (!currentUser.tenantId) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { tenantId: invite.tenantId },
        });
      }
      
      return member;
    });
    
    // Log activity
    await logTeamActivity(
      invite.tenantId,
      session.user.id,
      'MEMBER_JOINED',
      'member',
      {
        targetId: result.id,
        targetEmail: currentUser.email,
        role: invite.role,
        inviteId: invite.id,
      }
    );
    
    return NextResponse.json({
      success: true,
      member: {
        id: result.id,
        role: result.role,
        permissions: result.permissions,
        joinedAt: result.joinedAt,
      },
      tenant: invite.tenant,
    });
  } catch (error) {
    console.error('[Accept Invite API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
