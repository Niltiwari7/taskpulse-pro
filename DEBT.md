# Technical debt

One row per item. Clear one when it's cheap; write it down when it isn't.

## Open

| Item | Why it's debt | Cost to fix | Added |
|---|---|---|---|
| Cards have no owner (`creatorId`) | Any user who can edit board content, including a GUEST, can delete any card. Per-card rules ("only delete your own") are impossible. | Migration, rule in `canEditBoardContent` callers, tests, permissions doc. ~1–2 days | 2026-11-10 |
| `deleteCardContent` only deletes the card row | Comments, checklists, attachments, etc. will hit foreign keys once those features exist ([card.content.ts](apps/server/src/modules/card/card.content.ts)). | Extend per feature, each week | 2026-11-10 |
| Peer-dependency warnings on install | Prisma's packages declare vitest 4.x and typescript 5.x ranges; we use 5.x and 6.x. | Wait for upstream or pin | 2026-11-10 |
| Sanitizer tests pinned to jsdom 26 | jsdom 31 needs a newer Node than local v20. | Move to Node 24 locally, then bump | 2026-11-10 |

## Cleared

| Item | Cleared |
|---|---|
| `docs/permissions.md` had no card-route table, so card permissions had no written spec to test against. Added the table. | 2026-11-10 |
