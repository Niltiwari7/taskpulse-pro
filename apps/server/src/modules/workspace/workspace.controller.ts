import type { Request, Response, NextFunction } from 'express';
import { db } from '../../prisma/db';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema
} from '@taskpulse/shared-types';
import { isUniqueViolation } from '../../utils/isUniqueViolation';

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

type WorkspaceMemberRow = {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

function toWorkspaceMemberResponse(member: WorkspaceMemberRow) {
  // The ORM types the joined user as nullable, but userId is a NOT NULL foreign key,
  // so every membership row has a user.
  const user = member.user!;

  return {
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    },
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

/**
 * @route GET /workspaces/:workspaceId/members
 * @description list the members of a workspace
 * @access workspace MEMBER or ADMIN (requireWorkspaceRole)
 */
export async function listWorkspaceMembers(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // requireWorkspaceRole already rejected a missing workspaceId and non-members.
    const { workspaceId } = req.params;

    // Select only public user columns so passwordHash never leaves the database.
    const members = await db.orm.public.WorkspaceMember
      .where({ workspaceId })
      .select('userId', 'role', 'joinedAt')
      .include('user', (user) =>
        user.select('id', 'username', 'email', 'fullName', 'avatarUrl'),
      )
      .orderBy([
        (m) => m.role.asc(), // ADMIN before MEMBER
        (m) => m.joinedAt.asc(),
      ])
      .all();

    res.status(200).json({
      data: { members: members.map(toWorkspaceMemberResponse) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route POST /workspaces/:workspaceId/members
 * @description add a member to a workspace
 * @access workspace ADMIN (requireWorkspaceRole)
 */
export async function addMemberToWorkspace(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = inviteMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid member data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { email, role } = parsed.data;
    const { workspaceId } = req.params;

    const user = await db.orm.public.User
      .where({ email })
      .select('id', 'username', 'email', 'fullName', 'avatarUrl')
      .first();

    if (!user) {
      res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'No user with this email.' },
      });
      return;
    }

    try {
      const member = await db.orm.public.WorkspaceMember.create({
        workspaceId,
        userId: user.id,
        role,
      });

      res.status(201).json({
        data: { member: toWorkspaceMemberResponse({ ...member, user }) },
      });
    } catch (error) {
      // The unique (workspaceId, userId) index rejects an existing member,
      // including two concurrent invites for the same user.
      if (isUniqueViolation(error)) {
        res.status(409).json({
          error: {
            code: 'ALREADY_MEMBER',
            message: 'User is already a member of this workspace.',
          },
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * @route PATCH /workspaces/:workspaceId/members/:userId
 * @description update a workspace member role
 * @access workspace ADMIN (requireWorkspaceRole)
 */

export async function updateWorkspaceMemberRole(
  req: Request<WorkspaceMemberParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = updateMemberRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid member data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { role } = parsed.data;
    const { workspaceId, userId } = req.params;

    const member = await db.orm.public.WorkspaceMember
      .where({ workspaceId, userId })
      .first();

    if (!member) {
      res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found.' },
      })
      return
    }

    // Admin can not demote their own role if he is the last admin
    if(role === 'MEMBER' && member.role === 'ADMIN' && member.userId === req.user!.id) {
      const adminCount = await db.orm.public.WorkspaceMember
        .where({ workspaceId, role: 'ADMIN' })
        .count('id');

      if(adminCount === 1) {
        res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: 'You can not demote the last admin.',
          },
        });
        return;
      }
    }

    await db.orm.public.WorkspaceMember
      .where({ workspaceId, userId })
      .update({ role });

    res.status(200).json({
      data: { member: toWorkspaceMemberResponse({ ...member, role }) },
    });
  } catch (error) {
    next(error);

  }
}

/**
 * @route DELETE /workspaces/:workspaceId/members/:userId
 * @description remove a member from a workspace
 * @access workspace ADMIN (requireWorkspaceRole)
 */

export async function removeMemberFromWorkspace(
  req: Request<WorkspaceMemberParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { workspaceId, userId } = req.params;

    const member = await db.orm.public.WorkspaceMember
      .where({ workspaceId, userId })
      .first();

    if (!member) {
      res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found.' },
      });
      return;
    }

    // if you are the last admin, you can not remove yourself
    if (member.role === 'ADMIN' && member.userId === req.user!.id) {
      const adminCount = await db.orm.public.WorkspaceMember
        .where({ workspaceId, role: 'ADMIN' })
        .count('id');

      if (adminCount === 1) {
        res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: 'You can not remove the last admin.',
          },
        });
        return;
      }
    }

    await db.orm.public.WorkspaceMember
      .where({ workspaceId, userId })
      .delete();

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}