import type { Request, Response, NextFunction } from 'express';
import { db } from '../../prisma/db';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from '@taskpulse/shared-types';

type WorkspaceParams = { workspaceId: string };

type WorkspaceRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string;
};

function toWorkspaceResponse(workspace: WorkspaceRow) {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    visibility: workspace.visibility,
    createdAt: workspace.createdAt,
  };
}

function sendNotFound(res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Workspace not found.',
    },
  });
}

/**
 * @route POST /workspaces
 * @description create a workspace; the creator becomes its ADMIN
 * @access any authenticated user
 */
export async function createWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createWorkspaceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workspace data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    // requireAuth guarantees req.user; capture it so the closure below keeps the type.
    const userId = req.user!.id;

    // Create the workspace and its ADMIN membership together.
    const workspace = await db.transaction(async (tx) => {
      const newWorkspace = await tx.orm.public.Workspace.create({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        visibility: parsed.data.visibility,
      });

      await tx.orm.public.WorkspaceMember.create({
        workspaceId: newWorkspace.id,
        userId,
        role: 'ADMIN',
      });

      return newWorkspace;
    });

    res.status(201).json({
      data: { workspace: toWorkspaceResponse(workspace) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route GET /workspaces
 * @description list the workspaces the current user is a member of
 * @access any authenticated user
 */
export async function listWorkspaces(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;

    const workspaces = await db.orm.public.Workspace
      .where((w) => w.members.some((m) => m.userId.eq(userId)))
      .orderBy([(w) => w.createdAt.desc(), (w) => w.id.desc()])
      .all();

    res.status(200).json({
      data: { workspaces: workspaces.map(toWorkspaceResponse) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route GET /workspaces/:workspaceId
 * @description get a workspace
 * @access workspace MEMBER or ADMIN (requireWorkspaceRole)
 */
export async function getWorkspace(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspace = await db.orm.public.Workspace
      .where({ id: req.params.workspaceId })
      .first();

    if (!workspace) {
      sendNotFound(res);
      return;
    }

    res.status(200).json({
      data: { workspace: toWorkspaceResponse(workspace) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route PATCH /workspaces/:workspaceId
 * @description update a workspace's name, description or visibility
 * @access workspace ADMIN (requireWorkspaceRole)
 */
export async function updateWorkspace(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateWorkspaceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid workspace data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const workspace = await db.orm.public.Workspace
      .where({ id: req.params.workspaceId })
      .update(parsed.data);

    if (!workspace) {
      sendNotFound(res);
      return;
    }

    res.status(200).json({
      data: { workspace: toWorkspaceResponse(workspace) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route DELETE /workspaces/:workspaceId
 * @description delete a workspace and its memberships
 * @access workspace ADMIN (requireWorkspaceRole)
 */
export async function deleteWorkspace(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;

    // Members reference the workspace, so they go first.
    await db.transaction(async (tx) => {
      await tx.orm.public.WorkspaceMember.where({ workspaceId }).deleteAll();
      await tx.orm.public.Workspace.where({ id: workspaceId }).delete();
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
