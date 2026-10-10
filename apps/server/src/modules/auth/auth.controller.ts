import type { Request, Response, NextFunction } from "express";

import {
  loginSchema,
  registerSchema,
} from "./auth.schema";

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