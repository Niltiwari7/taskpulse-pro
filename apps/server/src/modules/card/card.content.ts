import type { Tx } from '../../prisma/db';

// Deletes these cards, children first. Call inside the transaction that owns
// the delete. Card relations (CardMember, CardLabel, Comment, Checklist ->
// ChecklistItem, Attachment, CustomFieldValue, CardVote, Activity) must be
// cleaned up here once those features exist, or the card delete will hit
// their foreign keys.
export async function deleteCardContent(tx: Tx, cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  await tx.orm.public.Card.where((c) => c.id.in(cardIds)).deleteAll();
}
