import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app';
import { db } from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

type Agent = ReturnType<typeof request.agent>;
type Visibility = 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';

const workspacesUrl = '/api/v1/workspaces';
const boardsUrl = '/api/v1/boards';

const createdEmails = new Set<string>();

// Registers and logs in a fresh user; the returned agent carries the session cookie.
async function loginAsNewUser() {
  const email = `matrix-${randomUUID()}@example.com`;
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

type User = Awaited<ReturnType<typeof loginAsNewUser>>;

// ---------------------------------------------------------------------------
// The matrix. Mirrors the board route tables in docs/permissions.md — keep them in sync.
// ---------------------------------------------------------------------------

const ACTORS = [
  'anonymous',
  'outsider',
  'wsMember',
  'wsAdmin',
  'boardAdmin',
  'boardMember',
  'observer',
  'guest',
] as const;
type Actor = (typeof ACTORS)[number];

type Route =
  | 'listBoards'
  | 'createBoard'
  | 'getBoard'
  | 'patchBoard'
  | 'archiveBoard'
  | 'deleteBoard'
  | 'listMembers'
  | 'addMember'
  | 'removeOtherMember'
  | 'removeSelf';

// One status per actor, in ACTORS order. The tuple type makes a missing column a type error.
type Row = readonly [number, number, number, number, number, number, number, number];

// Statuses on a WORKSPACE-visible board.
//                          anon outsider wsMember wsAdmin bAdmin bMember observer guest
const workspaceBoard: Record<Route, Row> = {
  listBoards:              [401, 404,     200,     200,    200,   200,    200,     404],
  createBoard:             [401, 404,     201,     201,    201,   201,    201,     404],
  getBoard:                [401, 404,     200,     200,    200,   200,    200,     200],
  patchBoard:              [401, 404,     403,     200,    200,   403,    403,     403],
  archiveBoard:            [401, 404,     403,     200,    200,   403,    403,     403],
  deleteBoard:             [401, 404,     403,     204,    204,   403,    403,     403],
  listMembers:             [401, 404,     200,     200,    200,   200,    200,     200],
  addMember:               [401, 404,     403,     201,    201,   403,    403,     403],
  removeOtherMember:       [401, 404,     403,     204,    204,   403,    403,     403],
  removeSelf:              [401, 404,     404,     404,    204,   204,    204,     204],
};

type Overrides = Partial<Record<Route, Partial<Record<Actor, number>>>>;

// Other visibilities only change who can *see* the board, so they are written as differences.
const overridesByVisibility: Record<Visibility, Overrides> = {
  WORKSPACE: {},
  // A workspace member who is not on a PRIVATE board cannot see it.
  PRIVATE: {
    getBoard: { wsMember: 404 },
    patchBoard: { wsMember: 404 },
    archiveBoard: { wsMember: 404 },
    deleteBoard: { wsMember: 404 },
    listMembers: { wsMember: 404 },
    addMember: { wsMember: 404 },
    removeOtherMember: { wsMember: 404 },
  },
  // Any logged-in user can see a PUBLIC board, so an outsider gets 403 instead of 404 on changes.
  PUBLIC: {
    getBoard: { outsider: 200 },
    patchBoard: { outsider: 403 },
    archiveBoard: { outsider: 403 },
    deleteBoard: { outsider: 403 },
    listMembers: { outsider: 200 },
    addMember: { outsider: 403 },
    removeOtherMember: { outsider: 403 },
  },
};

function casesFor(visibility: Visibility) {
  const overrides = overridesByVisibility[visibility];
  return (Object.keys(workspaceBoard) as Route[]).flatMap((route) =>
    ACTORS.map((actor, i) => {
      const status = overrides[route]?.[actor] ?? workspaceBoard[route][i];
      return [actor, route, status] as const;
    }),
  );
}

// ---------------------------------------------------------------------------
// Fixture: users and the workspace are created once (logins are slow); every case gets a fresh board,
// because archive, delete and member removal change the board.
// ---------------------------------------------------------------------------

let workspaceId: string;
let owner: User; // creates every board, so each board keeps a second ADMIN besides the boardAdmin actor
let invitee: User; // workspace member that addMember tries to add
let target: User; // board member that removeOtherMember tries to remove
const actors = {} as Record<Exclude<Actor, 'anonymous'>, User>;
const anonymous = request.agent(app);

async function addWorkspaceMember(email: string, role: 'ADMIN' | 'MEMBER') {
  const res = await owner.agent
    .post(`${workspacesUrl}/${workspaceId}/members`)
    .send({ email, role });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
}

async function addBoardMember(boardId: string, email: string, role: 'ADMIN' | 'MEMBER' | 'OBSERVER' | 'GUEST') {
  const res = await owner.agent.post(`${boardsUrl}/${boardId}/members`).send({ email, role });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
}

async function createBoardWithMembers(visibility: Visibility) {
  const res = await owner.agent
    .post(`${workspacesUrl}/${workspaceId}/boards`)
    .send({ name: 'Matrix', visibility });
  expect(res.status).toBe(201);
  const boardId = res.body.data.board.id as string;

  await addBoardMember(boardId, actors.boardAdmin.email, 'ADMIN');
  await addBoardMember(boardId, actors.boardMember.email, 'MEMBER');
  await addBoardMember(boardId, actors.observer.email, 'OBSERVER');
  await addBoardMember(boardId, actors.guest.email, 'GUEST');
  await addBoardMember(boardId, target.email, 'MEMBER');

  return boardId;
}

// How each route is called. `asAgent` is the actor's session (no cookie for anonymous).
const callRoute: Record<
  Route,
  (asAgent: Agent, boardId: string, actorId: string) => Promise<request.Response>
> = {
  listBoards: (as) => as.get(`${workspacesUrl}/${workspaceId}/boards`),
  createBoard: (as) => as.post(`${workspacesUrl}/${workspaceId}/boards`).send({ name: 'New board' }),
  getBoard: (as, boardId) => as.get(`${boardsUrl}/${boardId}`),
  patchBoard: (as, boardId) => as.patch(`${boardsUrl}/${boardId}`).send({ name: 'Renamed' }),
  archiveBoard: (as, boardId) => as.post(`${boardsUrl}/${boardId}/archive`),
  // Archive first, so allowed actors get 204 instead of 409 BOARD_NOT_ARCHIVED.
  deleteBoard: async (as, boardId) => {
    const archiveRes = await owner.agent.post(`${boardsUrl}/${boardId}/archive`);
    expect(archiveRes.status).toBe(200);
    return as.delete(`${boardsUrl}/${boardId}`);
  },
  listMembers: (as, boardId) => as.get(`${boardsUrl}/${boardId}/members`),
  addMember: (as, boardId) =>
    as.post(`${boardsUrl}/${boardId}/members`).send({ email: invitee.email, role: 'MEMBER' }),
  removeOtherMember: (as, boardId) => as.delete(`${boardsUrl}/${boardId}/members/${target.id}`),
  removeSelf: (as, boardId, actorId) => as.delete(`${boardsUrl}/${boardId}/members/${actorId}`),
};

beforeAll(async () => {
  owner = await loginAsNewUser();
  const res = await owner.agent.post(workspacesUrl).send({ name: 'Matrix', visibility: 'PRIVATE' });
  expect(res.status).toBe(201);
  workspaceId = res.body.data.workspace.id;

  actors.outsider = await loginAsNewUser();
  actors.wsMember = await loginAsNewUser();
  actors.wsAdmin = await loginAsNewUser();
  actors.boardAdmin = await loginAsNewUser();
  actors.boardMember = await loginAsNewUser();
  actors.observer = await loginAsNewUser();
  actors.guest = await loginAsNewUser();
  invitee = await loginAsNewUser();
  target = await loginAsNewUser();

  await addWorkspaceMember(actors.wsMember.email, 'MEMBER');
  await addWorkspaceMember(actors.wsAdmin.email, 'ADMIN');
  await addWorkspaceMember(actors.boardAdmin.email, 'MEMBER');
  await addWorkspaceMember(actors.boardMember.email, 'MEMBER');
  await addWorkspaceMember(actors.observer.email, 'MEMBER');
  await addWorkspaceMember(invitee.email, 'MEMBER');
  await addWorkspaceMember(target.email, 'MEMBER');
  // outsider and guest stay outside the workspace.
});

afterAll(async () => {
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

    // The guest is only a board member, so their rows are not reached through a workspace.
    await db.orm.public.BoardMember.where((m) => m.userId.in(userIds)).deleteAll();
  }

  // Sessions are removed by the Session.user onDelete: Cascade relation
  await db.orm.public.User
    .where((u) => u.email.in([...createdEmails]))
    .deleteAll();
  await db.close();
});

describe.each(['WORKSPACE', 'PRIVATE', 'PUBLIC'] as const)('%s board', (visibility) => {
  it.each(casesFor(visibility))('%s → %s → %i', async (actor, route, expected) => {
    const boardId = await createBoardWithMembers(visibility);
    const asAgent = actor === 'anonymous' ? anonymous : actors[actor].agent;
    const actorId = actor === 'anonymous' ? randomUUID() : actors[actor].id;

    const res = await callRoute[route](asAgent, boardId, actorId);

    // The body shows the error code (e.g. NOT_FOUND vs MEMBER_NOT_FOUND) when a cell goes red.
    expect(res.status, JSON.stringify(res.body)).toBe(expected);
  });
});
