import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import app from '../src/app';
import { db } from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';

const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `board-${randomUUID()}@example.com`;
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

  return { agent, email, id: registerRes.body.data.user.id as string };
}

async function createWorkspace(agent: Agent) {
  const res = await agent.post(workspacesUrl).send({ name: 'Team A', visibility: 'PRIVATE' });
  expect(res.status).toBe(201);
  return res.body.data.workspace as { id: string };
}

async function addWorkspaceMember(admin: Agent, workspaceId: string, email: string) {
  const res = await admin
    .post(`${workspacesUrl}/${workspaceId}/members`)
    .send({ email, role: 'MEMBER' });
  expect(res.status).toBe(201);
}

async function createBoard(
  agent: Agent,
  workspaceId: string,
  body: { name?: string; visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC' } = {},
) {
  const res = await agent
    .post(`${workspacesUrl}/${workspaceId}/boards`)
    .send({ name: 'Roadmap', ...body });
  expect(res.status).toBe(201);
  return res.body.data.board as { id: string; name: string; archivedAt: string | null };
}

async function listBoardIds(agent: Agent, workspaceId: string) {
  const res = await agent.get(`${workspacesUrl}/${workspaceId}/boards`);
  expect(res.status).toBe(200);
  return (res.body.data.boards as { id: string }[]).map((b) => b.id);
}

// Sets up an admin who owns a workspace with one board, plus a plain workspace member.
async function setupWorkspaceWithBoard(visibility: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC' = 'WORKSPACE') {
  const admin = await loginAsNewUser();
  const member = await loginAsNewUser();
  const workspace = await createWorkspace(admin.agent);
  await addWorkspaceMember(admin.agent, workspace.id, member.email);
  const board = await createBoard(admin.agent, workspace.id, { visibility });
  return { admin, member, workspace, board };
}

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
      const boards = await db.orm.public.Board
        .where((b) => b.workspaceId.in(workspaceIds))
        .select('id')
        .all();
      const boardIds = boards.map((b) => b.id);

      // Foreign keys point child -> parent, so delete board rows before workspace rows.
      if (boardIds.length > 0) {
        await db.orm.public.BoardMember.where((m) => m.boardId.in(boardIds)).deleteAll();
        await db.orm.public.Board.where((b) => b.id.in(boardIds)).deleteAll();
      }
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

describe('POST /workspaces/:workspaceId/boards', () => {
  it('creates a board and makes the creator its board ADMIN', async () => {
    const { agent, id: userId } = await loginAsNewUser();
    const workspace = await createWorkspace(agent);

    const board = await createBoard(agent, workspace.id, { name: 'Sprint' });

    expect(board).toMatchObject({ name: 'Sprint', archivedAt: null });
    const membership = await db.orm.public.BoardMember
      .where({ boardId: board.id, userId })
      .first();
    expect(membership?.role).toBe('ADMIN');
  });

  it('rejects an empty name with 400', async () => {
    const { agent } = await loginAsNewUser();
    const workspace = await createWorkspace(agent);

    const res = await agent.post(`${workspacesUrl}/${workspace.id}/boards`).send({ name: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 to a user outside the workspace', async () => {
    const { workspace } = await setupWorkspaceWithBoard();
    const stranger = await loginAsNewUser();

    const res = await stranger.agent
      .post(`${workspacesUrl}/${workspace.id}/boards`)
      .send({ name: 'Sneaky' });

    expect(res.status).toBe(404);
  });
});

describe('GET /workspaces/:workspaceId/boards', () => {
  it('shows a workspace board to a workspace member', async () => {
    const { member, workspace, board } = await setupWorkspaceWithBoard('WORKSPACE');

    expect(await listBoardIds(member.agent, workspace.id)).toEqual([board.id]);
  });

  it('hides archived boards', async () => {
    const { admin, workspace, board } = await setupWorkspaceWithBoard();
    const openBoard = await createBoard(admin.agent, workspace.id, { name: 'Still open' });

    const archiveRes = await admin.agent.post(`${boardsUrl}/${board.id}/archive`);
    expect(archiveRes.status).toBe(200);

    expect(await listBoardIds(admin.agent, workspace.id)).toEqual([openBoard.id]);
  });

  it('hides a PRIVATE board from a workspace member who is not on it', async () => {
    const { member, workspace } = await setupWorkspaceWithBoard('PRIVATE');

    expect(await listBoardIds(member.agent, workspace.id)).toEqual([]);
  });

  it('returns 404 to a user outside the workspace', async () => {
    const { workspace } = await setupWorkspaceWithBoard();
    const stranger = await loginAsNewUser();

    const res = await stranger.agent.get(`${workspacesUrl}/${workspace.id}/boards`);

    expect(res.status).toBe(404);
  });
});

describe('GET /boards/:boardId', () => {
  it('returns the board to a workspace member', async () => {
    const { member, board } = await setupWorkspaceWithBoard('WORKSPACE');

    const res = await member.agent.get(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.board.id).toBe(board.id);
  });

  it('returns 404 to a user outside the workspace', async () => {
    const { board } = await setupWorkspaceWithBoard('WORKSPACE');
    const stranger = await loginAsNewUser();

    const res = await stranger.agent.get(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a PRIVATE board the workspace member is not on', async () => {
    const { member, board } = await setupWorkspaceWithBoard('PRIVATE');

    const res = await member.agent.get(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a board that does not exist', async () => {
    const { agent } = await loginAsNewUser();

    const res = await agent.get(`${boardsUrl}/does-not-exist`);

    expect(res.status).toBe(404);
  });

  it('returns 401 when logged out', async () => {
    const { board } = await setupWorkspaceWithBoard();

    const res = await request(app).get(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /boards/:boardId', () => {
  it('lets the board admin rename the board', async () => {
    const { admin, board } = await setupWorkspaceWithBoard();

    const res = await admin.agent.patch(`${boardsUrl}/${board.id}`).send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.data.board.name).toBe('Renamed');
  });

  it('returns 403 to a workspace member who is not a board admin', async () => {
    const { member, board } = await setupWorkspaceWithBoard('WORKSPACE');

    const res = await member.agent.patch(`${boardsUrl}/${board.id}`).send({ name: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('rejects an empty body with 400', async () => {
    const { admin, board } = await setupWorkspaceWithBoard();

    const res = await admin.agent.patch(`${boardsUrl}/${board.id}`).send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /boards/:boardId/archive', () => {
  it('sets archivedAt and keeps the board readable', async () => {
    const { admin, board } = await setupWorkspaceWithBoard();

    const res = await admin.agent.post(`${boardsUrl}/${board.id}/archive`);

    expect(res.status).toBe(200);
    expect(res.body.data.board.archivedAt).toEqual(expect.any(String));
    const getRes = await admin.agent.get(`${boardsUrl}/${board.id}`);
    expect(getRes.status).toBe(200);
  });

  it('returns 403 to a workspace member who is not a board admin', async () => {
    const { member, board } = await setupWorkspaceWithBoard('WORKSPACE');

    const res = await member.agent.post(`${boardsUrl}/${board.id}/archive`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /boards/:boardId', () => {
  it('returns 409 for a board that is not archived', async () => {
    const { admin, board } = await setupWorkspaceWithBoard();

    const res = await admin.agent.delete(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOARD_NOT_ARCHIVED');
  });

  it('permanently deletes an archived board and its memberships', async () => {
    const { admin, board } = await setupWorkspaceWithBoard();
    await admin.agent.post(`${boardsUrl}/${board.id}/archive`);

    const res = await admin.agent.delete(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(204);
    expect(await db.orm.public.Board.where({ id: board.id }).first()).toBeNull();
    expect(await db.orm.public.BoardMember.where({ boardId: board.id }).first()).toBeNull();
    const getRes = await admin.agent.get(`${boardsUrl}/${board.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 403 to a workspace member who is not a board admin', async () => {
    const { admin, member, board } = await setupWorkspaceWithBoard('WORKSPACE');
    await admin.agent.post(`${boardsUrl}/${board.id}/archive`);

    const res = await member.agent.delete(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(403);
  });
});
