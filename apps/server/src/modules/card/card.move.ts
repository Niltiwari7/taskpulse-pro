import {db} from '../../prisma/db'
import { rankBetween } from '../../shared/rank'
import { retryOnUniqueViolation } from '../../utils/retryOnUniqueViolation'
import type { MoveCardInput } from '@taskpulse/shared-types'
import type { CardRow } from './card.response'

export type MoveCardFailure =
  'INVALID_ANCHOR' | 'LIST_NOT_FOUND' | 'LIST_ARCHIVED' | 'STALE_ANCHOR' | 'CARD_NOT_FOUND';

export type MoveCardResult =
  | { ok: true; card: CardRow }
  | { ok: false; reason: MoveCardFailure };

const fail = (reason: MoveCardFailure) => ({ ok: false, reason }) as const;


// Moves a card within its list or to another list on the same board
// The caller has already checked that the user can edit the card's board.

export async function moveCard(
  card: {id: string; list: {boardId : string}},
  {targetListId, beforeId, afterId}:MoveCardInput
): Promise<MoveCardResult> {
  if(beforeId === card.id || afterId === card.id) return fail("INVALID_ANCHOR");
  const moveOnce = () => db.transaction(async(tx) : Promise<MoveCardResult> => {
    //1. Target list: same board, not archived
    const target = await tx.orm.public.List.where({id: targetListId}).first();
    if(!target || target.boardId !== card.list.boardId) return fail("LIST_NOT_FOUND");
    if(target.isArchived) return fail("LIST_ARCHIVED");

    //2. Anchors: null = no anchor; undefined = given but gone / moved / archived.
    const loadAnchor = async( id : string | null) => {
      if(id === null) return null;
      const a = await tx.orm.public.Card.where({id}).first();
      return a && a.listId === target.id && !a.isArchived ? a : undefined;
    }

    const before = await loadAnchor(beforeId);
    const after = await loadAnchor(afterId);
    if(before === undefined || after === undefined) return fail("STALE_ANCHOR");
    if(before && after && before.position >= after.position) return fail("STALE_ANCHOR");

    // 3. lo/hi from the DB. Archived cards count (they hold ranks), self never does.
    let lo : string | null;
    let hi : string | null;

    if (before) {
      lo  = before.position;
      const next =await tx.orm.public.Card
      .where({listId : target.id})
      .where((c) => c.position.gt(lo!))
      .where((c) => c.id.neq(card.id))
      .orderBy((c) => c.position.asc())
      .select('position')
      .first()

      hi = next?.position ?? null;
    }else if (after) {
      hi = after.position;
      const prev = await tx.orm.public.Card
      .where({listId : target.id})
      .where((c) => c.position.lt(hi!))
      .where((c) => c.id.neq(card.id))
      .orderBy((c)=>c.position.desc())
      .select('position')
      .first()
      lo = prev?.position ?? null
    }else {
      // Empty list drop : verify it really has no active cards besides this one
      const someone = await tx.orm.public.Card
      .where({listId: target.id})
      .where((c)=>c.isArchived.eq(false))
      .where((c)=>c.id.neq(card.id))
      .select('id')
      .first()

      if(someone) return fail('STALE_ANCHOR');

      // Append after any archived cards so we don't cold with their rank
      const last = await tx.orm.public.Card
      .where({listId : target.id})
      .where((c) => c.id.neq(card.id))
      .orderBy((c)=>c.position.desc())
      .select('position')
      .first()

      lo = last?.position??null;
      hi = null;
    }

    // 4. One write : list and rank together
    const updated = await tx.orm.public.Card
    .where({id : card.id})
    .update({listId : target.id, position : rankBetween(lo,hi)});

    return updated ? {ok : true , card : updated} : fail('CARD_NOT_FOUND');
  })
  return retryOnUniqueViolation(moveOnce)
}