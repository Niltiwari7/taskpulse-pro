import argon2 from 'argon2';
import { db } from '../prisma/db';

// Every seeded user can log in with this password (local dev only).
const SEED_PASSWORD = 'password123';

async function seedUsers() {
  const passwordHash = await argon2.hash(SEED_PASSWORD);
  const users = [
    {
      id: 'seed-user-alice',
      fullName: 'Alice Smith',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash,
      avatarUrl: 'https://camo.githubusercontent.com/9105e4cd984bdf30d9027d64564d5541774e471fdfb84db12ef7a707b533dd61/68747470733a2f2f63646e2e6a7364656c6976722e6e65742f67682f616c6f68652f617661746172732f706e672f6d656d6f5f31372e706e67',
    },
    {
      id: 'seed-user-bob',
      fullName: 'Bob Johnson',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash,
      avatarUrl: 'https://camo.githubusercontent.com/8c34ba76c493e7fe32fe58497e631543daec451ab10bb704c3b59df9910df10a/68747470733a2f2f63646e2e6a7364656c6976722e6e65742f67682f616c6f68652f617661746172732f706e672f6d656d6f5f33342e706e67',
    },
  ];

  for (const user of users) {
    const { id, ...fields } = user;
    await db.orm.public.User.upsert({
      create: user,
      update: fields,
      conflictOn: { email: user.email },
    });
  }
}

async function seedWorkspacesAndBoards() {
  const workspaces = [
    {
      id: 'seed-workspace-1',
      name: 'TaskPulse Workspace',
      description: 'Primary workspace for engineering task tracking',
      visibility: 'PRIVATE' as const,
    },
    {
      id: 'seed-workspace-2',
      name: 'Product Operations',
      description: 'Public workspace for roadmap planning and product operations',
      visibility: 'PUBLIC' as const,
    },
  ];

  const boards = [
    {
      id: 'seed-board-1',
      name: 'Sprint Backlog',
      workspaceId: 'seed-workspace-1',
      visibility: 'WORKSPACE' as const,
    },
  ];

  // Workspaces must exist before boards reference them.
  for (const workspace of workspaces) {
    const { id, ...fields } = workspace;
    await db.orm.public.Workspace.upsert({ create: workspace, update: fields });
  }

  for (const board of boards) {
    const { id, ...fields } = board;
    await db.orm.public.Board.upsert({ create: board, update: fields });
  }
}

async function seedMemberships() {
  await db.orm.public.WorkspaceMember.upsert({
    create: {
      workspaceId: 'seed-workspace-1',
      userId: 'seed-user-alice',
      role: 'ADMIN',
    },
    update: { role: 'ADMIN' },
    conflictOn: { workspaceId: 'seed-workspace-1', userId: 'seed-user-alice' },
  });

  // Bob shares Alice's workspace, so both see it on their dashboards.
  await db.orm.public.WorkspaceMember.upsert({
    create: {
      workspaceId: 'seed-workspace-1',
      userId: 'seed-user-bob',
      role: 'MEMBER',
    },
    update: { role: 'MEMBER' },
    conflictOn: { workspaceId: 'seed-workspace-1', userId: 'seed-user-bob' },
  });
}

async function seedLists() {
  const lists = [
    { id: 'seed-list-todo', name: 'To Do', position: 1, boardId: 'seed-board-1', isArchived: false },
    { id: 'seed-list-inprogress', name: 'In Progress', position: 2, boardId: 'seed-board-1', isArchived: false },
    { id: 'seed-list-done', name: 'Done', position: 3, boardId: 'seed-board-1', isArchived: false },
  ];

  for (const list of lists) {
    const { id, ...fields } = list;
    await db.orm.public.List.upsert({ create: list, update: fields });
  }
}

async function seedCards() {
  const cards = [
    {
      id: 'seed-card-1',
      title: 'Implement User Authentication',
      description: 'Implement user authentication using JWT and OAuth2.',
      listId: 'seed-list-todo',
      position: 1,
      isDueComplete: false,
      isArchived: false,
    },
    {
      id: 'seed-card-2',
      title: 'Design Database Schema',
      description: 'Design the database schema for the application.',
      listId: 'seed-list-todo',
      position: 2,
      isDueComplete: false,
      isArchived: false,
    },
  ];

  for (const card of cards) {
    const { id, ...fields } = card;
    await db.orm.public.Card.upsert({ create: card, update: fields });
  }
}

async function main() {
  console.log('Seeding database...');
  await seedUsers();
  await seedWorkspacesAndBoards();
  await seedMemberships();
  await seedLists();
  await seedCards();
  console.log('Database seeding completed.');
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await db.close();
}
