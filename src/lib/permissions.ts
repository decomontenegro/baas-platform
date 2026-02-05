/**
 * Team & Permissions System
 * 
 * Granular permission system for multi-tenant BaaS platform.
 */

import { MemberRole } from '@prisma/client';
import { prisma } from './prisma';

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

export const PERMISSIONS = {
  // Channels
  'channels:read': 'View channels and their configurations',
  'channels:write': 'Create and edit channels',
  'channels:delete': 'Delete channels',
  
  // Conversations
  'conversations:read': 'View conversations and messages',
  'conversations:respond': 'Respond to conversations (handoff)',
  
  // Knowledge Base
  'knowledge:read': 'View knowledge base documents',
  'knowledge:write': 'Create, edit, and delete knowledge base documents',
  
  // Analytics
  'analytics:read': 'View analytics and reports',
  'analytics:export': 'Export analytics data',
  
  // Team
  'team:read': 'View team members',
  'team:invite': 'Invite new team members',
  'team:manage': 'Manage team roles and permissions',
  
  // Billing
  'billing:read': 'View billing information and invoices',
  'billing:manage': 'Manage subscriptions and payment methods',
  
  // Settings
  'settings:read': 'View workspace settings',
  'settings:write': 'Modify workspace settings',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================================================
// ROLE DEFINITIONS WITH DEFAULT PERMISSIONS
// ============================================================================

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  // Owner: Full access to everything
  OWNER: Object.keys(PERMISSIONS) as Permission[],
  
  // Admin: Everything except ownership transfer
  ADMIN: [
    'channels:read', 'channels:write', 'channels:delete',
    'conversations:read', 'conversations:respond',
    'knowledge:read', 'knowledge:write',
    'analytics:read', 'analytics:export',
    'team:read', 'team:invite', 'team:manage',
    'billing:read', 'billing:manage',
    'settings:read', 'settings:write',
  ],
  
  // Manager: Channel management, analytics, limited team management
  MANAGER: [
    'channels:read', 'channels:write',
    'conversations:read', 'conversations:respond',
    'knowledge:read', 'knowledge:write',
    'analytics:read', 'analytics:export',
    'team:read',
    'settings:read',
  ],
  
  // Operator: Handle conversations, view channels
  OPERATOR: [
    'channels:read',
    'conversations:read', 'conversations:respond',
    'knowledge:read',
    'analytics:read',
    'team:read',
  ],
  
  // Viewer: Read-only access
  VIEWER: [
    'channels:read',
    'conversations:read',
    'knowledge:read',
    'analytics:read',
    'team:read',
  ],
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  OWNER: 'Full access to everything including ownership transfer',
  ADMIN: 'Full access to all features, can manage team and billing',
  MANAGER: 'Manage channels, knowledge base, and view analytics',
  OPERATOR: 'Respond to conversations and view data',
  VIEWER: 'Read-only access to data',
};

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

export interface UserContext {
  id: string;
  tenantId: string;
  role?: MemberRole;
  permissions?: string[];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[],
  permission: Permission
): boolean {
  return userPermissions.includes(permission);
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  permissions: Permission[]
): boolean {
  return permissions.every(p => userPermissions.includes(p));
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  permissions: Permission[]
): boolean {
  return permissions.some(p => userPermissions.includes(p));
}

/**
 * Get effective permissions for a user based on their role and custom permissions
 */
export function getEffectivePermissions(
  role: MemberRole,
  customPermissions?: string[]
): Permission[] {
  const rolePerms = new Set(ROLE_PERMISSIONS[role] || []);
  
  // Add any custom permissions
  if (customPermissions) {
    customPermissions.forEach(p => {
      if (p in PERMISSIONS) {
        rolePerms.add(p as Permission);
      }
    });
  }
  
  return Array.from(rolePerms);
}

/**
 * Check if a role can modify another role (hierarchy check)
 */
export function canModifyRole(actorRole: MemberRole, targetRole: MemberRole): boolean {
  const hierarchy: Record<MemberRole, number> = {
    OWNER: 5,
    ADMIN: 4,
    MANAGER: 3,
    OPERATOR: 2,
    VIEWER: 1,
  };
  
  // Can only modify roles below your level
  // OWNER can modify ADMIN and below
  // ADMIN can modify MANAGER and below
  return hierarchy[actorRole] > hierarchy[targetRole];
}

/**
 * Get assignable roles for a given role
 */
export function getAssignableRoles(actorRole: MemberRole): MemberRole[] {
  const allRoles: MemberRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];
  return allRoles.filter(role => canModifyRole(actorRole, role) || role === actorRole);
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Get team member with permissions from database
 */
export async function getTeamMember(userId: string, tenantId: string) {
  const member = await prisma.teamMember.findUnique({
    where: {
      tenantId_userId: { tenantId, userId },
      deletedAt: null,
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
  
  return member;
}

/**
 * Get user's effective permissions for a tenant
 */
export async function getUserPermissions(
  userId: string,
  tenantId: string
): Promise<Permission[]> {
  const member = await getTeamMember(userId, tenantId);
  
  if (!member) {
    return [];
  }
  
  return getEffectivePermissions(member.role, member.permissions);
}

/**
 * Check if user has permission (database lookup)
 */
export async function checkPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, tenantId);
  return hasPermission(permissions, permission);
}

/**
 * Require permission or throw error
 */
export async function requirePermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<void> {
  const hasAccess = await checkPermission(userId, tenantId, permission);
  
  if (!hasAccess) {
    throw new PermissionDeniedError(
      `Missing required permission: ${permission}`,
      permission
    );
  }
}

/**
 * Log team activity
 */
export async function logTeamActivity(
  tenantId: string,
  actorId: string,
  action: 'MEMBER_INVITED' | 'MEMBER_JOINED' | 'MEMBER_ROLE_CHANGED' | 
          'MEMBER_PERMISSIONS_CHANGED' | 'MEMBER_REMOVED' | 
          'INVITE_CANCELLED' | 'INVITE_RESENT' | 'INVITE_EXPIRED',
  targetType: 'member' | 'invite' | 'permission',
  details: {
    targetId?: string;
    targetEmail?: string;
    [key: string]: unknown;
  }
) {
  return prisma.teamActivityLog.create({
    data: {
      tenantId,
      actorId,
      action,
      targetType,
      targetId: details.targetId,
      targetEmail: details.targetEmail,
      details,
    },
  });
}

// ============================================================================
// ERRORS
// ============================================================================

export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    public readonly permission?: Permission
  ) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * API Route middleware to check permissions
 */
export function withPermission(permission: Permission) {
  return async function middleware(
    handler: (req: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse>,
    req: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get tenant from header or query
    const tenantId = req.headers.get('x-tenant-id') || 
                     req.nextUrl.searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 400 }
      );
    }
    
    try {
      await requirePermission(session.user.id, tenantId, permission);
      return handler(req, context);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return NextResponse.json(
          { error: error.message, permission: error.permission },
          { status: 403 }
        );
      }
      throw error;
    }
  };
}

/**
 * Create a permission-protected API handler
 */
export function createProtectedHandler(
  permission: Permission,
  handler: (
    req: NextRequest,
    context: { 
      params: Record<string, string>;
      session: { user: { id: string } };
      tenantId: string;
      permissions: Permission[];
    }
  ) => Promise<NextResponse>
) {
  return async function protectedHandler(
    req: NextRequest,
    { params }: { params: Record<string, string> }
  ): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get tenant from various sources
    const tenantId = req.headers.get('x-tenant-id') || 
                     req.nextUrl.searchParams.get('tenantId') ||
                     params.tenantId;
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 400 }
      );
    }
    
    try {
      const permissions = await getUserPermissions(session.user.id, tenantId);
      
      if (!hasPermission(permissions, permission)) {
        return NextResponse.json(
          { error: `Missing required permission: ${permission}` },
          { status: 403 }
        );
      }
      
      return handler(req, { 
        params, 
        session: session as { user: { id: string } },
        tenantId,
        permissions,
      });
    } catch (error) {
      console.error('[Permission Error]', error);
      return NextResponse.json(
        { error: 'Permission check failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to get current user's team context
 */
export async function getTeamContext(userId: string, tenantId: string) {
  const member = await getTeamMember(userId, tenantId);
  
  if (!member) {
    return null;
  }
  
  return {
    member,
    role: member.role,
    permissions: getEffectivePermissions(member.role, member.permissions),
    isOwner: member.role === 'OWNER',
    isAdmin: member.role === 'OWNER' || member.role === 'ADMIN',
    canManageTeam: hasPermission(
      getEffectivePermissions(member.role, member.permissions),
      'team:manage'
    ),
    canInvite: hasPermission(
      getEffectivePermissions(member.role, member.permissions),
      'team:invite'
    ),
  };
}
