import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { db } from '../src/prisma/db';
import {
  hasRequiredWorkspaceRole,
  requireWorkspaceRole,
  type WorkspaceRole,
} from '../src/middleware/requireWorkspaceRole';
import { buildTestApp } from './utils/buildTestApp';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

const routePath = '/workspaces/:workspaceId';

// Remember what we create so we can delete it after each test.
const createdUserIds: string[] = [];
const createdWorkspaceIds: string[] = [];

async function createUser() {
  const user = await db.orm.public.User.create({
    username: `user-${randomUUID().slice(0, 8)}`,
    email: `role-${randomUUID()}@example.com`,
    passwordHash: 'not-a-real-hash',
  });
  createdUserIds.push(user.id);
  return { id: user.id, username: user.username, email: user.email };
}

async function createWorkspace() {
  const workspace = await db.orm.public.Workspace.create({
    name: 'Test workspace',
    visibility: 'PRIVATE',
  });
  createdWorkspaceIds.push(workspace.id);
  return workspace;
}

async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await db.orm.public.WorkspaceMember.create({ workspaceId, userId, role });
}

describe('hasRequiredWorkspaceRole', () => {
  it('allows an admin to perform admin actions', () => {
    expect(hasRequiredWorkspaceRole('ADMIN', 'ADMIN')).toBe(true);
  });

  it('allows a member to perform member-level actions', () => {
    expect(hasRequiredWorkspaceRole('MEMBER', 'MEMBER')).toBe(true);
  });

  it('allows an admin to perform member-level actions', () => {
    expect(hasRequiredWorkspaceRole('ADMIN', 'MEMBER')).toBe(true);
  });

  it('denies a member from performing admin actions', () => {
    expect(hasRequiredWorkspaceRole('MEMBER', 'ADMIN')).toBe(false);
  });
});

describe('requireWorkspaceRole middleware', () => {
  afterEach(async () => {
    // Delete in this order: members first, because they point to workspaces and users.
    if (createdWorkspaceIds.length > 0) {
      await db.orm.public.WorkspaceMember
        .where((m) => m.workspaceId.in(createdWorkspaceIds))
        .delete();
      await db.orm.public.Workspace
        .where((w) => w.id.in(createdWorkspaceIds))
        .delete();
    }
    if (createdUserIds.length > 0) {
      await db.orm.public.User
        .where((u) => u.id.in(createdUserIds))
        .delete();
    }
    createdWorkspaceIds.length = 0;
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await db.close();
  });

  it('returns 401 when the user is not logged in', async () => {
    const workspace = await createWorkspace();
    const app = buildTestApp({
      path: routePath,
      middleware: requireWorkspaceRole('MEMBER'),
    });

    const res = await request(app).get(`/workspaces/${workspace.id}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user is not a member of the workspace', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();
    const app = buildTestApp({
      path: routePath,
      middleware: requireWorkspaceRole('MEMBER'),
      user,
    });

    const res = await request(app).get(`/workspaces/${workspace.id}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 when a member tries an admin action', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();
    await addMember(workspace.id, user.id, 'MEMBER');
    const app = buildTestApp({
      path: routePath,
      middleware: requireWorkspaceRole('ADMIN'),
      user,
    });

    const res = await request(app).get(`/workspaces/${workspace.id}`);
    expect(res.status).toBe(403);
  });

  it('lets a member through to a member route', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();
    await addMember(workspace.id, user.id, 'MEMBER');
    const app = buildTestApp({
      path: routePath,
      middleware: requireWorkspaceRole('MEMBER'),
      user,
    });

    const res = await request(app).get(`/workspaces/${workspace.id}`);
    expect(res.status).toBe(200);
  });

  it('lets an admin through to an admin route', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();
    await addMember(workspace.id, user.id, 'ADMIN');
    const app = buildTestApp({
      path: routePath,
      middleware: requireWorkspaceRole('ADMIN'),
      user,
    });

    const res = await request(app).get(`/workspaces/${workspace.id}`);
    expect(res.status).toBe(200);
  });
});
