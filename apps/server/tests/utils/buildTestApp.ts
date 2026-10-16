import express from 'express';
import type { RequestHandler } from 'express';
import type { AuthenticatedUser } from '../../src/middleware/requiredAuth';

type BuildTestAppOptions = {
  // The route to test, e.g. '/workspaces/:workspaceId'
  path: string;
  // The middleware we want to test
  middleware: RequestHandler;
  // The logged-in user. Leave it out to test a request with no user.
  user?: AuthenticatedUser;
};

// Builds a tiny Express app for testing a single middleware.
// It skips the real login flow and puts `user` straight on `req.user`,
// the same way `requireAuth` would. If the middleware calls next(),
// the route answers 200 with { ok: true }.
export function buildTestApp({ path, middleware, user }: BuildTestAppOptions) {
  const app = express();

  app.use((req, _res, next) => {
    if (user) {
      req.user = user;
    }
    next();
  });

  app.get(path, middleware, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}
