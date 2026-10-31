import type { Request, Response, NextFunction } from 'express';
import { db } from '../../prisma/db';
import {
  addBoardMemberSchema,
  createBoardSchema,
  createListSchema,
  updateBoardSchema,
  type BoardMemberRole,
  type WorkspaceRole,
} from '@taskpulse/shared-types';
import { canAccessBoard, canEditBoardContent } from './board.access';
import { isUniqueViolation } from '../../utils/isUniqueViolation';
import { rankBetween } from '../../shared/rank';

type WorkspaceParams = { workspaceId: string };
type BoardParams = { boardId: string };
type BoardMemberParams = {boardId: string, userId: string};

type BoardRow = {
  id: string;
  workspaceId: string;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';
  backgroundColorOrUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
};

type ListRow = {
  id: string;
  boardId : string;
  name: string;
  position: string;
  isArchived: boolean;
  createdAt: string;
}

function toBoardResponse(board: BoardRow) {
  return {
    id: board.id,
    workspaceId: board.workspaceId,
    name: board.name,
    visibility: board.visibility,
    backgroundColorOrUrl: board.backgroundColorOrUrl,
    archivedAt: board.archivedAt,
    createdAt: board.createdAt,
  };
}

type BoardMemberRow = {
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'OBSERVER' | 'GUEST';
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

function toBoardMemberResponse(member: BoardMemberRow) {
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

export function toListResponse(list: ListRow) {
  return {
    id: list.id,
    boardId: list.boardId,
    name: list.name,
    position: list.position,
    isArchived: list.isArchived,
    createdAt: list.createdAt
  }
}

function sendNotFound(res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Board not found.',
    },
  });
}

function sendForbidden(res: Response): void {
  res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'You do not have permission to do this.',
    },
  });
}

type BoardContext = {
  board: BoardRow;
  workspaceRole: WorkspaceRole | null;
  boardRole: BoardMemberRole | null;
};

// Loads the board plus the user's roles for it, or null when the board is missing
// or the user may not see it. Sends no response, so routes that reach the board
// through another resource (e.g. /lists/:listId) can send their own 404.
export async function findAccessibleBoard(
  boardId: string,
  userId: string,
): Promise<BoardContext | null> {
  const board = await db.orm.public.Board.where({ id: boardId }).first();

  if (!board) {
    return null;
  }

  const workspaceMember = await db.orm.public.WorkspaceMember
    .where({ workspaceId: board.workspaceId, userId })
    .select('role')
    .first();
  const boardMember = await db.orm.public.BoardMember
    .where({ boardId: board.id, userId })
    .select('role')
    .first();

  const workspaceRole = workspaceMember?.role ?? null;
  const boardRole = boardMember?.role ?? null;

  if (!canAccessBoard({ workspaceRole, boardRole }, board)) {
    return null;
  }

  return { board, workspaceRole, boardRole };
}

// Same as findAccessibleBoard for /boards/:boardId routes, but sends the 404 itself.
// 404 rather than 403 so non-members can't learn that the board exists.
export async function loadAccessibleBoard(
  req: Request<BoardParams>,
  res: Response,
): Promise<BoardContext | null> {
  // requireAuth guarantees req.user
  const ctx = await findAccessibleBoard(req.params.boardId, req.user!.id);

  if (!ctx) {
    sendNotFound(res);
  }
  return ctx;
}

// Board admins manage their board; workspace admins can manage every board in the workspace.
export function isBoardAdmin({ workspaceRole, boardRole }: BoardContext): boolean {
  return boardRole === 'ADMIN' || workspaceRole === 'ADMIN';
}

/**
 * @route POST /workspaces/:workspaceId/boards
 * @description create a board in the workspace; the creator becomes its board ADMIN
 * @access workspace MEMBER or ADMIN (requireWorkspaceRole)
 */
export async function createBoard(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createBoardSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid board data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    // requireWorkspaceRole already rejected a missing workspaceId and non-members.
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    // Create the board and its ADMIN membership together.
    const board = await db.transaction(async (tx) => {
      const newBoard = await tx.orm.public.Board.create({
        workspaceId,
        name: parsed.data.name,
        visibility: parsed.data.visibility,
        backgroundColorOrUrl: parsed.data.backgroundColorOrUrl ?? null,
      });

      await tx.orm.public.BoardMember.create({
        boardId: newBoard.id,
        userId,
        role: 'ADMIN',
      });

      return newBoard;
    });

    res.status(201).json({
      data: { board: toBoardResponse(board) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route GET /workspaces/:workspaceId/boards
 * @description list the open (not archived) boards in a workspace that the user can see
 * @access workspace MEMBER or ADMIN (requireWorkspaceRole)
 */
export async function listBoards(
  req: Request<WorkspaceParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    const boards = await db.orm.public.Board
      .where({ workspaceId })
      .where((b) => b.archivedAt.isNull())
      .orderBy([(b) => b.createdAt.desc(), (b) => b.id.desc()])
      .all();

    const workspaceMember = await db.orm.public.WorkspaceMember
      .where({ workspaceId, userId })
      .select('role')
      .first();
    const workspaceRole = workspaceMember?.role ?? null;

    const boardIds = boards.map((b) => b.id);
    const boardMemberships = boardIds.length === 0
      ? []
      : await db.orm.public.BoardMember
        .where({ userId })
        .where((m) => m.boardId.in(boardIds))
        .select('boardId', 'role')
        .all();
    const boardRoles = new Map(boardMemberships.map((m) => [m.boardId, m.role]));

    // Same rule as GET /boards/:boardId, so a PRIVATE board never shows up for someone who can't open it.
    const visibleBoards = boards.filter((board) =>
      canAccessBoard({ workspaceRole, boardRole: boardRoles.get(board.id) ?? null }, board),
    );

    res.status(200).json({
      data: { boards: visibleBoards.map(toBoardResponse) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route GET /boards/:boardId
 * @description get a board
 * @access anyone canAccessBoard allows
 */
export async function getBoard(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    res.status(200).json({
      data: { board: toBoardResponse(ctx.board) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route PATCH /boards/:boardId
 * @description update a board's name, visibility or background
 * @access board ADMIN or workspace ADMIN
 */
export async function updateBoard(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    if (!isBoardAdmin(ctx)) {
      sendForbidden(res);
      return;
    }

    const parsed = updateBoardSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid board data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const board = await db.orm.public.Board
      .where({ id: ctx.board.id })
      .update(parsed.data);

    if (!board) {
      sendNotFound(res);
      return;
    }

    res.status(200).json({
      data: { board: toBoardResponse(board) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route POST /boards/:boardId/archive
 * @description archive a board (soft delete: sets archivedAt)
 * @access board ADMIN or workspace ADMIN
 */
export async function archiveBoard(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    if (!isBoardAdmin(ctx)) {
      sendForbidden(res);
      return;
    }

    // Archiving twice keeps the original timestamp.
    if (ctx.board.archivedAt) {
      res.status(200).json({
        data: { board: toBoardResponse(ctx.board) },
      });
      return;
    }

    const board = await db.orm.public.Board
      .where({ id: ctx.board.id })
      .update({ archivedAt: new Date().toISOString() });

    if (!board) {
      sendNotFound(res);
      return;
    }

    res.status(200).json({
      data: { board: toBoardResponse(board) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route DELETE /boards/:boardId
 * @description permanently delete an archived board and its memberships
 * @access board ADMIN or workspace ADMIN
 */
export async function deleteBoard(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    if (!isBoardAdmin(ctx)) {
      sendForbidden(res);
      return;
    }

    // Board lifecycle is OPEN -> ARCHIVED -> deleted, so an open board can't be deleted directly.
    if (!ctx.board.archivedAt) {
      res.status(409).json({
        error: {
          code: 'BOARD_NOT_ARCHIVED',
          message: 'Archive the board before deleting it.',
        },
      });
      return;
    }

    const boardId = ctx.board.id;

    // Members reference the board, so they go first.
    await db.transaction(async (tx) => {
      await tx.orm.public.BoardMember.where({ boardId }).deleteAll();
      await tx.orm.public.Board.where({ id: boardId }).delete();
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}


/**
 * @route GET /boards/:boardId/members
 * @description list the members of a board
 * @access anyone canAccessBoard allows
 */
export async function listBoardMembers(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    // Select only public user columns so passwordHash never leaves the database.
    const members = await db.orm.public.BoardMember
      .where({ boardId: ctx.board.id })
      .select('userId', 'role', 'joinedAt')
      .include('user', (user) =>
        user.select('id', 'username', 'email', 'fullName', 'avatarUrl'),
      )
      .orderBy([
        (m) => m.role.asc(),
        (m) => m.joinedAt.asc(),
      ])
      .all();

    res.status(200).json({
      data: { members: members.map(toBoardMemberResponse) },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * @route POST /boards/:boardId/members
 * @description add a member to a board
 * @access board ADMIN
 */

export async function addBoardMember(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if (!ctx) return;

    if (!isBoardAdmin(ctx)) {
      sendForbidden(res);
      return;
    }

    const parsed = addBoardMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid board member data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { email, role } = parsed.data;

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

    const workspaceMember = await db.orm.public.WorkspaceMember
      .where({ workspaceId: ctx.board.workspaceId, userId: user.id })
      .first();

    if (!workspaceMember && role !== 'GUEST') {
      res.status(422).json({
        error: {
          code: 'NOT_WORKSPACE_MEMBER',
          message: 'Users outside the workspace can only be added as GUEST.',
        },
      });
      return;
    }

    if (workspaceMember && role === 'GUEST') {
      res.status(422).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Workspace members cannot be added as GUEST.',
        },
      });
      return;
    }

    try {
      const member = await db.orm.public.BoardMember.create({
        boardId: ctx.board.id,
        userId: user.id,
        role,
      });

      res.status(201).json({
        data: { member: toBoardMemberResponse({ ...member, user }) },
      });
    } catch (error) {
      // The unique (boardId, userId) index rejects an existing member,
      // including two concurrent adds for the same user.
      if (isUniqueViolation(error)) {
        res.status(409).json({
          error: {
            code: 'ALREADY_MEMBER',
            message: 'User is already a member of this board.',
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
 * @route DELETE /boards/:boardId/members/:userId
 * @description remove a member from a board
 * @access board ADMIN
 */

export async function removeBoardMember(
  req: Request<BoardMemberParams>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);

    if(!ctx) {
      return;
    }
    const isSelf = req.params.userId === req.user?.id;
    if(!isBoardAdmin(ctx) && !isSelf) {
      sendForbidden(res);
      return;
    }

    const member = await db.orm.public.BoardMember
      .where({ boardId: ctx.board.id, userId: req.params.userId })
      .first();
    
    if(!member) {
      res.status(404).json({
        error: { code: 'MEMBER_NOT_FOUND', message: 'No such member.' },
      });
      return;
    }

    if(member.role === 'ADMIN') {
      // If he is the last admin
      const { adminCount } = await db.orm.public.BoardMember
        .where({ boardId: ctx.board.id, role: 'ADMIN' })
        .aggregate((agg) => ({ adminCount: agg.count() }));

      if(adminCount === 1) {
        res.status(409).json({
          error: {
            code: 'LAST_BOARD_ADMIN',
            message: 'You can not remove the last admin.',
          },
        });
        return;
      }
    }

    // Delete the member from the board
    await db.orm.public.BoardMember
      .where({ boardId: ctx.board.id, userId: req.params.userId })
      .delete();
    
    res.status(204).end()
  } catch (error) {
    next(error);
  }
}

export async function listLists(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction
) : Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);
    if(!ctx) {
      return;
    }
    // Sorted by rank; id breaks ties if two lists ever get the same position.
    const lists = await db.orm.public.List.where({
      boardId: ctx.board.id,
      isArchived: false
    }).orderBy([
      (l) => l.position.asc(),
      (l) => l.id.asc()
    ]).all()

    res.status(200).json({
      data: {
        lists: lists.map(toListResponse)
      }
    })
  }catch(error) {
    next(error);
  }
}

export async function createList(
  req: Request<BoardParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ctx = await loadAccessibleBoard(req, res);

    if(!ctx) {
      return;
    }

    if(!canEditBoardContent(ctx)) {
      sendForbidden(res);
      return;
    }

    const parsed = createListSchema.safeParse(req.body);

    if(!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid list data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const appendList = () => db.transaction(async (tx) => {
      // Archived lists count too, so un-archiving one can't land on the same rank.
      const last = await tx.orm.public.List
        .where({ boardId: ctx.board.id })
        .orderBy((l) => l.position.desc())
        .select('position')
        .first();

      return tx.orm.public.List.create({
        name: parsed.data.name,
        boardId: ctx.board.id,
        position: rankBetween(last?.position ?? null, null),
        isArchived: false,
      });
    });

    // Two concurrent creates can read the same last rank. The unique
    // (boardId, position) constraint rejects the second one, which then retries
    // and reads the new last rank.
    const MAX_ATTEMPTS = 5;
    let list;
    for (let attempt = 1; ; attempt++) {
      try {
        list = await appendList();
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === MAX_ATTEMPTS) throw error;
      }
    }

    res.status(201).json({
      data: {
        list: toListResponse(list)
      }
    });
  } catch (error) {
    next(error);
  }
}