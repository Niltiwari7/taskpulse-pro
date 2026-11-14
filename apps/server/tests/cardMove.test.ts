import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';
import app from '../src/app';
import {db} from '../src/prisma/db';
import {deleteBoardContent} from '../src/modules/board/board.controller';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

type CardBody = {
  id: string;
  listId: string;
  title: string;
  position: string;
  isArchived: boolean;
};

type MoveBody = {
  targetListId: string;
  beforeId: string | null;
  afterId: string | null;
};

const cardsUrl = '/api/v1/cards';
const listsUrl = '/api/v1/lists';
const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';
const createdEmails = new Set<string>();

async function loginAsNewUser() {
  const email = `move-${randomUUID()}@example.com`;
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
    .send({email: user.email, password: user.password});
  expect(loginRes.status).toBe(200);

  return {agent, email};
}

async function createWorkspace(agent: Agent) {
  const res = await agent.post(workspacesUrl).send({name: 'Team A', visibility: 'PRIVATE'});
  expect(res.status).toBe(201);
  return res.body.data.workspace as {id: string};
}

async function createBoard(agent: Agent, workspaceId: string) {
  const res = await agent
    .post(`${workspacesUrl}/${workspaceId}/boards`)
    .send({name: 'Roadmap', visibility: 'WORKSPACE'});
  expect(res.status).toBe(201);
  return res.body.data.board as {id: string};
}

async function createList(agent: Agent, boardId: string, name: string) {
  const res = await agent.post(`${boardsUrl}/${boardId}/lists`).send({name});
  expect(res.status).toBe(201);
  return res.body.data.list as {id: string};
}

async function createCard(agent: Agent, listId: string, title: string) {
  const res = await agent.post(`${listsUrl}/${listId}/cards`).send({title});
  expect(res.status).toBe(201);
  return res.body.data.card as CardBody;
}

async function archiveCard(agent: Agent, cardId: string) {
  const res = await agent.post(`${cardsUrl}/${cardId}/archive`);
  expect(res.status).toBe(200);
}

function move(agent: Agent, cardId: string, body: MoveBody) {
  return agent.patch(`${cardsUrl}/${cardId}/move`).send(body);
}

// Card titles of one list, in the order the board endpoint returns them (what users see).
async function order(agent: Agent, boardId: string, listId: string): Promise<string[]> {
  const res = await agent.get(`${boardsUrl}/${boardId}`);
  expect(res.status).toBe(200);
  const list = res.body.data.board.lists.find((l: {id: string}) => l.id === listId);
  return list.cards.map((c: CardBody) => c.title);
}

// Board with list A holding cards 1, 2, 3 (top to bottom) and an empty list B.
async function setup() {
  const admin = await loginAsNewUser();
  const workspace = await createWorkspace(admin.agent);
  const board = await createBoard(admin.agent, workspace.id);
  const a = await createList(admin.agent, board.id, 'A');
  const b = await createList(admin.agent, board.id, 'B');
  const c1 = await createCard(admin.agent, a.id, '1');
  const c2 = await createCard(admin.agent, a.id, '2');
  const c3 = await createCard(admin.agent, a.id, '3');
  return {admin, workspace, board, a, b, c1, c2, c3};
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

  await db.orm.public.User
    .where((u) => u.email.in([...createdEmails]))
    .deleteAll();
  createdEmails.clear();
});

afterAll(async () => {
  await db.close();
});

describe('PATCH /cards/:cardId/move — placement', () => {
  it('moves a card to the top of its list', async () => {
    const {admin, board, a, c1, c3} = await setup();

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: null, afterId: c1.id});

    expect(res.status).toBe(200);
    expect(res.body.data.card).toMatchObject({id: c3.id, listId: a.id});
    expect(res.body.data.card.position < c1.position).toBe(true);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['3', '1', '2']);
  });

  it('moves a card to the bottom of its list', async () => {
    const {admin, board, a, c1, c3} = await setup();

    const res = await move(admin.agent, c1.id, {targetListId: a.id, beforeId: c3.id, afterId: null});

    expect(res.status).toBe(200);
    expect(res.body.data.card.position > c3.position).toBe(true);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['2', '3', '1']);
  });

  it('moves a card between two others in the same list', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: c2.id});

    expect(res.status).toBe(200);
    expect(res.body.data.card.position > c1.position).toBe(true);
    expect(res.body.data.card.position < c2.position).toBe(true);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3', '2']);
  });

  it('moves a card into an empty list', async () => {
    const {admin, board, a, b, c2} = await setup();

    const res = await move(admin.agent, c2.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(200);
    expect(res.body.data.card.listId).toBe(b.id);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3']);
    expect(await order(admin.agent, board.id, b.id)).toEqual(['2']);
  });

  it('moves a card across lists between two cards', async () => {
    const {admin, board, a, b, c1} = await setup();
    const x = await createCard(admin.agent, b.id, 'x');
    const y = await createCard(admin.agent, b.id, 'y');

    const res = await move(admin.agent, c1.id, {targetListId: b.id, beforeId: x.id, afterId: y.id});

    expect(res.status).toBe(200);
    expect(res.body.data.card.listId).toBe(b.id);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['2', '3']);
    expect(await order(admin.agent, board.id, b.id)).toEqual(['x', '1', 'y']);
  });

  it('moving a card to the slot it already holds keeps the order', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();

    const res = await move(admin.agent, c2.id, {targetListId: a.id, beforeId: c1.id, afterId: c3.id});

    expect(res.status).toBe(200);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });

  it('moving the only card of a list into that same list with no anchors succeeds', async () => {
    const {admin, board, b} = await setup();
    const only = await createCard(admin.agent, b.id, 'only');

    const res = await move(admin.agent, only.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(200);
    expect(await order(admin.agent, board.id, b.id)).toEqual(['only']);
  });

  it('repeated moves to the same slot stay between the anchors', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();

    for (let i = 0; i < 10; i++) {
      const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: c2.id});
      expect(res.status).toBe(200);
      expect(res.body.data.card.position > c1.position).toBe(true);
      expect(res.body.data.card.position < c2.position).toBe(true);
    }
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3', '2']);
  });
});

describe('PATCH /cards/:cardId/move — archived cards keep their rank', () => {
  // The archived card's rank sits in the gap; ignoring it would collide on (listId, position).
  it('moves past an archived card that sits right after the anchor', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();
    await archiveCard(admin.agent, c2.id);

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: null});

    expect(res.status).toBe(200);
    expect(res.body.data.card.position).not.toBe(c2.position);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3']);
  });

  it('drops into a list whose only cards are archived', async () => {
    const {admin, board, b, c1} = await setup();
    const old = await createCard(admin.agent, b.id, 'old');
    await archiveCard(admin.agent, old.id);

    const res = await move(admin.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(200);
    expect(res.body.data.card.position).not.toBe(old.position);
    expect(await order(admin.agent, board.id, b.id)).toEqual(['1']);
  });
});

describe('PATCH /cards/:cardId/move — stale anchors (409)', () => {
  it('rejects an anchor that was archived', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();
    await archiveCard(admin.agent, c2.id);

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: c2.id});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_ANCHOR');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3']);
  });

  it('rejects an anchor that moved to another list', async () => {
    const {admin, board, a, b, c1, c2, c3} = await setup();
    const moved = await move(admin.agent, c2.id, {targetListId: b.id, beforeId: null, afterId: null});
    expect(moved.status).toBe(200);

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: c2.id});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_ANCHOR');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '3']);
  });

  it('rejects anchors in the wrong order', async () => {
    const {admin, board, a, c1, c2, c3} = await setup();

    const res = await move(admin.agent, c1.id, {targetListId: a.id, beforeId: c3.id, afterId: c2.id});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_ANCHOR');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });

  it('rejects an "empty list" drop when the list has active cards', async () => {
    const {admin, board, a, b, c1} = await setup();
    await createCard(admin.agent, b.id, 'x');

    const res = await move(admin.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STALE_ANCHOR');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });
});

describe('PATCH /cards/:cardId/move — target list', () => {
  it('returns 404 for a list on another board', async () => {
    const {admin, workspace, board, a, c1} = await setup();
    const otherBoard = await createBoard(admin.agent, workspace.id);
    const otherList = await createList(admin.agent, otherBoard.id, 'Elsewhere');

    const res = await move(admin.agent, c1.id, {targetListId: otherList.id, beforeId: null, afterId: null});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LIST_NOT_FOUND');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });

  it('returns 404 for a list that does not exist', async () => {
    const {admin, c1} = await setup();

    const res = await move(admin.agent, c1.id, {targetListId: 'missing', beforeId: null, afterId: null});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LIST_NOT_FOUND');
  });

  it('returns 409 for an archived list', async () => {
    const {admin, b, c1} = await setup();
    await admin.agent.delete(`${listsUrl}/${b.id}`).expect(204);

    const res = await move(admin.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIST_ARCHIVED');
  });
});

describe('PATCH /cards/:cardId/move — validation', () => {
  it('rejects the card as its own anchor (400)', async () => {
    const {admin, a, c1, c2} = await setup();

    const res = await move(admin.agent, c2.id, {targetListId: a.id, beforeId: c1.id, afterId: c2.id});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ANCHOR');
  });

  it('rejects identical before and after anchors (400)', async () => {
    const {admin, a, c1, c3} = await setup();

    const res = await move(admin.agent, c3.id, {targetListId: a.id, beforeId: c1.id, afterId: c1.id});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a body without targetListId (400)', async () => {
    const {admin, c1} = await setup();

    const res = await admin.agent
      .patch(`${cardsUrl}/${c1.id}/move`)
      .send({beforeId: null, afterId: null});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown fields such as a client-chosen position (400)', async () => {
    const {admin, a, c1} = await setup();

    const res = await admin.agent
      .patch(`${cardsUrl}/${c1.id}/move`)
      .send({targetListId: a.id, beforeId: null, afterId: null, position: '0'});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to move an archived card (409)', async () => {
    const {admin, b, c1} = await setup();
    await archiveCard(admin.agent, c1.id);

    const res = await move(admin.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CARD_ARCHIVED');
  });
});

describe('PATCH /cards/:cardId/move — permissions', () => {
  it('an OBSERVER gets 403 and nothing moves', async () => {
    const {admin, workspace, board, a, b, c1} = await setup();
    const observer = await loginAsNewUser();
    await admin.agent
      .post(`${workspacesUrl}/${workspace.id}/members`)
      .send({email: observer.email, role: 'MEMBER'})
      .expect(201);
    await admin.agent
      .post(`${boardsUrl}/${board.id}/members`)
      .send({email: observer.email, role: 'OBSERVER'})
      .expect(201);

    const res = await move(observer.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(403);
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });

  it('an outsider gets 404 and nothing moves', async () => {
    const {admin, board, a, b, c1} = await setup();
    const outsider = await loginAsNewUser();

    const res = await move(outsider.agent, c1.id, {targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CARD_NOT_FOUND');
    expect(await order(admin.agent, board.id, a.id)).toEqual(['1', '2', '3']);
  });

  it('an outsider gets 404, not 400, for a malformed body', async () => {
    const {c1} = await setup();
    const outsider = await loginAsNewUser();

    const res = await outsider.agent.patch(`${cardsUrl}/${c1.id}/move`).send({nonsense: true});

    expect(res.status).toBe(404);
  });

  it('returns 401 when logged out', async () => {
    const {b, c1} = await setup();

    const res = await request(app)
      .patch(`${cardsUrl}/${c1.id}/move`)
      .send({targetListId: b.id, beforeId: null, afterId: null});

    expect(res.status).toBe(401);
  });
});
