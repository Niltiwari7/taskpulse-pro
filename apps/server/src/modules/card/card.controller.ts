import type {Request, Response, NextFunction} from 'express'
import {db} from '../../prisma/db'
import { findAccessibleBoard } from '../board/board.controller'
import { canEditBoardContent } from '../board/board.access'
import { toCardResponse } from './card.response'
import { updateCardSchema } from '@taskpulse/shared-types'
import { deleteCardContent } from './card.content'

type CardParams = {
   cardId: string
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