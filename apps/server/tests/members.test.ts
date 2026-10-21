
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import app from '../src/app';
import { db } from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL is not a test database',
  );
}

const baseUrl = '/api/v1/workspaces';

const createdEmails = new Set<string>();

async function loginAsNewUser() {
  const email = `ws-member-${randomUUID()}@example.com`;
  createdEmails.add(email);

  const user = {
    username: `user-${randomUUID().slice(0, 8)}`,
    email,
    password: 'password123',
  };

  const agent = request.agent(app);

  const registerRes = await agent
    .post('/api/v1/auth/register')
    .send(user);

  expect(registerRes.status).toBe(201);

  const loginRes = await agent
    .post('/api/v1/auth/login')
    .send({ email, password: user.password });

  expect(loginRes.status).toBe(200);

  return {
    agent,
    id: registerRes.body.data.user.id as string,
    email,
  };
}

type Agent = ReturnType<typeof request.agent>;

async function createWorkspace(agent: Agent, name = 'Team A') {
  const res = await agent
    .post(baseUrl)
    .send({ name, visibility: 'PRIVATE' });

  expect(res.status).toBe(201);

  return res.body.data.workspace as {
    id: string;
    name: string;
  };
}

async function addMember(
  workspaceId: string,
  userId: string,
  role: 'ADMIN' | 'MEMBER' = 'MEMBER',
) {
  return db.orm.public.WorkspaceMember.create({
    workspaceId,
    userId,
    role,
  });
}

async function cleanupCreatedUsers() {
  if (createdEmails.size === 0) return;

  const emails = [...createdEmails];

  const users = await db.orm.public.User
    .where((u) => u.email.in(emails))
    .select('id')
    .all();

  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    const memberships = await db.orm.public.WorkspaceMember
      .where((m) => m.userId.in(userIds))
      .select('workspaceId')
      .all();

    const workspaceIds = [
      ...new Set(memberships.map((m) => m.workspaceId)),
    ];

    if (workspaceIds.length > 0) {
      await db.orm.public.WorkspaceMember
        .where((m) => m.workspaceId.in(workspaceIds))
        .deleteAll();

      await db.orm.public.Workspace
        .where((w) => w.id.in(workspaceIds))
        .deleteAll();
    }
  }

  await db.orm.public.User
    .where((u) => u.email.in(emails))
    .deleteAll();

  createdEmails.clear();
}

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await cleanupCreatedUsers();
});

function membersUrl(workspaceId: string, userId?: string) {
  const url = `${baseUrl}/${workspaceId}/members`;
  return userId ? `${url}/${userId}` : url;
}

async function getRole(workspaceId: string, userId: string) {
  const membership = await db.orm.public.WorkspaceMember
    .where({ workspaceId, userId })
    .first();
  return membership?.role ?? null;
}

async function listWorkspaceIds(agent: Agent) {
  const res = await agent.get(baseUrl);
  expect(res.status).toBe(200);
  return res.body.data.workspaces.map((w: { id: string }) => w.id) as string[];
}

describe('Workspace membership integration tests', () => {
  describe('access control', () => {
    it('returns 403 when a MEMBER tries to add, update or remove members', async () => {
      const admin = await loginAsNewUser();
      const member = await loginAsNewUser();
      const outsider = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);
      await addMember(workspace.id, member.id);

      const postRes = await member.agent
        .post(membersUrl(workspace.id))
        .send({ email: outsider.email });
      expect(postRes.status).toBe(403);

      const patchRes = await member.agent
        .patch(membersUrl(workspace.id, admin.id))
        .send({ role: 'MEMBER' });
      expect(patchRes.status).toBe(403);

      const deleteRes = await member.agent.delete(membersUrl(workspace.id, admin.id));
      expect(deleteRes.status).toBe(403);

      // Nothing changed.
      expect(await getRole(workspace.id, admin.id)).toBe('ADMIN');
      expect(await getRole(workspace.id, outsider.id)).toBeNull();
    });

    it('returns 404 when a non-member calls any members route', async () => {
      const admin = await loginAsNewUser();
      const outsider = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const getRes = await outsider.agent.get(membersUrl(workspace.id));
      expect(getRes.status).toBe(404);

      const postRes = await outsider.agent
        .post(membersUrl(workspace.id))
        .send({ email: outsider.email });
      expect(postRes.status).toBe(404);

      const patchRes = await outsider.agent
        .patch(membersUrl(workspace.id, admin.id))
        .send({ role: 'MEMBER' });
      expect(patchRes.status).toBe(404);

      const deleteRes = await outsider.agent.delete(membersUrl(workspace.id, admin.id));
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('GET /workspaces/:workspaceId/members', () => {
    it('lists members ADMIN first and never exposes passwordHash', async () => {
      const admin = await loginAsNewUser();
      const member = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);
      await addMember(workspace.id, member.id);

      // A MEMBER may read the list too.
      const res = await member.agent.get(membersUrl(workspace.id));
      expect(res.status).toBe(200);

      const members = res.body.data.members as Array<{
        userId: string;
        role: string;
        user: { email: string };
      }>;
      expect(members.map((m) => [m.userId, m.role])).toEqual([
        [admin.id, 'ADMIN'],
        [member.id, 'MEMBER'],
      ]);
      expect(members[0]!.user.email).toBe(admin.email);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('POST /workspaces/:workspaceId/members', () => {
    it('adds a registered user, who then sees the workspace on their dashboard', async () => {
      const admin = await loginAsNewUser();
      const invitee = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const res = await admin.agent
        .post(membersUrl(workspace.id))
        .send({ email: invitee.email });

      expect(res.status).toBe(201);
      expect(res.body.data.member.userId).toBe(invitee.id);
      expect(res.body.data.member.role).toBe('MEMBER');
      expect(res.body.data.member.user.email).toBe(invitee.email);

      expect(await listWorkspaceIds(invitee.agent)).toContain(workspace.id);
    });

    it('matches the email regardless of case and surrounding spaces', async () => {
      const admin = await loginAsNewUser();
      const invitee = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const res = await admin.agent
        .post(membersUrl(workspace.id))
        .send({ email: `  ${invitee.email.toUpperCase()}  ` });

      expect(res.status).toBe(201);
      expect(res.body.data.member.userId).toBe(invitee.id);
    });

    it('returns 404 for an email with no account', async () => {
      const admin = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const res = await admin.agent
        .post(membersUrl(workspace.id))
        .send({ email: `nobody-${randomUUID()}@example.com` });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns 409 when the user is already a member', async () => {
      const admin = await loginAsNewUser();
      const member = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);
      await addMember(workspace.id, member.id);

      const res = await admin.agent
        .post(membersUrl(workspace.id))
        .send({ email: member.email });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_MEMBER');
    });
  });

  describe('last ADMIN protection', () => {
    it('returns 409 when the only ADMIN demotes themselves', async () => {
      const admin = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const res = await admin.agent
        .patch(membersUrl(workspace.id, admin.id))
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ADMIN');
      expect(await getRole(workspace.id, admin.id)).toBe('ADMIN');
    });

    it('returns 409 when the only ADMIN removes themselves', async () => {
      const admin = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);

      const res = await admin.agent.delete(membersUrl(workspace.id, admin.id));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ADMIN');
      expect(await getRole(workspace.id, admin.id)).toBe('ADMIN');
    });

    it('lets an ADMIN demote themselves when another ADMIN remains', async () => {
      const admin = await loginAsNewUser();
      const otherAdmin = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);
      await addMember(workspace.id, otherAdmin.id, 'ADMIN');

      const res = await admin.agent
        .patch(membersUrl(workspace.id, admin.id))
        .send({ role: 'MEMBER' });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe('MEMBER');
      expect(res.body.data.member.user.email).toBe(admin.email);
      expect(await getRole(workspace.id, admin.id)).toBe('MEMBER');
    });
  });

  describe('DELETE /workspaces/:workspaceId/members/:userId', () => {
    it('removes a member, who then no longer sees the workspace', async () => {
      const admin = await loginAsNewUser();
      const member = await loginAsNewUser();
      const workspace = await createWorkspace(admin.agent);
      await addMember(workspace.id, member.id);

      const res = await admin.agent.delete(membersUrl(workspace.id, member.id));

      expect(res.status).toBe(204);
      expect(await getRole(workspace.id, member.id)).toBeNull();
      expect(await listWorkspaceIds(member.agent)).not.toContain(workspace.id);
    });
  });
});
