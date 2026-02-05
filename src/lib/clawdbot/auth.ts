/**
 * Clawdbot API Authentication Helper
 * Gets authenticated user and tenant from session
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { clawdbotLogger } from '@/lib/logger';

const logger = clawdbotLogger.child({ component: 'auth' });

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export type AuthResult = {
  success: true;
  user: AuthenticatedUser;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
  };
}

/**
 * Get authenticated user from session with tenant information
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      logger.debug('No session found');
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          status: 401,
        },
      };
    }

    // Get user with tenant membership
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: true },
          take: 1,
        },
      },
    });

    if (!user) {
      logger.warn({ userId: session.user.id }, 'User not found in database');
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          status: 404,
        },
      };
    }

    // Get tenant from membership or direct relation
    const tenantId = user.memberships[0]?.tenantId || user.tenantId;
    const role = user.memberships[0]?.role || user.role;

    if (!tenantId) {
      logger.warn({ userId: user.id }, 'User has no tenant');
      return {
        success: false,
        error: {
          code: 'NO_TENANT',
          message: 'User is not associated with any organization',
          status: 403,
        },
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId,
        role: role as AuthenticatedUser['role'],
      },
    };
  } catch (error) {
    logger.error({ err: error }, 'Auth error');
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        status: 500,
      },
    };
  }
}

/**
 * Check if user has required permission
 */
export function hasPermission(
  user: AuthenticatedUser,
  required: 'read' | 'write' | 'admin' | 'owner'
): boolean {
  const roleHierarchy: Record<string, number> = {
    VIEWER: 1,
    MEMBER: 2,
    ADMIN: 3,
    OWNER: 4,
  };

  const requiredLevel: Record<string, number> = {
    read: 1,
    write: 2,
    admin: 3,
    owner: 4,
  };

  return (roleHierarchy[user.role] || 0) >= requiredLevel[required];
}

/**
 * Require specific permission - returns error response or null
 */
export function requirePermission(
  user: AuthenticatedUser,
  required: 'read' | 'write' | 'admin' | 'owner'
): { code: string; message: string; status: number } | null {
  if (!hasPermission(user, required)) {
    return {
      code: 'FORBIDDEN',
      message: `Insufficient permissions. Required: ${required}`,
      status: 403,
    };
  }
  return null;
}
