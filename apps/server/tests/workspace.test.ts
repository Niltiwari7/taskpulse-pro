import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import app from '../src/app';
import { db } from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

const baseUrl = '/api/v1/workspaces';

const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `ws-${randomUUID()}@example.com`;
  createdEmails.add(email);
  const user = {
    username: `user-${randomUUID().slice(0, 8)}`,
    email,
    password: 'password123',
  };

  const agent = request.agent(app);
  const registerRes = await agent.post('/api/v1/auth/register').send(user);
  expect(registerRes.status).toBe(201);
  const loginRes = await agent
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });
  expect(loginRes.status).toBe(200);

  return { agent, id: registerRes.body.data.user.id as string };
}

async function createWorkspace(agent: ReturnType<typeof request.agent>, name = 'Team A') {
  const res = await agent.post(baseUrl).send({ name, visibility: 'PRIVATE' });
  expect(res.status).toBe(201);
  return res.body.data.workspace as { id: string; name: string };
}

describe('Workspace CRUD integration tests', () => {
  afterEach(async () => {
    if (createdEmails.size === 0) return;
    const users = await db.orm.public.User
      .where((u) => u.email.in([...createdEmails]))
      .select('id')
      .all();
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const memberships = await db.orm.public.WorkspaceMember
        .where((m) => m.userId.in(userIds))
        .select('workspaceId')
        .all();
      const workspaceIds = [...new Set(memberships.map((m) => m.workspaceId))];

      if (workspaceIds.length > 0) {
        await db.orm.public.WorkspaceMember
          .where((m) => m.workspaceId.in(workspaceIds))
          .deleteAll();
        await db.orm.public.Workspace
          .where((w) => w.id.in(workspaceIds))
          .deleteAll();
      }
    }

    // Sessions are removed by the Session.user onDelete: Cascade relation
    await db.orm.public.User
      .where((u) => u.email.in([...createdEmails]))
      .deleteAll();
    createdEmails.clear();
  });

  afterAll(async () => {
    await db.close();
  });

  it('rejects requests without a session', async () => {
    const res = await request(app).get(baseUrl);
    expect(res.status).toBe(401);
  });

  it('creates a workspace and makes the creator ADMIN', async () => {
    const { agent, id: userId } = await loginAsNewUser();

    const workspace = await createWorkspace(agent);
    expect(workspace.name).toBe('Team A');

    const membership = await db.orm.public.WorkspaceMember
      .where({ workspaceId: workspace.id, userId })
      .first();
    expect(membership?.role).toBe('ADMIN');
  });

  it('rejects invalid create input with 400', async () => {
    const { agent } = await loginAsNewUser();

    const res = await agent.post(baseUrl).send({ name: '   ', visibility: 'SECRET' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists only the workspaces the user belongs to', async () => {
    const a = await loginAsNewUser();
    const b = await loginAsNewUser();
    const wsA = await createWorkspace(a.agent, 'A workspace');
    const wsB = await createWorkspace(b.agent, 'B workspace');

    const res = await a.agent.get(baseUrl);
    expect(res.status).toBe(200);
    const ids = res.body.data.workspaces.map((w: { id: string }) => w.id);
    expect(ids).toContain(wsA.id);
    expect(ids).not.toContain(wsB.id);
  });

  it('gets, updates and deletes your own workspace', async () => {
    const { agent } = await loginAsNewUser();
    const workspace = await createWorkspace(agent);

    const getRes = await agent.get(`${baseUrl}/${workspace.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.workspace.id).toBe(workspace.id);

    const patchRes = await agent
      .patch(`${baseUrl}/${workspace.id}`)
      .send({ name: 'Renamed', description: 'New description' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.workspace.name).toBe('Renamed');
    expect(patchRes.body.data.workspace.description).toBe('New description');

    const deleteRes = await agent.delete(`${baseUrl}/${workspace.id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await agent.get(`${baseUrl}/${workspace.id}`);
    expect(afterDelete.status).toBe(404);
  });

  it('rejects an empty PATCH body with 400', async () => {
    const { agent } = await loginAsNewUser();
    const workspace = await createWorkspace(agent);

    const res = await agent.patch(`${baseUrl}/${workspace.id}`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 (not 403) when user B touches user A's workspace", async () => {
    const a = await loginAsNewUser();
    const b = await loginAsNewUser();
    const workspace = await createWorkspace(a.agent);

    const getRes = await b.agent.get(`${baseUrl}/${workspace.id}`);
    expect(getRes.status).toBe(404);

    const patchRes = await b.agent
      .patch(`${baseUrl}/${workspace.id}`)
      .send({ name: 'Hijacked' });
    expect(patchRes.status).toBe(404);

    const deleteRes = await b.agent.delete(`${baseUrl}/${workspace.id}`);
    expect(deleteRes.status).toBe(404);

    // A's workspace is untouched.
    const stillThere = await a.agent.get(`${baseUrl}/${workspace.id}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.workspace.name).toBe(workspace.name);
  });

  it('returns 404 for a workspace that does not exist', async () => {
    const { agent } = await loginAsNewUser();

    const res = await agent.get(`${baseUrl}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('returns 403 when a MEMBER tries an ADMIN action', async () => {
    const a = await loginAsNewUser();
    const b = await loginAsNewUser();
    const workspace = await createWorkspace(a.agent);
    await db.orm.public.WorkspaceMember.create({
      workspaceId: workspace.id,
      userId: b.id,
      role: 'MEMBER',
    });

    const getRes = await b.agent.get(`${baseUrl}/${workspace.id}`);
    expect(getRes.status).toBe(200);

    const patchRes = await b.agent
      .patch(`${baseUrl}/${workspace.id}`)
      .send({ name: 'Nope' });
    expect(patchRes.status).toBe(403);

    const deleteRes = await b.agent.delete(`${baseUrl}/${workspace.id}`);
    expect(deleteRes.status).toBe(403);
  });

  it('deletes a workspace that has several members', async () => {
    const a = await loginAsNewUser();
    const b = await loginAsNewUser();
    const workspace = await createWorkspace(a.agent);
    await db.orm.public.WorkspaceMember.create({
      workspaceId: workspace.id,
      userId: b.id,
      role: 'MEMBER',
    });

    const res = await a.agent.delete(`${baseUrl}/${workspace.id}`);
    expect(res.status).toBe(204);

    const remaining = await db.orm.public.WorkspaceMember
      .where({ workspaceId: workspace.id })
      .all();
    expect(remaining).toHaveLength(0);
  });

  it('deletes a workspace that has boards, along with the boards', async () => {
    const a = await loginAsNewUser();
    const workspace = await createWorkspace(a.agent);
    const boardRes = await a.agent
      .post(`${baseUrl}/${workspace.id}/boards`)
      .send({ name: 'Roadmap' });
    expect(boardRes.status).toBe(201);
    const boardId = boardRes.body.data.board.id as string;

    const res = await a.agent.delete(`${baseUrl}/${workspace.id}`);
    expect(res.status).toBe(204);

    expect(await db.orm.public.Board.where({ id: boardId }).first()).toBeNull();
    expect(await db.orm.public.BoardMember.where({ boardId }).first()).toBeNull();
  });
});
