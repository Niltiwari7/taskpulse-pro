import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';
import app from '../src/app';
import {db} from '../src/prisma/db';
import {deleteBoardContent} from '../src/modules/board/board.controller';

// Cleanup deletes rows, so never run this suite against a non-test database.
if(!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

type ListBody = {
  id: string;
  boardId: string;
  name: string;
  position: string;
  isArchived: boolean;
};

const listsUrl = '/api/v1/lists';
const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';
const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `list-${randomUUID()}@example.com`;
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

async function addWorkspaceMember(admin: Agent, workspaceId: string, email: string, role: 'ADMIN' | 'MEMBER') {
  const res = await admin
    .post(`${workspacesUrl}/${workspaceId}/members`)
    .send({ email, role });
  expect(res.status).toBe(201);
}

async function addBoardMember(admin: Agent, boardId: string, email: string, role: 'ADMIN' | 'MEMBER' | 'OBSERVER' | 'GUEST') {
  const res = await admin
    .post(`${boardsUrl}/${boardId}/members`)
    .send({ email, role });
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

async function createList(
  agent: Agent,
  boardId: string,
  body: Record<string, unknown> = {},
) {
  const res = await agent
    .post(`${boardsUrl}/${boardId}/lists`)
    .send({ name: 'Backlog', ...body });
  expect(res.status).toBe(201);
  return res.body.data.list as ListBody;
}

async function getListNames(agent: Agent, boardId: string) {
  const res = await agent.get(`${boardsUrl}/${boardId}/lists`);
  expect(res.status).toBe(200);
  return (res.body.data.lists as ListBody[]).map((l) => l.name);
}

// Inserted directly: there are no card routes yet.
async function insertCard(listId: string) {
  return db.orm.public.Card.create({
    listId,
    title: 'Write tests',
    position: 'i',
    isDueComplete: false,
    isArchived: false,
  });
}

// An admin who owns a workspace with one WORKSPACE-visible board (as board ADMIN).
async function setupBoard() {
  const admin = await loginAsNewUser();
  const workspace = await createWorkspace(admin.agent);
  const board = await createBoard(admin.agent, workspace.id, { visibility: 'WORKSPACE' });
  return { admin, workspace, board };
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

      // Foreign keys point child -> parent: cards -> lists -> board members -> boards.
      if (boardIds.length > 0) {
        await db.transaction((tx) => deleteBoardContent(tx, boardIds));
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

describe('GET /boards/:boardId/lists', () => {
  // Needs at least 3 lists: a sort that only works for 2 keys (e.g. by collation) would slip through.
  it('returns lists in creation order', async () => {
    const { admin, board } = await setupBoard();
    for (const name of ['Todo', 'Doing', 'Done', 'Later']) {
      await createList(admin.agent, board.id, { name });
    }

    expect(await getListNames(admin.agent, board.id)).toEqual(['Todo', 'Doing', 'Done', 'Later']);
  });
});

describe('POST /boards/:boardId/lists', () => {
  it('assigns a rank and ignores position and boardId in the body', async () => {
    const { admin, workspace, board } = await setupBoard();
    const otherBoard = await createBoard(admin.agent, workspace.id);

    const list = await createList(admin.agent, board.id, {
      name: 'Todo',
      position: '0',
      boardId: otherBoard.id,
    });

    expect(list.position).toMatch(/^[0-9a-z]+$/);
    expect(list.position).not.toBe('0');
    expect(list.boardId).toBe(board.id);
    expect(list.isArchived).toBe(false);
    expect(await getListNames(admin.agent, otherBoard.id)).toEqual([]);
  });

  it('puts a new list after an archived one', async () => {
    const { admin, board } = await setupBoard();
    await createList(admin.agent, board.id, { name: 'Todo' });
    const doing = await createList(admin.agent, board.id, { name: 'Doing' });
    expect((await admin.agent.delete(`${listsUrl}/${doing.id}`)).status).toBe(204);

    const done = await createList(admin.agent, board.id, { name: 'Done' });
    expect(done.position > doing.position).toBe(true);

    // Un-archiving Doing must not collide with Done or jump ahead of it.
    await db.orm.public.List.where({ id: doing.id }).update({ isArchived: false });
    expect(await getListNames(admin.agent, board.id)).toEqual(['Todo', 'Doing', 'Done']);
  });
});

describe('PATCH /lists/:listId', () => {
  it('renames the list', async () => {
    const { admin, board } = await setupBoard();
    const list = await createList(admin.agent, board.id, { name: 'Todo' });

    const res = await admin.agent.patch(`${listsUrl}/${list.id}`).send({ name: '  Doing  ' });

    expect(res.status).toBe(200);
    expect(res.body.data.list).toMatchObject({ id: list.id, name: 'Doing', position: list.position });
  });

  it('rejects an empty name with 400', async () => {
    const { admin, board } = await setupBoard();
    const list = await createList(admin.agent, board.id);

    const res = await admin.agent.patch(`${listsUrl}/${list.id}`).send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /lists/:listId', () => {
  it('archives the list: 204, hidden from GET, row kept, idempotent', async () => {
    const { admin, board } = await setupBoard();
    await createList(admin.agent, board.id, { name: 'Todo' });
    const doing = await createList(admin.agent, board.id, { name: 'Doing' });

    const res = await admin.agent.delete(`${listsUrl}/${doing.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    expect(await getListNames(admin.agent, board.id)).toEqual(['Todo']);
    const row = await db.orm.public.List.where({ id: doing.id }).first();
    expect(row).toMatchObject({ isArchived: true, position: doing.position });

    expect((await admin.agent.delete(`${listsUrl}/${doing.id}`)).status).toBe(204);
  });

  it('keeps the cards of an archived list', async () => {
    const { admin, board } = await setupBoard();
    const list = await createList(admin.agent, board.id);
    const card = await insertCard(list.id);

    expect((await admin.agent.delete(`${listsUrl}/${list.id}`)).status).toBe(204);

    const row = await db.orm.public.Card.where({ id: card.id }).first();
    expect(row).toMatchObject({ listId: list.id, isArchived: false });
  });
});

describe('permissions', () => {
  it('OBSERVER cannot create a list (403)', async () => {
    const { admin, workspace, board } = await setupBoard();
    const observer = await loginAsNewUser();
    await addWorkspaceMember(admin.agent, workspace.id, observer.email, 'MEMBER');
    await addBoardMember(admin.agent, board.id, observer.email, 'OBSERVER');

    const res = await observer.agent.post(`${boardsUrl}/${board.id}/lists`).send({ name: 'Todo' });

    expect(res.status).toBe(403);
  });

  it('an outsider gets 404 on a WORKSPACE board', async () => {
    const { admin, board } = await setupBoard();
    const list = await createList(admin.agent, board.id);
    const outsider = await loginAsNewUser();

    expect((await outsider.agent.get(`${boardsUrl}/${board.id}/lists`)).status).toBe(404);
    expect((await outsider.agent.post(`${boardsUrl}/${board.id}/lists`).send({ name: 'x' })).status).toBe(404);
    expect((await outsider.agent.patch(`${listsUrl}/${list.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await outsider.agent.delete(`${listsUrl}/${list.id}`)).status).toBe(404);
  });

  it('an unknown list id gets 404', async () => {
    const { admin } = await setupBoard();

    const patchRes = await admin.agent.patch(`${listsUrl}/no-such-list`).send({ name: 'x' });
    const deleteRes = await admin.agent.delete(`${listsUrl}/no-such-list`);

    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe('LIST_NOT_FOUND');
    expect(deleteRes.status).toBe(404);
  });

  it('a ws ADMIN who is not on the board can create a list (201)', async () => {
    const { admin, workspace, board } = await setupBoard();
    const wsAdmin = await loginAsNewUser();
    await addWorkspaceMember(admin.agent, workspace.id, wsAdmin.email, 'ADMIN');

    await createList(wsAdmin.agent, board.id, { name: 'Todo' });
  });
});

describe('deleting a parent that has lists', () => {
  it('deletes an archived board with lists and cards', async () => {
    const { admin, board } = await setupBoard();
    const list = await createList(admin.agent, board.id);
    await insertCard(list.id);
    expect((await admin.agent.post(`${boardsUrl}/${board.id}/archive`)).status).toBe(200);

    const res = await admin.agent.delete(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(204);
    expect(await db.orm.public.List.where({ boardId: board.id }).first()).toBeNull();
    expect(await db.orm.public.Card.where({ listId: list.id }).first()).toBeNull();
  });

  it('deletes a workspace whose board has lists and cards', async () => {
    const { admin, workspace, board } = await setupBoard();
    const list = await createList(admin.agent, board.id);
    await insertCard(list.id);

    const res = await admin.agent.delete(`${workspacesUrl}/${workspace.id}`);

    expect(res.status).toBe(204);
    expect(await db.orm.public.Board.where({ id: board.id }).first()).toBeNull();
    expect(await db.orm.public.List.where({ boardId: board.id }).first()).toBeNull();
    expect(await db.orm.public.Card.where({ listId: list.id }).first()).toBeNull();
  });
});
