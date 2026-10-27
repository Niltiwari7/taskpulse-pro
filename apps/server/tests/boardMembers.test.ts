import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';

import app from '../src/app';
import {db} from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;

const workspaceUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';
const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `board-member-${randomUUID()}@example.com`;
  createdEmails.add(email);
  const user = {
    username: `user-${randomUUID().slice(0, 8)}`,
    email,
    password: 'password123',
  };
  
  const agent = request.agent(app);
  const registerRes = await agent.post('/api/v1/auth/register').send(user);
  expect(registerRes.status).toBe(201);
  const loginRes = await agent.post('/api/v1/auth/login').send({email: user.email, password: user.password});
  expect(loginRes.status).toBe(200);

  return {agent, email, id: registerRes.body.data.user.id as string};
}

async function createWorkspace(agent : Agent) {
  const res = await agent.post(workspaceUrl).send({name: 'Team A', visibility: 'PRIVATE'});
  expect(res.status).toBe(201);
  return res.body.data.workspace as {id: string}; 
}

async function addWorkspaceMember(admin: Agent, workspaceId: string, email: string) {
  const res = await admin
    .post(`${workspaceUrl}/${workspaceId}/members`)
    .send({ email, role: 'MEMBER' });
  expect(res.status).toBe(201);
}

async function createBoard(agent: Agent,
  workspaceId: string,
  body: {name?: string, visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC'} = {},
) {
  const res = await agent.post(`${workspaceUrl}/${workspaceId}/boards`).send({name: 'Roadmap', ...body});
  expect(res.status).toBe(201);
  return res.body.data.board as {id: string; name: string; archivedAt: string | null};
}

async function listBoardIds(agent: Agent, workspaceId: string) {
  const res = await agent.get(`${workspaceUrl}/${workspaceId}/boards`);
  expect(res.status).toBe(200);
  return (res.body.data.boards as {id: string}[]).map((b) => b.id);
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

function addBoardMember(
  agent: Agent,
  boardId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER' | 'OBSERVER' | 'GUEST' = 'MEMBER',
) {
  return agent.post(`${boardsUrl}/${boardId}/members`).send({ email, role });
}

function removeBoardMember(agent: Agent, boardId: string, userId: string) {
  return agent.delete(`${boardsUrl}/${boardId}/members/${userId}`);
}

async function setupPrivateBoard() {
  const alice = await loginAsNewUser();
  const bob = await loginAsNewUser();
  const workspace = await createWorkspace(alice.agent);
  await addWorkspaceMember(alice.agent, workspace.id, bob.email);
  const board = await createBoard(alice.agent, workspace.id, { visibility: 'PRIVATE' });
  return { alice, bob, workspace, board };
}

describe('POST /boards/:boardId/members', () => {
  it('lets a workspace member open a PRIVATE board once added to it', async () => {
    // 1 + 2
    const { alice, bob, workspace, board } = await setupPrivateBoard();

    // 3. Not on the board yet: 404, not 403, so the board's existence isn't leaked.
    expect((await bob.agent.get(`${boardsUrl}/${board.id}`)).status).toBe(404);

    // 4
    const addRes = await addBoardMember(alice.agent, board.id, bob.email, 'MEMBER');
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.member).toMatchObject({
      userId: bob.id,
      role: 'MEMBER',
      user: { email: bob.email },
    });

    // 5. Done-when
    expect((await bob.agent.get(`${boardsUrl}/${board.id}`)).status).toBe(200);

    // 6
    expect(await listBoardIds(bob.agent, workspace.id)).toContain(board.id);
  });

  it('adds an outsider as GUEST, scoped to that one board', async () => {
    const { alice, workspace, board } = await setupPrivateBoard();
    const carol = await loginAsNewUser(); // not in the workspace
    const otherBoard = await createBoard(alice.agent, workspace.id, {
      name: 'Secret',
      visibility: 'PRIVATE',
    });

    const res = await addBoardMember(alice.agent, board.id, carol.email, 'GUEST');
    expect(res.status).toBe(201);

    expect((await carol.agent.get(`${boardsUrl}/${board.id}`)).status).toBe(200);
    expect((await carol.agent.get(`${boardsUrl}/${otherBoard.id}`)).status).toBe(404);
  });
  
  it('rejects an outsider added as anything other than GUEST', async () => {
    const { alice, board } = await setupPrivateBoard();
    const carol = await loginAsNewUser();

    const res = await addBoardMember(alice.agent, board.id, carol.email, 'MEMBER');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_WORKSPACE_MEMBER');
  });

  it('rejects a workspace member added as GUEST', async () => {
    const { alice, bob, board } = await setupPrivateBoard();

    const res = await addBoardMember(alice.agent, board.id, bob.email, 'GUEST');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_ROLE');
  });

  it('forbids a non-admin board member from adding people', async () => {
    const { alice, bob, workspace, board } = await setupPrivateBoard();
    const dave = await loginAsNewUser();
    await addWorkspaceMember(alice.agent, workspace.id, dave.email);
    await addBoardMember(alice.agent, board.id, bob.email, 'MEMBER');

    const res = await addBoardMember(bob.agent, board.id, dave.email, 'MEMBER');

    expect(res.status).toBe(403);
  });

  it('returns 409 when the user is already a member', async () => {
    const { alice, bob, board } = await setupPrivateBoard();
    expect((await addBoardMember(alice.agent, board.id, bob.email)).status).toBe(201);

    const res = await addBoardMember(alice.agent, board.id, bob.email);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('returns 404 for an unknown email', async () => {
    const { alice, board } = await setupPrivateBoard();

    const res = await addBoardMember(alice.agent, board.id, `nobody-${randomUUID()}@example.com`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('DELETE /boards/:boardId/members/:userId', () => {
  it('locks a removed member out of the PRIVATE board again', async () => {
    const { alice, bob, board } = await setupPrivateBoard();
    await addBoardMember(alice.agent, board.id, bob.email);
    expect((await bob.agent.get(`${boardsUrl}/${board.id}`)).status).toBe(200);

    const res = await removeBoardMember(alice.agent, board.id, bob.id);

    expect(res.status).toBe(204);
    expect((await bob.agent.get(`${boardsUrl}/${board.id}`)).status).toBe(404);
  });

  it('refuses to remove the last ADMIN', async () => {
    // createBoard makes alice the board's only ADMIN.
    const { alice, board } = await setupPrivateBoard();

    const res = await removeBoardMember(alice.agent, board.id, alice.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_BOARD_ADMIN');
  });

  it('lets a member remove themselves', async () => {
    const { alice, bob, board } = await setupPrivateBoard();
    await addBoardMember(alice.agent, board.id, bob.email);

    const res = await removeBoardMember(bob.agent, board.id, bob.id);

    expect(res.status).toBe(204);
  });
});

