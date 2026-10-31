import type {Request, Response, NextFunction} from 'express';
import {db} from '../../prisma/db';
import {updateListSchema} from '@taskpulse/shared-types';
import {findAccessibleBoard, toListResponse} from '../board/board.controller';
import {canEditBoardContent} from '../board/board.access';


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
