# Permissions

This file defines who is allowed to do what. It is the spec:

- `apps/server/tests/boardAccess.test.ts` follows the board visibility table.
- The board role × route test matrix follows the route tables.

If the code and this file disagree, one of them is wrong. Fix whichever is wrong, and change both in the same commit.

---

## 1. Rules that apply everywhere

1. **The server decides.** The UI hides buttons for convenience only. Every route checks permissions itself, every time.
2. **Roles come from the database, never from the request.** A body or query containing `role: "ADMIN"` grants nothing. For each request the server looks up who the user is, which workspace and board the resource belongs to, and what role the user has there.
3. **Workspace role and board role are independent.** A workspace ADMIN can be a plain MEMBER on a board, and a workspace MEMBER can be a board ADMIN. Never check a bare `role === 'ADMIN'` without knowing which of the two roles it is.
4. **Status codes:**

   | Situation | Status |
   |---|---|
   | Not logged in | `401 UNAUTHORIZED` |
   | Logged in, but not allowed to *see* the resource | `404 NOT_FOUND` |
   | Can see the resource, but not allowed to do *this action* | `403 FORBIDDEN` |

   We send 404 rather than 403 to someone who can't see a workspace or board, so outsiders can't find out that it exists.
5. **Permission checks run before input validation.** A user who isn't allowed gets 403/404 whatever the body contains. They never get a 400 that reveals which fields the route accepts.

---

## 2. Roles

### Workspace roles

| Role | Meaning |
|---|---|
| `ADMIN` | Manages the workspace, its members, and **every board in it** |
| `MEMBER` | Belongs to the workspace and can create boards and see WORKSPACE-visible boards |

A workspace always has at least one ADMIN. The creator becomes ADMIN when the workspace is created.

### Board roles

| Role | Meaning |
|---|---|
| `ADMIN` | Manages the board: settings, visibility, members, archive, delete |
| `MEMBER` | Works on the board's content (lists and cards, once those exist) |
| `OBSERVER` | Read-only on the board's content |
| `GUEST` | Not in the workspace. Can access **only** the boards they were explicitly added to |

A board always has at least one ADMIN. The creator becomes board ADMIN when the board is created.

### Guest rules

- A guest is a user with a `BoardMember` row and **no** `WorkspaceMember` row for that board's workspace. There is no separate guest user entity.
- A user outside the workspace can be added to a board **only** as `GUEST`. Any other role → `422 NOT_WORKSPACE_MEMBER`.
- A workspace member can **not** be added as `GUEST`. → `422 INVALID_ROLE`.
- A guest cannot list or create boards in the workspace, because they are not a workspace member.

### Who counts as a "board manager"

A user **manages a board** if they are board `ADMIN` **or** workspace `ADMIN` of the board's workspace. Every "board ADMIN" cell below means this combined rule.

---

## 3. Workspace routes

All routes are under `/api/v1` and require login. `ws ADMIN` and `ws MEMBER` mean the user's role in *that* workspace. "Outsider" means a logged-in user who isn't in the workspace.

| Route | Anonymous | Outsider | ws MEMBER | ws ADMIN |
|---|---|---|---|---|
| `POST /workspaces` | 401 | 201 | 201 | 201 |
| `GET /workspaces` (only your own) | 401 | 200 | 200 | 200 |
| `GET /workspaces/:id` | 401 | 404 | 200 | 200 |
| `PATCH /workspaces/:id` | 401 | 404 | 403 | 200 |
| `DELETE /workspaces/:id` | 401 | 404 | 403 | 204 |
| `GET /workspaces/:id/members` | 401 | 404 | 200 | 200 |
| `POST /workspaces/:id/members` | 401 | 404 | 403 | 201 |
| `PATCH /workspaces/:id/members/:userId` (change role) | 401 | 404 | 403 | 200 |
| `DELETE /workspaces/:id/members/:userId` | 401 | 404 | 403 | 204 |

Extra rules:

- Demoting or removing the **last** workspace ADMIN → `409 LAST_ADMIN`.
- Deleting a workspace also deletes its boards and all workspace and board memberships, in one transaction.

---

## 4. Board visibility: who can *see* a board

The single function `canAccessBoard(user, board)` in `apps/server/src/modules/board/board.access.ts` decides this. Every board route and the board list use it.

Rules, checked in order:

1. `PUBLIC` → everyone can see it.
2. Not logged in → no.
3. Has any board role (ADMIN / MEMBER / OBSERVER / GUEST) → yes, whatever the visibility.
4. `WORKSPACE` → yes if the user is in the board's workspace (any role).
5. `PRIVATE` → yes only for workspace ADMIN, so they can manage every board in their workspace.

Truth table. Each row is a user, each column a board visibility.

| User | PRIVATE | WORKSPACE | PUBLIC |
|---|---|---|---|
| Anonymous | ✗ | ✗ | ✓ |
| Logged in, outside the workspace, not on the board | ✗ | ✗ | ✓ |
| ws MEMBER, not on the board | ✗ | ✓ | ✓ |
| ws ADMIN, not on the board | ✓ | ✓ | ✓ |
| ws MEMBER + board MEMBER | ✓ | ✓ | ✓ |
| GUEST (board role only) | ✓ | ✓ | ✓ |
| ws MEMBER + board OBSERVER | ✓ | ✓ | ✓ |

`ORGANIZATION` visibility is not implemented. There is no organization above the workspace yet.

> **Note.** The anonymous row is what `canAccessBoard` returns. Every board route currently sits behind `requireAuth`, so an anonymous request gets **401** before visibility is checked. See [Open decisions](#7-open-decisions).

---

## 5. Board routes: role × route matrix

### Actors

| Actor | Workspace role | Board role |
|---|---|---|
| Anonymous | – | – |
| Outsider | none | none |
| ws MEMBER | MEMBER | none |
| ws ADMIN | ADMIN | none |
| board ADMIN | MEMBER | ADMIN |
| board MEMBER | MEMBER | MEMBER |
| OBSERVER | MEMBER | OBSERVER |
| GUEST | none | GUEST |

### Expected status on a `WORKSPACE`-visible board

| Route | Anon | Outsider | ws MEMBER | ws ADMIN | board ADMIN | board MEMBER | OBSERVER | GUEST |
|---|---|---|---|---|---|---|---|---|
| `GET /workspaces/:id/boards` | 401 | 404 | 200 | 200 | 200 | 200 | 200 | 404 |
| `POST /workspaces/:id/boards` | 401 | 404 | 201 | 201 | 201 | 201 | 201 | 404 |
| `GET /boards/:id` | 401 | 404 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /boards/:id` | 401 | 404 | 403 | 200 | 200 | 403 | 403 | 403 |
| `POST /boards/:id/archive` | 401 | 404 | 403 | 200 | 200 | 403 | 403 | 403 |
| `DELETE /boards/:id` ¹ | 401 | 404 | 403 | 204 | 204 | 403 | 403 | 403 |
| `GET /boards/:id/members` | 401 | 404 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /boards/:id/members` | 401 | 404 | 403 | 201 | 201 | 403 | 403 | 403 |
| `DELETE /boards/:id/members/:userId` (someone else) | 401 | 404 | 403 | 204 | 204 | 403 | 403 | 403 |
| `DELETE /boards/:id/members/:userId` (themselves) ² | 401 | 404 | 404 | 404 | 204 | 204 | 204 | 204 |

¹ On an **archived** board. Deleting an open board → `409 BOARD_NOT_ARCHIVED` for anyone allowed to delete, because a board goes OPEN → ARCHIVED → permanently deleted.
² Any board member may leave a board. A user who isn't on the board gets `404 MEMBER_NOT_FOUND`. Removing the **last** board ADMIN (yourself or someone else) → `409 LAST_BOARD_ADMIN`.

### What changes on other visibilities

Only the read-access cells change. Who may *change* the board stays the same.

- **`PRIVATE`:** a ws MEMBER who isn't on the board gets **404** on every `/boards/:id…` route, and the board is left out of `GET /workspaces/:id/boards`. Everyone else is unchanged.
- **`PUBLIC`:** an outsider gets **200** on `GET /boards/:id` and `GET /boards/:id/members`, and **403** (not 404) on every mutating board route, because they can now see the board. The exception is removing themselves: that stays `404 MEMBER_NOT_FOUND`, because they aren't on the board. Workspace-scoped routes stay 404 for them.

### Archived boards

- An archived board is hidden from `GET /workspaces/:id/boards`, but anyone who can see it can still open it with `GET /boards/:id`.
- Archiving an already archived board returns 200 and keeps the original `archivedAt`.

---

## 6. Board content

`canEditBoardContent(user)` in `apps/server/src/modules/board/board.access.ts` decides who may change lists and cards: board `ADMIN` / `MEMBER` / `GUEST`, or workspace `ADMIN`. It runs only after `canAccessBoard` has passed, so a "no" from it is a 403, never a 404.

### List routes

Same actors as [§5](#5-board-routes-role--route-matrix). Expected status on a `WORKSPACE`-visible board:

| Route | Anon | Outsider | ws MEMBER | ws ADMIN | board ADMIN | board MEMBER | OBSERVER | GUEST |
|---|---|---|---|---|---|---|---|---|
| `GET /boards/:id/lists` | 401 | 404 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /boards/:id/lists` | 401 | 404 | 403 ¹ | 201 | 201 | 201 | 403 | 201 |
| `PATCH /lists/:listId` (rename) ³ | 401 | 404 | 403 ¹ | 200 | 200 | 200 | 403 | 200 |
| `DELETE /boards/:id/lists/:listId` ² | 401 | 404 | 403 ¹ | 204 | 204 | 204 | 403 | 204 |

¹ A ws MEMBER who isn't on the board can see it but not change it. See [Open decisions](#7-open-decisions), item 4.
² "Delete" **archives** the list (`isArchived = true`). The row and its cards are kept. A `:listId` that isn't on board `:id` → `404`.
³ Addressed by list id alone; the server finds the board from the list. A list that doesn't exist and a list on a board the user can't see both get the same `404 LIST_NOT_FOUND`, so list ids can't be probed.

Other visibilities follow the same rule as boards: on `PRIVATE`, a ws MEMBER who isn't on the board gets **404** on every list route. On `PUBLIC`, an outsider gets **200** on `GET` and **403** on the write routes.

### Coming later

These rules don't have routes yet. Each week that adds a feature fills in its rows and adds the matching tests.

| Action | board ADMIN | board MEMBER | OBSERVER | GUEST |
|---|---|---|---|---|
| Read lists, cards, attachments; search; filter | ✓ | ✓ | ✓ | ✓ |
| Create / edit / move / delete lists and cards | ✓ | ✓ | ✗ | ✓ |
| Assign card members | ✓ | ✓ | ✗ | ✓ |
| Create labels and checklists, add attachments | ✓ | ✓ | ✗ | ✓ |
| Comment, vote | ✓ | ✓ | per board setting | ✓ |
| Change board settings, manage automation and Power-Ups | ✓ | ✗ | ✗ | ✗ |

Board settings (`allowComments`, `allowVoting`, `allowMemberInvites`, …) can narrow these rules further once they exist.

---

## 7. Open decisions

Settle these before the role-matrix tests are written. Then update the tables above and delete the item.

1. **Anonymous access to PUBLIC boards.** `canAccessBoard` allows it, but the routes return 401.
   Proposal: keep 401 until public share links are built, and say so in a comment on the PUBLIC branch of `canAccessBoard`.
2. **Member emails on PUBLIC boards.** Any logged-in outsider can call `GET /boards/:id/members` on a PUBLIC board and see every member's email.
   Proposal: return the member list without `email` to users who have no board role and aren't in the workspace.
3. **Leaving a workspace.** `DELETE /workspaces/:id/members/:userId` is ADMIN-only, so a ws MEMBER cannot remove themselves (403). On boards, any member can leave. Decide whether workspaces should allow leaving too.
4. **ws MEMBER who isn't on the board, editing content.** The §6 table only covers board roles. On a `WORKSPACE` board this user can see the board but has no board role.
   Proposal (implemented): read-only, so `403` on list and card writes, like `OBSERVER`. To edit, they join the board as `MEMBER`. This keeps board roles as the only source of content permissions besides workspace ADMIN.
