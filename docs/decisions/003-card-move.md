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
| Case | Status | Code | Client does |
|------|--------|------|-------------|
| Malformed body | 400 | VALIDATION_ERROR | bug, show toast |
| Card/list missing or hidden | 404 | ... | ... |
| Can see board, can't edit | 403 | ... | ... |
| Target list on a different board | ? | ? | ? |
| Target list archived | ? | ? | ? |
| Anchor deleted/archived/moved | 409 | STALE_ANCHOR | rollback + refetch |
| Both anchors null but list not empty | ? | ? | ? |
| Two users move the same card | — | — | last write wins (until realtime) |

## Library
vue-draggable-plus (SortableJS).

## Out of scope
- Moving a card to another board (later phase).
- Realtime broadcast of moves (collaboration weeks).

