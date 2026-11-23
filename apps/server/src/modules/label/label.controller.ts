import type { NextFunction, Request, Response } from 'express';
import { loadAccessibleBoard } from '../board/board.controller';
import { canEditBoardContent } from '../board/board.access';
import { db } from '../../prisma/db';
import { toLabelResponse } from './label.response';
import { createLabelSchema, updateLabelSchema } from '@taskpulse/shared-types';

type BoardLabelParams = { boardId: string };
type LabelParams = {boardId: string , labelId : string};

function sendForbidden(res: Response): void {
  res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'You do not have permission to do this.' },
  });
}

function sendLabelNotFound(res: Response): void {
  res.status(404).json({
    error: { code: 'LABEL_NOT_FOUND', message: 'No such label.' },
  });
}

// THE SHARED HELPER. Every /boards/:boardId/labels handler starts with this, so the
// access rules live in one place:
//   - board hidden from the user -> 404 (loadAccessibleBoard sends it)
//   - write route but user can't edit -> 403
// Returns null once a response has been sent; the handler must then just `return`.
// Reads pass { write: false }; create / update / delete pass { write: true }.
async function loadBoardForLabels(
  req: Request<BoardLabelParams>,
  res: Response,
  { write }: { write: boolean },
) {
  const ctx = await loadAccessibleBoard(req, res);
  if (!ctx) return null;

  if (write && !canEditBoardContent(ctx)) {
    sendForbidden(res);
    return null;
  }

  return ctx;
}

/**
 * @route GET /boards/:boardId/labels
 * @description list a board's labels, oldest first
 * @access anyone canAccessBoard allows
 */
export async function getBoardLabels(
  req: Request<BoardLabelParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ctx = await loadBoardForLabels(req, res, { write: false });
    if (!ctx) return;

    const labels = await db.orm.public.Label
      .where({ boardId: ctx.board.id })
      .orderBy([(l) => l.createdAt.asc(), (l) => l.id.asc()])
      .all();

    res.status(200).json({
      data: {
        labels: labels.map(toLabelResponse),
      },
    });
  } catch (error) {
    next(error);
  }
}


/**
 * @route POST /boards/:boardId/labels
 * @description create a label on a board
 * @access canEditBoardContent
 */
export async function createLabel(
  req: Request<BoardLabelParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ctx = await loadBoardForLabels(req, res, { write: true });
    if (!ctx) return;

    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid label data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const label = await db.orm.public.Label.create({
      boardId: ctx.board.id,
      name: parsed.data.name ?? null,
      color: parsed.data.color,
    });

    res.status(201).json({ data: { label: toLabelResponse(label) } });
  } catch (error) {
    next(error);
  }
}


/**
 * @route PATCH /boards/:boardId/labels/:labelId
 * @description update a label's name and/or color
 * @access canEditBoardContent
 */
export async function updateLabel(
  req: Request<LabelParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ctx = await loadBoardForLabels(req, res, { write: true });
    if (!ctx) return;

    const parsed = updateLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid label data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    // Scoped by board: a label id from another board is a plain 404.
    const updated = await db.orm.public.Label
      .where({ id: req.params.labelId, boardId: ctx.board.id })
      .update(parsed.data);

    if (!updated) {
      sendLabelNotFound(res);
      return;
    }

    res.status(200).json({ data: { label: toLabelResponse(updated) } });
  } catch (error) {
    next(error);
  }
}

/**
 * @route DELETE /boards/:boardId/labels/:labelId
 * @description delete a label and detach it from every card
 * @access canEditBoardContent
 */
export async function deleteLabel(
  req: Request<LabelParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ctx = await loadBoardForLabels(req, res, { write: true });
    if (!ctx) return;

    const { labelId } = req.params;

    const label = await db.orm.public.Label
      .where({ id: labelId, boardId: ctx.board.id })
      .first();

    if (!label) {
      sendLabelNotFound(res);
      return;
    }

    // CardLabel references the label, so the attachments go first.
    await db.transaction(async (tx) => {
      await tx.orm.public.CardLabel.where({ labelId }).deleteAll();
      await tx.orm.public.Label.where({ id: labelId }).delete();
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// Example of how a handler will use it (not wired up yet):
//   const ctx = await loadBoardForLabels(req, res, { write: true });
//   if (!ctx) return;
//   ... ctx.board.id is the board to scope every label query to ...
export { loadBoardForLabels };
