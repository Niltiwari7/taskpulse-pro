import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';
import app from '../src/app';
import {db} from '../src/prisma/db';
import {deleteBoardContent} from '../src/modules/board/board.controller';
import {LABEL_COLORS} from '@taskpulse/shared-types';

// Cleanup deletes rows, so never run this suite against a non-test database.
if(!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

type LabelBody = {
  id: string;
  boardId: string;
  name: string | null;
  color: string;
  createdAt: string;
};

type ListBody = {
  id: string;
  boardId: string;
  name: string;
  position: string;
  isArchived: boolean;
};

const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';
const listsUrl = '/api/v1/lists';
const cardsUrl = '/api/v1/cards';
const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `label-${randomUUID()}@example.com`;
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



async function createCard(agent: Agent, listId: string) {
  const res = await agent.post(`${listsUrl}/${listId}/cards`).send({ title: 'Write tests' });
  expect(res.status).toBe(201);
  return res.body.data.card as { id: string };
}

async function getLabels(agent: Agent, boardId: string) {
  const res = await agent.get(`${boardsUrl}/${boardId}/labels`);
  expect(res.status).toBe(200);
  return res.body.data.labels as LabelBody[];
}

async function createLabel(agent: Agent, boardId: string, body: Record<string, unknown> = {}) {
  const res = await agent.post(`${boardsUrl}/${boardId}/labels`).send({ name: 'Bug', color: 'red', ...body });
  expect(res.status).toBe(201);
  return res.body.data.label as LabelBody;
}

function countCardLabels(cardId: string, labelId: string) {
  return db.orm.public.CardLabel.where({ cardId, labelId }).all().then((rows) => rows.length);
}

// An admin who owns a workspace with one WORKSPACE-visible board, a list and a card.
async function setupBoard() {
  const admin = await loginAsNewUser();
  const workspace = await createWorkspace(admin.agent);
  const board = await createBoard(admin.agent, workspace.id, { visibility: 'WORKSPACE' });
  const list = await createList(admin.agent, board.id);
  const card = await createCard(admin.agent, list.id);
  const label = await createLabel(admin.agent, board.id);
  return { admin, workspace, board, list, card, label };
}

// A workspace MEMBER who is not on the board: can read a WORKSPACE board, not edit it.
async function setupViewer(ctx: Awaited<ReturnType<typeof setupBoard>>) {
  const viewer = await loginAsNewUser();
  await addWorkspaceMember(ctx.admin.agent, ctx.workspace.id, viewer.email, 'MEMBER');
  return viewer;
}

// Someone with no access to the workspace at all.
async function setupOutsider() {
  return loginAsNewUser();
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
        await db.orm.public.Label.where((l) => l.boardId.in(boardIds)).deleteAll();
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


describe('GET /boards/:boardId/labels', () => {
  it('returns the 6 default labels on a new board', async () => {
    const admin = await loginAsNewUser();
    const workspace = await createWorkspace(admin.agent);
    const board = await createBoard(admin.agent, workspace.id);

    const labels = await getLabels(admin.agent, board.id);

    expect(labels).toHaveLength(LABEL_COLORS.length);
    expect(labels.map((l) => l.color).sort()).toEqual([...LABEL_COLORS].sort());
    expect(labels.every((l) => l.name === null && l.boardId === board.id)).toBe(true);
  });

  it('lets a non-editing member read (200)', async () => {
    const ctx = await setupBoard();
    const viewer = await setupViewer(ctx);

    expect(await getLabels(viewer.agent, ctx.board.id)).toHaveLength(LABEL_COLORS.length + 1);
  });
});

describe('label CRUD as an editor', () => {
  it('creates, renames, recolors and deletes a label', async () => {
    const { admin, board } = await setupBoard();

    const created = await createLabel(admin.agent, board.id, { name: 'Urgent', color: 'orange' });
    expect(created).toMatchObject({ boardId: board.id, name: 'Urgent', color: 'orange' });

    const patchRes = await admin.agent
      .patch(`${boardsUrl}/${board.id}/labels/${created.id}`)
      .send({ name: 'Later', color: 'blue' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.label).toMatchObject({ id: created.id, name: 'Later', color: 'blue' });

    const deleteRes = await admin.agent.delete(`${boardsUrl}/${board.id}/labels/${created.id}`);
    expect(deleteRes.status).toBe(204);
    expect((await getLabels(admin.agent, board.id)).some((l) => l.id === created.id)).toBe(false);

    const again = await admin.agent.delete(`${boardsUrl}/${board.id}/labels/${created.id}`);
    expect(again.status).toBe(404);
  });

  it('creates a label without a name (name is null)', async () => {
    const { admin, board } = await setupBoard();
    const label = await createLabel(admin.agent, board.id, { name: undefined, color: 'green' });
    expect(label.name).toBeNull();
  });
});

describe('label permissions', () => {
  it('a non-editing member gets 403 on every write', async () => {
    const ctx = await setupBoard();
    const viewer = await setupViewer(ctx);
    const url = `${boardsUrl}/${ctx.board.id}/labels`;

    expect((await viewer.agent.post(url).send({ color: 'red' })).status).toBe(403);
    expect((await viewer.agent.patch(`${url}/${ctx.label.id}`).send({ color: 'blue' })).status).toBe(403);
    expect((await viewer.agent.delete(`${url}/${ctx.label.id}`)).status).toBe(403);
    expect((await viewer.agent.post(`${cardsUrl}/${ctx.card.id}/labels/${ctx.label.id}`)).status).toBe(403);
    expect((await viewer.agent.delete(`${cardsUrl}/${ctx.card.id}/labels/${ctx.label.id}`)).status).toBe(403);
  });

  it('an outsider gets 404 on every route', async () => {
    const ctx = await setupBoard();
    // PRIVATE board in a workspace the outsider cannot see.
    const outsider = await setupOutsider();
    const url = `${boardsUrl}/${ctx.board.id}/labels`;

    expect((await outsider.agent.get(url)).status).toBe(404);
    expect((await outsider.agent.post(url).send({ color: 'red' })).status).toBe(404);
    expect((await outsider.agent.patch(`${url}/${ctx.label.id}`).send({ color: 'blue' })).status).toBe(404);
    expect((await outsider.agent.delete(`${url}/${ctx.label.id}`)).status).toBe(404);
    expect((await outsider.agent.post(`${cardsUrl}/${ctx.card.id}/labels/${ctx.label.id}`)).status).toBe(404);
    expect((await outsider.agent.delete(`${cardsUrl}/${ctx.card.id}/labels/${ctx.label.id}`)).status).toBe(404);
  });
});

describe('label validation', () => {
  it('rejects a bad color or an empty name on create (400)', async () => {
    const { admin, board } = await setupBoard();
    const url = `${boardsUrl}/${board.id}/labels`;

    expect((await admin.agent.post(url).send({ color: 'pink' })).status).toBe(400);
    expect((await admin.agent.post(url).send({ name: '', color: 'red' })).status).toBe(400);
    expect((await admin.agent.post(url).send({})).status).toBe(400);
  });

  it('rejects a bad color, an empty name or an empty body on update (400)', async () => {
    const { admin, board, label } = await setupBoard();
    const url = `${boardsUrl}/${board.id}/labels/${label.id}`;

    expect((await admin.agent.patch(url).send({ color: 'pink' })).status).toBe(400);
    expect((await admin.agent.patch(url).send({ name: '' })).status).toBe(400);
    expect((await admin.agent.patch(url).send({})).status).toBe(400);
  });
});

describe('labels are scoped to their board', () => {
  it('PATCH and DELETE through the wrong board URL return 404', async () => {
    const { admin, workspace, label } = await setupBoard();
    const otherBoard = await createBoard(admin.agent, workspace.id);

    const patchRes = await admin.agent
      .patch(`${boardsUrl}/${otherBoard.id}/labels/${label.id}`)
      .send({ name: 'Hijacked' });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe('LABEL_NOT_FOUND');

    const deleteRes = await admin.agent.delete(`${boardsUrl}/${otherBoard.id}/labels/${label.id}`);
    expect(deleteRes.status).toBe(404);

    // Untouched on its own board.
    const stillThere = (await getLabels(admin.agent, label.boardId)).find((l) => l.id === label.id);
    expect(stillThere?.name).toBe('Bug');
  });
});

describe('POST /cards/:cardId/labels/:labelId', () => {
  it('attaches a label from the same board (204)', async () => {
    const { admin, card, label } = await setupBoard();

    const res = await admin.agent.post(`${cardsUrl}/${card.id}/labels/${label.id}`);

    expect(res.status).toBe(204);
    expect(await countCardLabels(card.id, label.id)).toBe(1);
  });

  it('rejects a label from a different board (400 LABEL_BOARD_MISMATCH)', async () => {
    const { admin, workspace, card } = await setupBoard();
    const boardB = await createBoard(admin.agent, workspace.id);
    const labelB = await createLabel(admin.agent, boardB.id);

    const res = await admin.agent.post(`${cardsUrl}/${card.id}/labels/${labelB.id}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LABEL_BOARD_MISMATCH');
    expect(await countCardLabels(card.id, labelB.id)).toBe(0);
  });

  it('returns 404 for a label that does not exist', async () => {
    const { admin, card } = await setupBoard();

    const res = await admin.agent.post(`${cardsUrl}/${card.id}/labels/nope`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LABEL_NOT_FOUND');
  });

  it('attaching twice succeeds and leaves exactly one row', async () => {
    const { admin, card, label } = await setupBoard();
    const url = `${cardsUrl}/${card.id}/labels/${label.id}`;

    expect((await admin.agent.post(url)).status).toBe(204);
    expect((await admin.agent.post(url)).status).toBe(204);

    expect(await countCardLabels(card.id, label.id)).toBe(1);
  });

  it('refuses to change labels on an archived card (409)', async () => {
    const { admin, card, label } = await setupBoard();
    expect((await admin.agent.post(`${cardsUrl}/${card.id}/archive`)).status).toBe(200);

    const res = await admin.agent.post(`${cardsUrl}/${card.id}/labels/${label.id}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CARD_ARCHIVED');
  });
});

describe('DELETE /cards/:cardId/labels/:labelId', () => {
  it('detaches, and detaching again is still 204', async () => {
    const { admin, card, label } = await setupBoard();
    const url = `${cardsUrl}/${card.id}/labels/${label.id}`;
    await admin.agent.post(url);
    expect(await countCardLabels(card.id, label.id)).toBe(1);

    expect((await admin.agent.delete(url)).status).toBe(204);
    expect(await countCardLabels(card.id, label.id)).toBe(0);
    expect((await admin.agent.delete(url)).status).toBe(204);
  });
});

describe('deleting a label that is attached to cards', () => {
  it('succeeds and removes the CardLabel rows', async () => {
    const { admin, board, list, card, label } = await setupBoard();
    const card2 = await createCard(admin.agent, list.id);
    await admin.agent.post(`${cardsUrl}/${card.id}/labels/${label.id}`);
    await admin.agent.post(`${cardsUrl}/${card2.id}/labels/${label.id}`);

    const res = await admin.agent.delete(`${boardsUrl}/${board.id}/labels/${label.id}`);

    expect(res.status).toBe(204);
    expect(await countCardLabels(card.id, label.id)).toBe(0);
    expect(await countCardLabels(card2.id, label.id)).toBe(0);
  });
});
