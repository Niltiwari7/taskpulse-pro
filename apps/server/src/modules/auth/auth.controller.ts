import type { Request, Response, NextFunction } from "express";
import { db } from "../../prisma/db";
import {hashToken} from "../../middleware/hashToken";

import {
  loginSchema,
  registerSchema,
} from "@taskpulse/shared-types";

import {
  AuthError,
  loginUser,
  registerUser,
} from "./auth.service";

import { toPublicUser } from "../../utils/toPublicUser";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid registration data.",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const user = await registerUser(parsed.data);

    res.status(201).json({
      data: {
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: {
          code: error.statusCode === 409 ? "CONFLICT" : "AUTH_ERROR",
          message: error.message,
        },
      });
      return;
    }

    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid login data.",
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const result = await loginUser(parsed.data);

    res.cookie("taskpulse_session", result.token, {
      ...cookieOptions,
      expires: result.expiresAt,
    });

    res.status(200).json({
      data: {
        user: toPublicUser(result.user),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: error.message,
        },
      });
      return;
    }

    next(error);
  }
}

export function getMe(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
    return;
  }

  res.status(200).json({
    data: {
      user: toPublicUser(req.user),
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.["taskpulse_session"] as string | undefined;

    if(typeof token === 'string' && token.length > 0){
      await db.orm.public.Session.where({ tokenHash: hashToken(token) }).delete();
    }
    res.clearCookie("taskpulse_session", cookieOptions);
    res.status(200).json({
      data: {
        message: "Logged out successfully.",
      },
    });
  }catch (error) {
    console.error(`Failed to log out: ${error}`);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to log out.",
      },
    });
  }
}