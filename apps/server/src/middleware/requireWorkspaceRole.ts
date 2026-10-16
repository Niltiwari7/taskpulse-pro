import type { Request, Response, NextFunction } from 'express';
import { db } from '../prisma/db';

export type WorkspaceRole = 'ADMIN' | 'MEMBER';

// Returns true if `userRole` is allowed to do something that needs `requiredRole`.
// An ADMIN can do everything a MEMBER can do, but not the other way around.
export function hasRequiredWorkspaceRole(
  userRole: WorkspaceRole,
  requiredRole: WorkspaceRole
): boolean {
  if (requiredRole === 'MEMBER') {
    return true;
  }
  return userRole === 'ADMIN';
}

// Looks up the user's role in the database.
// Returns null when the user is not a member of that workspace.
async function getWorkspaceRoleFromDb(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const membership = await db.orm.public.WorkspaceMember
    .where({ workspaceId, userId })
    .select('role')
    .first();

  if (!membership) {
    return null;
  }
  return membership.role;
}

// Usage: router.delete('/workspaces/:workspaceId', requireAuth, requireWorkspaceRole('ADMIN'), handler)
// Must run after `requireAuth`, so that `req.user` is set.
export function requireWorkspaceRole(requiredRole: WorkspaceRole) {
  return async function (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.workspaceId;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication token is missing.',
          },
        });
        return;
      }

      if (typeof workspaceId !== 'string' || workspaceId === '') {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Workspace ID is missing.',
          },
        });
        return;
      }

      const userRole = await getWorkspaceRoleFromDb(workspaceId, userId);

      if (!userRole) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not a member of this workspace.',
          },
        });
        return;
      }

      if (!hasRequiredWorkspaceRole(userRole, requiredRole)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to do this.',
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
