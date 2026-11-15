export function moveItem<T extends {id : string}>(items: T[], from:number, to:number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to,0,moved);
  return {
    items: next,
    beforeId: next[to-1]?.id ?? null,
    afterId: next[to+1]?.id ?? null,
  }
}

/** What a column reports when a card is dropped. */
export type CardDrop = { cardId: string; toListId: string; newIndex: number };

/**
 * Neighbours of the slot a card was dropped into, read from the target list
 * as it was BEFORE the drop. Works for both same-list and cross-list moves:
 * removing the moved card first makes `newIndex` line up with the remaining cards.
 */
export function dropAnchors<T extends { id: string }>(targetItems: T[], movedId: string, newIndex: number) {
  const rest = targetItems.filter((item) => item.id !== movedId);
  return {
    beforeId: rest[newIndex - 1]?.id ?? null,
    afterId: rest[newIndex]?.id ?? null,
  };
}
