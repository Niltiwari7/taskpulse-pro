import type {Request, Response, NextFunction} from 'express'
import {db} from '../../prisma/db'
import { findAccessibleBoard } from '../board/board.controller'
import { canEditBoardContent } from '../board/board.access'
import { toCardResponse } from './card.response'
import { moveCardSchema, updateCardSchema } from '@taskpulse/shared-types'
import { deleteCardContent } from './card.content'
import { moveCard, MoveCardFailure } from './card.move'

type CardParams = {
   cardId: string
}

const moveStatus : Record<MoveCardFailure, number> = {
  INVALID_ANCHOR : 400,
  LIST_NOT_FOUND: 404,
  CARD_NOT_FOUND : 404,
  LIST_ARCHIVED: 409,
  STALE_ANCHOR : 409
}

const moveMessage: Record<MoveCardFailure, string> = {
  INVALID_ANCHOR: 'A card cannot be its own anchor.',
  LIST_NOT_FOUND: 'No such list.',
  CARD_NOT_FOUND: 'No card found.',
  LIST_ARCHIVED: 'List is archived.',
  STALE_ANCHOR: 'The board has changed. Refresh and try again.',
}

function sendCardNotFound(res: Response) : void {
  res.status(404).json({
    error: {
      code: 'CARD_NOT_FOUND',
      message:'No card found.'
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

// Loads a card the user may see (and edit, if `edit`). Returns null once a
// response has been sent: 404 for a missing card or a hidden board (same body),
// 403 when the board is visible but not editable.
async function loadCard(req:Request<CardParams>, res:Response, {edit}: {edit:boolean}) {
  const card = await db.orm.public.Card
    .where({id: req.params.cardId})
    .include('list', (l)=> l.select('id','boardId','isArchived'))
    .first()
  
  const ctx = card?.list && await findAccessibleBoard(card.list.boardId, req.user!.id)
  if(!card || !ctx) {
    sendCardNotFound(res);
    return null;
  }

  if(edit && !canEditBoardContent(ctx)) {
   sendForbidden(res);
   return null;
  }
  return card
     
}

/**
 * @route GET /cards/:cardId
 * @description get a card
 * @access anyone canAccessBoard allows
 */
export async function getCard(
  req: Request<CardParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await loadCard(req, res, { edit: false });
    if (!card) return;

    res.status(200).json({
      data: { card: toCardResponse(card) }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @route PATCH /cards/:cardId
 * @description update a card
 * @access canEditBoardContent
 */
export async function updateCard(
  req: Request<CardParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await loadCard(req, res, { edit: true });
    if (!card) return;
    const parsed = updateCardSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid card data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const updated = await db.orm.public.Card
      .where({ id: card.id })
      .update(parsed.data);

    if (!updated) {
      sendCardNotFound(res);
      return;
    }

    res.status(200).json({ data: { card: toCardResponse(updated) } });

  } catch (error) {
    next(error);
  }
}

/**
 * @route POST /cards/:cardId/archive
 * @description archive a card (soft delete)
 * @access canEditBoardContent
 */
export async function archiveCard(
  req: Request<CardParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await loadCard(req, res, { edit: true });
    if (!card) return;

    // Already archived: nothing to write (idempotent).
    if (card.isArchived) {
      res.status(200).json({ data: { card: toCardResponse(card) } });
      return;
    }

    const archived = await db.orm.public.Card
      .where({ id: card.id })
      .update({ isArchived: true });

    // Deleted between the load and the update.
    if (!archived) {
      sendCardNotFound(res);
      return;
    }

    res.status(200).json({ data: { card: toCardResponse(archived) } });
  } catch (error) {
    next(error);
  }
}

/**
 * @route DELETE /cards/:cardId
 * @description permanently delete an archived card and its children
 * @access canEditBoardContent
 */
export async function deleteCard(
  req:Request<CardParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const card = await loadCard(req,res,{edit:true});
    if(!card) {
      return;
    }

    // Card lifecycle is OPEN -> ARCHIVED -> deleted
    if(!card.isArchived){
      res.status(409).json({
        error: {
          code:'CARD_NOT_ARCHIVED',
          message:'Archive the card before deleting it.'
        }
      })
      return;
    }

    await db.transaction((tx) => deleteCardContent(tx, [card.id]));

    res.status(204).end();
  } catch (error) {
    next(error)
  }
}

/**
 * @route PATCH /cards/:cardId/move
 * @description move the card in the list or across the list.
 * @access canEditBoardContent
 */

export async function moveCardHandler(req: Request<CardParams>, res: Response, next: NextFunction) {
  try {
    const card = await loadCard(req, res, { edit: true });
    if (!card) return;
    // loadCard types list as nullable; every card has one, but the type needs proof.
    if (!card.list) {
      sendCardNotFound(res);
      return;
    }

    if (card.isArchived) {
      res.status(409).json({
        error: {
          code: 'CARD_ARCHIVED',
          message: 'Archived cards cannot be moved.',
        },
      });
      return;
    }

    const parsed = moveCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid move data.',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const result = await moveCard({ id: card.id, list: card.list }, parsed.data);
    if (!result.ok) {
      res.status(moveStatus[result.reason]).json({
        error: { code: result.reason, message: moveMessage[result.reason] },
      });
      return;
    }
    res.status(200).json({ data: { card: toCardResponse(result.card) } });
  } catch (error) { next(error); }
}
