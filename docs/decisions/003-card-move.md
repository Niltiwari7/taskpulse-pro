# 003 — Card move contract

Status: Accepted · Date: 2026-11-16

## Context
cards need reordering within and across lists; ranks are
fractional strings (see fractional.md); the client's view can be stale.>

## Endpoint
PATCH /api/v1/cards/:cardId/move
Permission:  same as moveList → canEditBoardContent

## Request
{ targetListId: string, beforeId: string | null, afterId: string | null }
- beforeId = card directly ABOVE the drop slot; afterId = directly BELOW.
- Both null = drop into an empty list.
- <what about beforeId === afterId? cardId used as its own anchor?>

## Server algorithm (one transaction)
1. Load card + target list; both must be on the same board, and the user must be able to edit it.
2. Validate anchors: exist, not archived, belong to targetListId, aren't the card itself.
3. Compute lo/hi from the DB (anchor on beforeId, query the next neighbour,
   including archived cards because they keep their rank).
4. Update listId + position = rankBetween(lo, hi).
5. Wrap in retryOnUniqueViolation.

## Response
200 { data: { card } }  ← full card with its new position and listId

## Errors and conflicts
### Card Move API – Error Handling

The `moveCard` API validates the target list and anchor positions before moving a card.

The following error cases define the expected API behavior:

| Case | HTTP Status | Error Code | Description |
|---|---:|---|---|
| `beforeId === afterId` | 400 | `VALIDATION_ERROR` | Both anchors cannot reference the same card. Validated using Zod `.refine()`, consistent with `moveListSchema`. |
| Anchor is the card itself | 400 | `INVALID_ANCHOR` | A card cannot be used as its own positioning anchor. This indicates a client-side bug. |
| Target list belongs to another board | 404 | `LIST_NOT_FOUND` | Return the same response as a missing list to prevent unauthorized users from probing list IDs. Follow the `loadEditableList` security rule. |
| Target list is archived | 409 | `LIST_ARCHIVED` | Archived lists cannot receive cards. Consistent with `createCard`. |
| Card itself is archived | 409 | `CARD_ARCHIVED` | Archived cards cannot be moved. |
| Anchor is missing, archived, belongs to another list, or has an incorrect order | 409 | `STALE_ANCHOR` | The board state has changed since the client fetched it. The client should refetch the list and retry. |
| Both anchors are `null`, but the target list contains active cards | 409 | `STALE_ANCHOR` | The client assumes the target list is empty, but active cards already exist. |

#### Error Handling Rules

1. **400 – Bad Request**
   - Used for invalid requests and client-side validation errors.
   - Examples: identical anchors or using the card itself as an anchor.

2. **404 – Not Found**
   - Used when the target list does not exist or belongs to another board.
   - Do not expose whether a list exists on another board.

3. **409 – Conflict**
   - Used when the requested operation conflicts with the current board state.
   - Examples: archived cards/lists or stale anchor references.

#### Client Retry Behavior

When the API returns `STALE_ANCHOR`:

1. Fetch the latest target list and its active cards.
2. Recalculate `beforeId` and `afterId`.
3. Submit the move request again using the updated anchors.

Do not automatically retry `INVALID_ANCHOR`, `LIST_ARCHIVED`, or `CARD_ARCHIVED` without correcting the underlying issue.

## Library
vue-draggable-plus (SortableJS).

## Out of scope
- Moving a card to another board (later phase).
- Realtime broadcast of moves (collaboration weeks).

