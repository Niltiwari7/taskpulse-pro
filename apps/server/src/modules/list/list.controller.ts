import type {Request, Response, NextFunction} from 'express';
import {db} from '../../prisma/db';
import {updateListSchema, moveListSchema} from '@taskpulse/shared-types';
import {findAccessibleBoard, toListResponse} from '../board/board.controller';
import {canEditBoardContent} from '../board/board.access';
import { isUniqueViolation } from '../../utils/isUniqueViolation';
import { rankBetween } from '../../shared/rank';


type ListParams = {
  listId: string
}

function sendListNotFound(res : Response) : void {
  res.status(404).json({
    error: {
      code : 'LIST_NOT_FOUND',
      message : 'No such list.'
    }
  })
}

function sendForbidden(res : Response) : void {
  res.status(403).json({
    error: {
      code : 'FORBIDDEN',
      message : 'You do not have permission to do this.'
    }
  })
}

// Loads a list the user may edit. Returns null once a response has been sent:
// 404 when the list is missing or its board is hidden from the user (the same
// body for both, so outsiders can't probe list ids), 403 when they can see the
// board but not edit it.
async function loadEditableList(req: Request<ListParams>, res: Response) {
  const list = await db.orm.public.List.where({ id: req.params.listId }).first();
  // requireAuth guarantees req.user
  const ctx = list && await findAccessibleBoard(list.boardId, req.user!.id);

  if (!list || !ctx) {
    sendListNotFound(res);
    return null;
  }

  if (!canEditBoardContent(ctx)) {
    sendForbidden(res);
    return null;
  }

  return list;
}

/**
 * @route PATCH /lists/:listId
 * @description rename a list
 * @access canEditBoardContent
 */
export async function updateList(
  req: Request<ListParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const list = await loadEditableList(req, res);
    if (!list) return;

    const parsed = updateListSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid list data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const updated = await db.orm.public.List
      .where({ id: list.id })
      .update({ name: parsed.data.name });

    // Deleted between the load and the update.
    if (!updated) {
      sendListNotFound(res);
      return;
    }

    res.status(200).json({
      data: {
        list: toListResponse(updated)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route DELETE /lists/:listId
 * @description archive a list (soft delete); its cards are left untouched
 * @access canEditBoardContent
 */
export async function archiveList(
  req: Request<ListParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const list = await loadEditableList(req, res);
    if (!list) return;

    // Already archived: nothing to write, still 204 (idempotent, like board archive).
    if (!list.isArchived) {
      const archived = await db.orm.public.List
        .where({ id: list.id })
        .update({ isArchived: true });

      // Deleted between the load and the update.
      if (!archived) {
        sendListNotFound(res);
        return;
      }
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/**
 * @route PATCH /lists/:listId/move
 * @description move a list between two neighbors; the server picks the rank
 * @access canEditBoardContent
 */
export async function moveList(
  req: Request<ListParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const list = await loadEditableList(req, res);
    if (!list) return;

    const parsed = moveListSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid list data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const { beforeId, afterId } = parsed.data;

    const moveOnce = () => db.transaction(async (tx) => {
      // null = no anchor on that side; undefined = anchor given but unusable.
      const loadAnchor = async (id: string | null) => {
        if (id === null) return null;
        const anchor = await tx.orm.public.List.where({ id }).first();
        const valid = anchor
          && anchor.boardId === list.boardId
          && !anchor.isArchived
          && anchor.id !== list.id;
        return valid ? anchor : undefined;
      };

      const before = await loadAnchor(beforeId);
      const after = await loadAnchor(afterId);

      if (before === undefined || after === undefined) return 'INVALID_ANCHOR' as const;
      if (before && after && before.position >= after.position) return 'INVALID_ANCHOR' as const;

      // Archived lists still hold their rank under the unique (boardId, position)
      // constraint, so the gap is measured against every other list on the board.
      let lo: string | null;
      let hi: string | null;
      if (before) {
        const loPos = before.position;
        lo = loPos;
        const nextList = await tx.orm.public.List
          .where({ boardId: list.boardId })
          .where((l) => l.position.gt(loPos))
          .where((l) => l.id.neq(list.id))
          .orderBy((l) => l.position.asc())
          .select('position')
          .first();
        hi = nextList?.position ?? null;
      } else {
        // The schema guarantees one anchor, so `after` is set here.
        const hiPos = after!.position;
        hi = hiPos;
        const prevList = await tx.orm.public.List
          .where({ boardId: list.boardId })
          .where((l) => l.position.lt(hiPos))
          .where((l) => l.id.neq(list.id))
          .orderBy((l) => l.position.desc())
          .select('position')
          .first();
        lo = prevList?.position ?? null;
      }

      return tx.orm.public.List
        .where({ id: list.id })
        .update({ position: rankBetween(lo, hi) });
    });

    // A concurrent move or create can take the same rank; the unique
    // (boardId, position) constraint rejects one, which retries with fresh neighbors.
    const MAX_ATTEMPTS = 5;
    let updated;
    for (let attempt = 1; ; attempt++) {
      try {
        updated = await moveOnce();
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === MAX_ATTEMPTS) throw error;
      }
    }

    if (updated === 'INVALID_ANCHOR') {
      res.status(400).json({
        error: {
          code: 'INVALID_ANCHOR',
          message: 'beforeId/afterId must be other active lists on the same board, in order.',
        },
      });
      return;
    }

    // Deleted between the load and the update.
    if (!updated) {
      sendListNotFound(res);
      return;
    }

    res.status(200).json({ data: { list: toListResponse(updated) } });
  } catch (error) {
    next(error);
  }
}
