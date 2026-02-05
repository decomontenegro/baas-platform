/**
// Force dynamic rendering
export const dynamic = 'force-dynamic'
 * Team Invite API Routes
 * 
 * POST /api/team/invite - Send invitation to email
 * DELETE /api/team/invite - Cancel invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getUserPermissions,
  hasPermission,
  logTeamActivity,
  PERMISSIONS,
  Permission,
} from '@/lib/permissions';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================================================
// POST - Send Invitation
// ============================================================================

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']),
  permissions: z.array(z.string()).optional(),
  expiresInDays: z.number().min(1).max(30).optional().default(7),
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
    if (!hasPermission(permissions, 'team:invite')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const body = await req.json();
    const validation = inviteSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { email, role, permissions: customPerms, expiresInDays } = validation.data;
    
    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      const existingMember = await prisma.teamMember.findFirst({
        where: {
          tenantId,
          userId: existingUser.id,
          deletedAt: null,
        },
      });
      
      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a team member' },
          { status: 409 }
        );
      }
    }
    
    // Check for existing pending invite
    const existingInvite = await prisma.teamInvite.findFirst({
      where: {
        tenantId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    
    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation is already pending for this email' },
        { status: 409 }
      );
    }
    
    // Get tenant info for email
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    
    // Get inviter info
    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    
    // Validate custom permissions
    const validPerms = customPerms?.filter(p => p in PERMISSIONS) || [];
    
    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const invite = await prisma.teamInvite.create({
      data: {
        tenantId,
        email,
        role,
        permissions: validPerms,
        invitedById: session.user.id,
        expiresAt,
      },
    });
    
    // Send invitation email
    const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invite/${invite.token}`;
    
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'BaaS <onboarding@resend.dev>',
        to: email,
        subject: `You've been invited to join ${tenant.name} on BaaS`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #8b5cf6;">Team Invitation</h2>
            <p><strong>${inviter?.name || 'A team member'}</strong> has invited you to join <strong>${tenant.name}</strong> on BaaS.</p>
            <p>Your role: <strong>${role}</strong></p>
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(to right, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
              Accept Invitation
            </a>
            <p style="color: #666; font-size: 14px;">This invitation expires in ${expiresInDays} days.</p>
            <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[Team Invite] Failed to send email:', emailError);
      // Don't fail the request - invitation is created, email can be resent
    }
    
    // Log activity
    await logTeamActivity(
      tenantId,
      session.user.id,
      'MEMBER_INVITED',
      'invite',
      {
        targetId: invite.id,
        targetEmail: email,
        role,
      }
    );
    
    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        permissions: invite.permissions,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      inviteUrl,
    }, { status: 201 });
  } catch (error) {
    console.error('[Team Invite API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel Invitation
// ============================================================================

const cancelSchema = z.object({
  inviteId: z.string(),
});

export async function DELETE(req: NextRequest) {
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
    if (!hasPermission(permissions, 'team:invite')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const body = await req.json();
    const validation = cancelSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { inviteId } = validation.data;
    
    // Find and delete invitation
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id: inviteId,
        tenantId,
        acceptedAt: null,
      },
    });
    
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    await prisma.teamInvite.delete({
      where: { id: inviteId },
    });
    
    // Log activity
    await logTeamActivity(
      tenantId,
      session.user.id,
      'INVITE_CANCELLED',
      'invite',
      {
        targetId: inviteId,
        targetEmail: invite.email,
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Invite API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH - Resend Invitation
// ============================================================================

export async function PATCH(req: NextRequest) {
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
    if (!hasPermission(permissions, 'team:invite')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    
    const body = await req.json();
    const { inviteId } = body;
    
    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID required' }, { status: 400 });
    }
    
    // Find invitation
    const invite = await prisma.teamInvite.findFirst({
      where: {
        id: inviteId,
        tenantId,
        acceptedAt: null,
      },
    });
    
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Extend expiration
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    const updatedInvite = await prisma.teamInvite.update({
      where: { id: inviteId },
      data: { expiresAt: newExpiresAt },
    });
    
    // Get tenant and inviter info for email
    const [tenant, inviter] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.user.findUnique({ where: { id: session.user.id } }),
    ]);
    
    // Resend email
    const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invite/${invite.token}`;
    
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'BaaS <onboarding@resend.dev>',
        to: invite.email,
        subject: `Reminder: You've been invited to join ${tenant?.name} on BaaS`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #8b5cf6;">Team Invitation Reminder</h2>
            <p><strong>${inviter?.name || 'A team member'}</strong> is reminding you about your invitation to join <strong>${tenant?.name}</strong> on BaaS.</p>
            <p>Your role: <strong>${invite.role}</strong></p>
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(to right, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
              Accept Invitation
            </a>
            <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[Team Invite] Failed to resend email:', emailError);
    }
    
    // Log activity
    await logTeamActivity(
      tenantId,
      session.user.id,
      'INVITE_RESENT',
      'invite',
      {
        targetId: inviteId,
        targetEmail: invite.email,
      }
    );
    
    return NextResponse.json({
      invite: {
        id: updatedInvite.id,
        email: updatedInvite.email,
        role: updatedInvite.role,
        expiresAt: updatedInvite.expiresAt,
      },
    });
  } catch (error) {
    console.error('[Team Invite API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
