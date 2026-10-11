import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { db} from '../prisma/db';
import { hashToken } from './hashToken';


export type AuthenticatedUser = {
  id: string;
  username: string;
  email: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.taskpulse_session as string | undefined;

    if(!token) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication token is missing.",
        },
      });
      return;
    }

    const session = await db.orm.public.Session
      .where({ tokenHash: hashToken(token) })
      .select('id', 'expiresAt')
      .include('user', (user) => user.select('id', 'username', 'email'))
      .first();

    if(!session || !session.user || new Date(session.expiresAt) <= new Date()) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Session is invalid or has expired.",
        },
      });
      return;
    }

    req.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}