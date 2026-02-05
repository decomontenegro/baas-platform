/**
 * Team + Permissions Evaluation Script
 * 
 * Tests:
 * 1. /team - Member listing
 * 2. /api/team - CRUD members
 * 3. /api/team/invite - Invites
 * 4. Permissions by role (OWNER, ADMIN, etc)
 * 5. Activity log
 * 6. Remove/edit member
 */

import { PrismaClient, MemberRole } from '@prisma/client';
import {
  getUserPermissions,
  hasPermission,
  getEffectivePermissions,
  canModifyRole,
  getAssignableRoles,
  ROLE_PERMISSIONS,
  PERMISSIONS,
} from '../src/lib/permissions';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMsg });
      console.log(`❌ ${name}: ${errorMsg}`);
    }
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log('\n🧪 Starting Team + Permissions Tests\n');
  console.log('=' .repeat(60));

  // ========================================================================
  // Setup: Create test data
  // ========================================================================
  
  let testTenant: { id: string } | null = null;
  let ownerUser: { id: string } | null = null;
  let adminUser: { id: string } | null = null;
  let operatorUser: { id: string } | null = null;
  let viewerUser: { id: string } | null = null;

  try {
    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        name: 'Test Team Tenant',
        slug: `test-team-${Date.now()}`,
        status: 'ACTIVE',
      },
    });

    // Create test users
    ownerUser = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@test.com`,
        name: 'Test Owner',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@test.com`,
        name: 'Test Admin',
      },
    });

    operatorUser = await prisma.user.create({
      data: {
        email: `operator-${Date.now()}@test.com`,
        name: 'Test Operator',
      },
    });

    viewerUser = await prisma.user.create({
      data: {
        email: `viewer-${Date.now()}@test.com`,
        name: 'Test Viewer',
      },
    });

    // Create team members with different roles
    await prisma.teamMember.create({
      data: {
        tenantId: testTenant.id,
        userId: ownerUser.id,
        role: 'OWNER',
      },
    });

    await prisma.teamMember.create({
      data: {
        tenantId: testTenant.id,
        userId: adminUser.id,
        role: 'ADMIN',
        invitedById: ownerUser.id,
      },
    });

    await prisma.teamMember.create({
      data: {
        tenantId: testTenant.id,
        userId: operatorUser.id,
        role: 'OPERATOR',
        invitedById: adminUser.id,
      },
    });

    await prisma.teamMember.create({
      data: {
        tenantId: testTenant.id,
        userId: viewerUser.id,
        role: 'VIEWER',
        invitedById: adminUser.id,
      },
    });

    console.log('\n📦 Test data created\n');

    // ========================================================================
    // Test 1: Permission Definitions
    // ========================================================================
    
    console.log('\n--- 1. Permission Definitions ---\n');

    await test('All roles have defined permissions', () => {
      const roles: MemberRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];
      roles.forEach(role => {
        assert(
          ROLE_PERMISSIONS[role] && ROLE_PERMISSIONS[role].length > 0,
          `Role ${role} has no permissions defined`
        );
      });
    })();

    await test('OWNER has all permissions', () => {
      const ownerPerms = ROLE_PERMISSIONS.OWNER;
      const allPerms = Object.keys(PERMISSIONS);
      assert(
        allPerms.every(p => ownerPerms.includes(p as any)),
        'OWNER is missing some permissions'
      );
    })();

    await test('Permission hierarchy is correct', () => {
      // ADMIN should have more perms than MANAGER
      assert(
        ROLE_PERMISSIONS.ADMIN.length >= ROLE_PERMISSIONS.MANAGER.length,
        'ADMIN should have >= permissions than MANAGER'
      );
      // MANAGER should have more perms than OPERATOR
      assert(
        ROLE_PERMISSIONS.MANAGER.length >= ROLE_PERMISSIONS.OPERATOR.length,
        'MANAGER should have >= permissions than OPERATOR'
      );
      // OPERATOR should have more perms than VIEWER
      assert(
        ROLE_PERMISSIONS.OPERATOR.length >= ROLE_PERMISSIONS.VIEWER.length,
        'OPERATOR should have >= permissions than VIEWER'
      );
    })();

    // ========================================================================
    // Test 2: Role Hierarchy (canModifyRole)
    // ========================================================================
    
    console.log('\n--- 2. Role Hierarchy ---\n');

    await test('OWNER can modify all other roles', () => {
      assert(canModifyRole('OWNER', 'ADMIN'), 'OWNER should modify ADMIN');
      assert(canModifyRole('OWNER', 'MANAGER'), 'OWNER should modify MANAGER');
      assert(canModifyRole('OWNER', 'OPERATOR'), 'OWNER should modify OPERATOR');
      assert(canModifyRole('OWNER', 'VIEWER'), 'OWNER should modify VIEWER');
    })();

    await test('OWNER cannot modify another OWNER', () => {
      assert(!canModifyRole('OWNER', 'OWNER'), 'OWNER should not modify OWNER');
    })();

    await test('ADMIN can modify MANAGER, OPERATOR, VIEWER', () => {
      assert(canModifyRole('ADMIN', 'MANAGER'), 'ADMIN should modify MANAGER');
      assert(canModifyRole('ADMIN', 'OPERATOR'), 'ADMIN should modify OPERATOR');
      assert(canModifyRole('ADMIN', 'VIEWER'), 'ADMIN should modify VIEWER');
    })();

    await test('ADMIN cannot modify OWNER or ADMIN', () => {
      assert(!canModifyRole('ADMIN', 'OWNER'), 'ADMIN should not modify OWNER');
      assert(!canModifyRole('ADMIN', 'ADMIN'), 'ADMIN should not modify ADMIN');
    })();

    await test('MANAGER can only modify OPERATOR and VIEWER', () => {
      assert(!canModifyRole('MANAGER', 'OWNER'), 'MANAGER should not modify OWNER');
      assert(!canModifyRole('MANAGER', 'ADMIN'), 'MANAGER should not modify ADMIN');
      assert(!canModifyRole('MANAGER', 'MANAGER'), 'MANAGER should not modify MANAGER');
      assert(canModifyRole('MANAGER', 'OPERATOR'), 'MANAGER should modify OPERATOR');
      assert(canModifyRole('MANAGER', 'VIEWER'), 'MANAGER should modify VIEWER');
    })();

    await test('OPERATOR can only modify VIEWER', () => {
      assert(!canModifyRole('OPERATOR', 'OWNER'), 'OPERATOR should not modify OWNER');
      assert(!canModifyRole('OPERATOR', 'ADMIN'), 'OPERATOR should not modify ADMIN');
      assert(!canModifyRole('OPERATOR', 'MANAGER'), 'OPERATOR should not modify MANAGER');
      assert(!canModifyRole('OPERATOR', 'OPERATOR'), 'OPERATOR should not modify OPERATOR');
      assert(canModifyRole('OPERATOR', 'VIEWER'), 'OPERATOR should modify VIEWER');
    })();

    await test('VIEWER cannot modify anyone', () => {
      assert(!canModifyRole('VIEWER', 'OWNER'), 'VIEWER should not modify OWNER');
      assert(!canModifyRole('VIEWER', 'ADMIN'), 'VIEWER should not modify ADMIN');
      assert(!canModifyRole('VIEWER', 'MANAGER'), 'VIEWER should not modify MANAGER');
      assert(!canModifyRole('VIEWER', 'OPERATOR'), 'VIEWER should not modify OPERATOR');
      assert(!canModifyRole('VIEWER', 'VIEWER'), 'VIEWER should not modify VIEWER');
    })();

    // ========================================================================
    // Test 3: Effective Permissions
    // ========================================================================
    
    console.log('\n--- 3. Effective Permissions ---\n');

    await test('getEffectivePermissions returns role permissions', () => {
      const adminPerms = getEffectivePermissions('ADMIN', []);
      assert(
        adminPerms.includes('team:manage'),
        'ADMIN should have team:manage'
      );
      assert(
        adminPerms.includes('billing:manage'),
        'ADMIN should have billing:manage'
      );
    })();

    await test('Custom permissions are added to effective permissions', () => {
      const operatorPerms = getEffectivePermissions('OPERATOR', ['billing:read']);
      assert(
        operatorPerms.includes('billing:read'),
        'Custom billing:read should be included'
      );
      // Also has default OPERATOR perms
      assert(
        operatorPerms.includes('conversations:read'),
        'Should still have default OPERATOR perms'
      );
    })();

    await test('VIEWER has read-only permissions', () => {
      const viewerPerms = getEffectivePermissions('VIEWER', []);
      assert(viewerPerms.includes('channels:read'), 'VIEWER should read channels');
      assert(viewerPerms.includes('conversations:read'), 'VIEWER should read conversations');
      assert(!viewerPerms.includes('channels:write'), 'VIEWER should not write channels');
      assert(!viewerPerms.includes('team:manage'), 'VIEWER should not manage team');
    })();

    // ========================================================================
    // Test 4: Database Integration - getUserPermissions
    // ========================================================================
    
    console.log('\n--- 4. Database Integration ---\n');

    await test('getUserPermissions returns correct perms for OWNER', async () => {
      const perms = await getUserPermissions(ownerUser!.id, testTenant!.id);
      assert(perms.length === Object.keys(PERMISSIONS).length, 'OWNER should have all permissions');
    })();

    await test('getUserPermissions returns correct perms for ADMIN', async () => {
      const perms = await getUserPermissions(adminUser!.id, testTenant!.id);
      assert(perms.includes('team:manage'), 'ADMIN should have team:manage');
      assert(perms.includes('billing:manage'), 'ADMIN should have billing:manage');
    })();

    await test('getUserPermissions returns correct perms for OPERATOR', async () => {
      const perms = await getUserPermissions(operatorUser!.id, testTenant!.id);
      assert(perms.includes('conversations:respond'), 'OPERATOR should respond to conversations');
      assert(!perms.includes('team:manage'), 'OPERATOR should not manage team');
    })();

    await test('getUserPermissions returns empty for non-member', async () => {
      const nonMemberUser = await prisma.user.create({
        data: {
          email: `nonmember-${Date.now()}@test.com`,
          name: 'Non Member',
        },
      });
      const perms = await getUserPermissions(nonMemberUser.id, testTenant!.id);
      assert(perms.length === 0, 'Non-member should have no permissions');
      // Cleanup
      await prisma.user.delete({ where: { id: nonMemberUser.id } });
    })();

    // ========================================================================
    // Test 5: Team Member CRUD
    // ========================================================================
    
    console.log('\n--- 5. Team Member CRUD ---\n');

    await test('List team members', async () => {
      const members = await prisma.teamMember.findMany({
        where: {
          tenantId: testTenant!.id,
          deletedAt: null,
        },
        include: { user: true },
      });
      assert(members.length === 4, 'Should have 4 team members');
      const roles = members.map(m => m.role);
      assert(roles.includes('OWNER'), 'Should have OWNER');
      assert(roles.includes('ADMIN'), 'Should have ADMIN');
      assert(roles.includes('OPERATOR'), 'Should have OPERATOR');
      assert(roles.includes('VIEWER'), 'Should have VIEWER');
    })();

    await test('Update member role', async () => {
      const operator = await prisma.teamMember.findFirst({
        where: {
          tenantId: testTenant!.id,
          userId: operatorUser!.id,
        },
      });
      
      // Update to MANAGER
      const updated = await prisma.teamMember.update({
        where: { id: operator!.id },
        data: { role: 'MANAGER' },
      });
      assert(updated.role === 'MANAGER', 'Role should be updated to MANAGER');
      
      // Revert
      await prisma.teamMember.update({
        where: { id: operator!.id },
        data: { role: 'OPERATOR' },
      });
    })();

    await test('Soft delete member', async () => {
      const viewer = await prisma.teamMember.findFirst({
        where: {
          tenantId: testTenant!.id,
          userId: viewerUser!.id,
        },
      });
      
      // Soft delete
      await prisma.teamMember.update({
        where: { id: viewer!.id },
        data: { 
          deletedAt: new Date(),
          deletedBy: ownerUser!.id,
        },
      });
      
      // Verify soft deleted
      const deleted = await prisma.teamMember.findFirst({
        where: {
          id: viewer!.id,
          deletedAt: null,
        },
      });
      assert(deleted === null, 'Soft deleted member should not appear in normal queries');
      
      // Restore
      await prisma.teamMember.update({
        where: { id: viewer!.id },
        data: { 
          deletedAt: null,
          deletedBy: null,
        },
      });
    })();

    // ========================================================================
    // Test 6: Team Invites
    // ========================================================================
    
    console.log('\n--- 6. Team Invites ---\n');

    await test('Create team invite', async () => {
      const invite = await prisma.teamInvite.create({
        data: {
          tenantId: testTenant!.id,
          email: `invite-${Date.now()}@test.com`,
          role: 'OPERATOR',
          invitedById: adminUser!.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      assert(invite.token !== undefined, 'Invite should have a token');
      assert(invite.role === 'OPERATOR', 'Invite should have correct role');
      
      // Cleanup
      await prisma.teamInvite.delete({ where: { id: invite.id } });
    })();

    await test('Invite has unique token', async () => {
      const invite1 = await prisma.teamInvite.create({
        data: {
          tenantId: testTenant!.id,
          email: `invite1-${Date.now()}@test.com`,
          role: 'OPERATOR',
          invitedById: adminUser!.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      const invite2 = await prisma.teamInvite.create({
        data: {
          tenantId: testTenant!.id,
          email: `invite2-${Date.now()}@test.com`,
          role: 'VIEWER',
          invitedById: adminUser!.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      assert(invite1.token !== invite2.token, 'Tokens should be unique');
      
      // Cleanup
      await prisma.teamInvite.deleteMany({
        where: { id: { in: [invite1.id, invite2.id] } },
      });
    })();

    await test('Cannot create duplicate invite for same email', async () => {
      const email = `duplicate-${Date.now()}@test.com`;
      
      await prisma.teamInvite.create({
        data: {
          tenantId: testTenant!.id,
          email,
          role: 'OPERATOR',
          invitedById: adminUser!.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      
      let duplicateError = false;
      try {
        await prisma.teamInvite.create({
          data: {
            tenantId: testTenant!.id,
            email,
            role: 'VIEWER',
            invitedById: adminUser!.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (error) {
        duplicateError = true;
      }
      assert(duplicateError, 'Should not allow duplicate invites for same email');
      
      // Cleanup
      await prisma.teamInvite.deleteMany({
        where: { tenantId: testTenant!.id, email },
      });
    })();

    // ========================================================================
    // Test 7: Activity Log
    // ========================================================================
    
    console.log('\n--- 7. Activity Log ---\n');

    await test('Create activity log entry', async () => {
      const log = await prisma.teamActivityLog.create({
        data: {
          tenantId: testTenant!.id,
          actorId: ownerUser!.id,
          action: 'MEMBER_INVITED',
          targetType: 'invite',
          targetEmail: 'test@example.com',
          details: { role: 'OPERATOR' },
        },
      });
      assert(log.action === 'MEMBER_INVITED', 'Action should be recorded');
      assert(log.targetEmail === 'test@example.com', 'Target email should be recorded');
    })();

    await test('Activity log includes all action types', async () => {
      const actions = [
        'MEMBER_INVITED',
        'MEMBER_JOINED',
        'MEMBER_ROLE_CHANGED',
        'MEMBER_PERMISSIONS_CHANGED',
        'MEMBER_REMOVED',
        'INVITE_CANCELLED',
        'INVITE_RESENT',
      ];
      
      for (const action of actions) {
        await prisma.teamActivityLog.create({
          data: {
            tenantId: testTenant!.id,
            actorId: ownerUser!.id,
            action: action as any,
            targetType: 'member',
            details: {},
          },
        });
      }
      
      const logs = await prisma.teamActivityLog.findMany({
        where: { tenantId: testTenant!.id },
      });
      
      const loggedActions = new Set(logs.map(l => l.action));
      actions.forEach(a => {
        assert(loggedActions.has(a), `Action ${a} should be logged`);
      });
    })();

    // ========================================================================
    // Test 8: Assignable Roles
    // ========================================================================
    
    console.log('\n--- 8. Assignable Roles ---\n');

    await test('OWNER can assign all roles', () => {
      const assignable = getAssignableRoles('OWNER');
      assert(assignable.includes('ADMIN'), 'OWNER can assign ADMIN');
      assert(assignable.includes('MANAGER'), 'OWNER can assign MANAGER');
      assert(assignable.includes('OPERATOR'), 'OWNER can assign OPERATOR');
      assert(assignable.includes('VIEWER'), 'OWNER can assign VIEWER');
    })();

    await test('ADMIN can assign MANAGER, OPERATOR, VIEWER', () => {
      const assignable = getAssignableRoles('ADMIN');
      assert(!assignable.includes('OWNER'), 'ADMIN cannot assign OWNER');
      assert(assignable.includes('ADMIN'), 'ADMIN can assign ADMIN (same level)');
      assert(assignable.includes('MANAGER'), 'ADMIN can assign MANAGER');
      assert(assignable.includes('OPERATOR'), 'ADMIN can assign OPERATOR');
      assert(assignable.includes('VIEWER'), 'ADMIN can assign VIEWER');
    })();

    await test('MANAGER can assign OPERATOR, VIEWER', () => {
      const assignable = getAssignableRoles('MANAGER');
      assert(!assignable.includes('OWNER'), 'MANAGER cannot assign OWNER');
      assert(!assignable.includes('ADMIN'), 'MANAGER cannot assign ADMIN');
      assert(assignable.includes('MANAGER'), 'MANAGER can assign MANAGER (same level)');
      assert(assignable.includes('OPERATOR'), 'MANAGER can assign OPERATOR');
      assert(assignable.includes('VIEWER'), 'MANAGER can assign VIEWER');
    })();

    // ========================================================================
    // Summary
    // ========================================================================
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Test Results Summary\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`Total: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

  } finally {
    // ========================================================================
    // Cleanup
    // ========================================================================
    
    console.log('\n🧹 Cleaning up test data...\n');

    if (testTenant) {
      // Delete in order due to foreign keys
      await prisma.teamActivityLog.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.teamInvite.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.teamMember.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.tenant.delete({ where: { id: testTenant.id } });
    }

    // Delete test users
    const userIds = [ownerUser?.id, adminUser?.id, operatorUser?.id, viewerUser?.id].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await prisma.$disconnect();
  }
}

main().catch(console.error);
