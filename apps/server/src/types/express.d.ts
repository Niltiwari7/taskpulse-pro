import type { AuthenticatedUser } from "../middleware/requiredAuth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {}