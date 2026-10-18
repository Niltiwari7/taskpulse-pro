import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import app from '../src/app';
import {db} from '../src/prisma/db';

// Cleanup deletes rows, so never run this suite against a non-test database.
if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL is not a test database');
}

const baseUrl = "/api/v1/auth";

const createdEmails = new Set<string>();

function newUser() {
  const email = `auth-${randomUUID()}@example.com`;
  createdEmails.add(email);
  return {
    username: `user-${randomUUID().slice(0, 8)}`,
    email,
    password: "password123",
  }
}


async function registerUser() {
  const user =  newUser();
  const response = await request(app)
    .post(`${baseUrl}/register`)
    .send(user);

  expect(response.status).toBe(201);
  return user
}


describe("Authentication integration tests", () => {
  afterEach(async() => {
    if(createdEmails.size === 0) return;
    // Sessions are removed by the Session.user onDelete: Cascade relation
    await db.orm.public.User
      .where((u) => u.email.in([...createdEmails]))
      .deleteAll();
    createdEmails.clear();
  })

  afterAll(async () => {
    await db.close();
  })

  it("Registers a new user", async () => {
    const user = newUser()
    const response = await request(app).post(`${baseUrl}/register`).send(user);

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.user).not.toHaveProperty("password");

    const savedUser = await db.orm.public.User.where({ email: user.email }).first();

    expect(savedUser).not.toBeNull();
    expect(savedUser?.passwordHash).not.toBe(user.password);
  })

  it("Rejects duplicate email registration", async () => {
    const user = await registerUser();

    const response = await request(app)
    .post(`${baseUrl}/register`).send(user);
    expect(response.status).toBe(409);
  })

  it("Rejects login with wrong password", async() => {
    const user = await registerUser();
    const response = await request(app)
    .post(`${baseUrl}/login`)
    .send({
      email: user.email,
      password: "wrong-password"
    });
    expect(response.status).toBe(401);
  })

  it("rejects /me when no session cookie", async () => {
    const response = await request(app).get(`${baseUrl}/me`);
    expect(response.status).toBe(401);
  })

  it("invalidates the session after logout", async () => {
    const user = await registerUser();
    const agent = request.agent(app)

    const loginResponse = await agent.post(`${baseUrl}/login`).send({
      email: user.email,
      password: user.password
    })

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();

    const meBeforeLogout = await agent.get(`${baseUrl}/me`);
    expect(meBeforeLogout.status).toBe(200);
    expect(meBeforeLogout.body.data.user.email).toBe(user.email);

    const logoutResponse = await agent.post(`${baseUrl}/logout`);
     expect([200, 204]).toContain(logoutResponse.status);

    const meAfterLogout = await agent.get(`${baseUrl}/me`);
    expect(meAfterLogout.status).toBe(401);
  })
})