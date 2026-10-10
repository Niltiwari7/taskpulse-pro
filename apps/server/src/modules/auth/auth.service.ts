import argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { db } from '../../prisma/db';

import type { RegisterInput, LoginInput } from './auth.schema';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Postgres SQLSTATE 23505 = unique violation. The driver error may be wrapped,
// so walk the `cause` chain.
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('sqlState' in current && current.sqlState === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.toLowerCase();

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) {
    throw new AuthError('User with this email already exists', 409);
  }

  const passwordHash = await argon2.hash(input.password);

  try {
    return await db.orm.public.User.create({
      username: input.username,
      email,
      passwordHash,
    });
  } catch (error) {
    // Covers a taken username, or two concurrent registrations for one email.
    if (isUniqueViolation(error)) {
      throw new AuthError('Username or email is already taken', 409);
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput) {
  const user = await db.orm.public.User.where({
    email: input.email.toLowerCase(),
  }).first();

  if (!user) {
    throw new AuthError('Invalid email or password.', 401);
  }

  const passwordMatches = await argon2.verify(
    user.passwordHash,
    input.password
  );

  if (!passwordMatches) {
    throw new AuthError('Invalid email or password.', 401);
  }

  // The browser receives the raw token; the database stores its hash.
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.orm.public.Session.create({
    tokenHash,
    userId: user.id,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    user,
    token,
    expiresAt,
  };
}
