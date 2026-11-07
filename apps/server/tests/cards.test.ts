import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';
import app from '../src/app';
import {db, queryStats} from '../src/prisma/db';
import {deleteBoardContent} from '../src/modules/board/board.controller';

// Cleanup deletes rows, so never run this suite against a non-test database.
if(!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

type CardBody = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: string;
  isDueComplete: boolean;
  isArchived: boolean;
};

const cardsUrl = '/api/v1/cards';
const listsUrl = '/api/v1/lists';
const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';
const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `card-${randomUUID()}@example.com`;
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

async function createBoard(agent: Agent, workspaceId: string) {
  const res = await agent
    .post(`${workspacesUrl}/${workspaceId}/boards`)
    .send({ name: 'Roadmap', visibility: 'WORKSPACE' });
  expect(res.status).toBe(201);
  return res.body.data.board as { id: string };
}

async function createList(agent: Agent, boardId: string, name = 'Backlog') {
  const res = await agent.post(`${boardsUrl}/${boardId}/lists`).send({ name });
  expect(res.status).toBe(201);
  return res.body.data.list as { id: string };
}

async function createCard(agent: Agent, listId: string, body: Record<string, unknown> = {}) {
  const res = await agent
    .post(`${listsUrl}/${listId}/cards`)
    .send({ title: 'Write tests', ...body });
  expect(res.status).toBe(201);
  return res.body.data.card as CardBody;
}

// An admin who owns a workspace with one WORKSPACE-visible board and one list.
async function setupList() {
  const admin = await loginAsNewUser();
  const workspace = await createWorkspace(admin.agent);
  const board = await createBoard(admin.agent, workspace.id);
  const list = await createList(admin.agent, board.id);
  return { admin, workspace, board, list };
}

// A workspace member who is an OBSERVER on the board: can see, can't edit.
async function addObserver(admin: Agent, workspaceId: string, boardId: string) {
  const observer = await loginAsNewUser();
  await addWorkspaceMember(admin, workspaceId, observer.email, 'MEMBER');
  await addBoardMember(admin, boardId, observer.email, 'OBSERVER');
  return observer;
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

describe('card CRUD', () => {
  it('creates, gets, updates, archives and deletes a card', async () => {
    const { admin, list } = await setupList();
    const { agent } = admin;

    // create
    const createRes = await agent
      .post(`${listsUrl}/${list.id}/cards`)
      .send({ title: '  Write tests  ', description: 'Cover the card routes' });
    expect(createRes.status).toBe(201);
    const card = createRes.body.data.card as CardBody;
    expect(card).toMatchObject({
      listId: list.id,
      title: 'Write tests',
      description: 'Cover the card routes',
      isDueComplete: false,
      isArchived: false,
    });

    // get
    const getRes = await agent.get(`${cardsUrl}/${card.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.card).toMatchObject({ id: card.id, title: 'Write tests' });

    // patch
    const patchRes = await agent
      .patch(`${cardsUrl}/${card.id}`)
      .send({ title: 'Write more tests', description: null, isDueComplete: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.card).toMatchObject({
      id: card.id,
      title: 'Write more tests',
      description: null,
      isDueComplete: true,
    });

    // archive
    const archiveRes = await agent.post(`${cardsUrl}/${card.id}/archive`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.card.isArchived).toBe(true);

    // delete
    const deleteRes = await agent.delete(`${cardsUrl}/${card.id}`);
    expect(deleteRes.status).toBe(204);

    const goneRes = await agent.get(`${cardsUrl}/${card.id}`);
    expect(goneRes.status).toBe(404);
  });

  it('refuses to delete a card that is not archived (409)', async () => {
    const { admin, list } = await setupList();
    const card = await createCard(admin.agent, list.id);

    const res = await admin.agent.delete(`${cardsUrl}/${card.id}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CARD_NOT_ARCHIVED');
    const stillThere = await admin.agent.get(`${cardsUrl}/${card.id}`);
    expect(stillThere.status).toBe(200);
  });

  it('refuses to add a card to an archived list (409)', async () => {
    const { admin, list } = await setupList();
    const archiveRes = await admin.agent.delete(`${listsUrl}/${list.id}`);
    expect(archiveRes.status).toBe(204);

    const res = await admin.agent.post(`${listsUrl}/${list.id}/cards`).send({ title: 'Nope' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIST_ARCHIVED');
  });

  it('archiving twice returns 200 both times', async () => {
    const { admin, list } = await setupList();
    const card = await createCard(admin.agent, list.id);

    const first = await admin.agent.post(`${cardsUrl}/${card.id}/archive`);
    const second = await admin.agent.post(`${cardsUrl}/${card.id}/archive`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.card.isArchived).toBe(true);
  });
});

describe('ordering', () => {
  it('ranks cards ascending in creation order', async () => {
    const { admin, list } = await setupList();

    const a = await createCard(admin.agent, list.id, { title: 'A' });
    const b = await createCard(admin.agent, list.id, { title: 'B' });
    const c = await createCard(admin.agent, list.id, { title: 'C' });

    expect(a.position < b.position).toBe(true);
    expect(b.position < c.position).toBe(true);
  });
});

describe('validation', () => {
  it('rejects an empty title (400)', async () => {
    const { admin, list } = await setupList();

    const res = await admin.agent.post(`${listsUrl}/${list.id}/cards`).send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown field on create (400)', async () => {
    const { admin, list } = await setupList();
    const other = await createList(admin.agent, (await createBoard(admin.agent, (await createWorkspace(admin.agent)).id)).id);

    const res = await admin.agent
      .post(`${listsUrl}/${list.id}/cards`)
      .send({ title: 'Sneaky', listId: other.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown field on update (400)', async () => {
    const { admin, list } = await setupList();
    const card = await createCard(admin.agent, list.id);

    const res = await admin.agent.patch(`${cardsUrl}/${card.id}`).send({ listId: list.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('permissions', () => {
  it('an outsider gets 404 on GET, PATCH and DELETE', async () => {
    const { admin, list } = await setupList();
    const card = await createCard(admin.agent, list.id);
    const outsider = await loginAsNewUser();

    const getRes = await outsider.agent.get(`${cardsUrl}/${card.id}`);
    const patchRes = await outsider.agent.patch(`${cardsUrl}/${card.id}`).send({ title: 'Mine' });
    const deleteRes = await outsider.agent.delete(`${cardsUrl}/${card.id}`);

    expect(getRes.status).toBe(404);
    expect(patchRes.status).toBe(404);
    expect(deleteRes.status).toBe(404);
  });

  it('an OBSERVER can GET (200) but not PATCH (403)', async () => {
    const { admin, workspace, board, list } = await setupList();
    const card = await createCard(admin.agent, list.id);
    const observer = await addObserver(admin.agent, workspace.id, board.id);

    const getRes = await observer.agent.get(`${cardsUrl}/${card.id}`);
    const patchRes = await observer.agent.patch(`${cardsUrl}/${card.id}`).send({ title: 'Mine' });

    expect(getRes.status).toBe(200);
    expect(patchRes.status).toBe(403);
  });

  it('returns 401 when logged out', async () => {
    const { admin, list } = await setupList();
    const card = await createCard(admin.agent, list.id);

    const res = await request(app).get(`${cardsUrl}/${card.id}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /boards/:boardId tree', () => {
  it('leaves out archived lists and cards', async () => {
    const { admin, board, list } = await setupList();
    const kept = await createCard(admin.agent, list.id, { title: 'Kept' });
    const hidden = await createCard(admin.agent, list.id, { title: 'Hidden' });
    await admin.agent.post(`${cardsUrl}/${hidden.id}/archive`).expect(200);
    const archivedList = await createList(admin.agent, board.id, 'Old');
    await admin.agent.delete(`${listsUrl}/${archivedList.id}`).expect(204);

    const res = await admin.agent.get(`${boardsUrl}/${board.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.board.lists.map((l: { id: string }) => l.id)).toEqual([list.id]);
    expect(res.body.data.board.lists[0].cards.map((c: CardBody) => c.id)).toEqual([kept.id]);
  });

  it('loads a board tree with a constant number of queries', async () => {
    const { admin, board, list } = await setupList();
    const { agent } = admin;
    const lists = [list, await createList(agent, board.id, 'Doing'), await createList(agent, board.id, 'Done')];
    for (const l of lists) {
      for (let i = 0; i < 20; i++) {
        await createCard(agent, l.id, { title: `Card ${i}` });
      }
    }

    queryStats.count = 0;
    const res = await agent.get(`${boardsUrl}/${board.id}`);
    const queries = queryStats.count;

    expect(res.status).toBe(200);
    expect(res.body.data.board.lists).toHaveLength(3);
    expect(res.body.data.board.lists[0].cards).toHaveLength(20);
    // Cards come back in rank order.
    const positions = res.body.data.board.lists[0].cards.map((c: CardBody) => c.position);
    expect(positions).toEqual([...positions].sort());
    // Measured 5: session, board, workspace role, board role, then one query for
    // the whole lists+cards tree. A per-list or per-card query would push it past 5.
    // The lower bound proves queryStats is actually counting.
    expect(queries).toBeGreaterThan(0);
    expect(queries).toBeLessThanOrEqual(5);
  });
});
