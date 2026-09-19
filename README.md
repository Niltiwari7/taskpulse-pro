# Trello Clone — Project Specification

A full-stack project-management application inspired by Trello.

The goal of this project is to build a production-style collaborative task management platform with:

* Workspaces
* Boards
* Lists
* Cards
* Members
* Guests
* Board administrators
* Workspace administrators
* Permissions
* Comments
* Checklists
* Labels
* Attachments
* Notifications
* Drag-and-drop
* Automation
* Power-Ups / integrations

The project is designed and developed as a **solo-developer project**, therefore features are divided into incremental phases.

---

# 1. Project Goals

## Primary Goal

Build a collaborative Kanban/project-management application where users can:

1. Create a workspace.
2. Invite members.
3. Create multiple boards.
4. Organize work using lists and cards.
5. Collaborate with other users.
6. Control board and workspace permissions.
7. Track activity and notifications.
8. Automate repetitive tasks.
9. Eventually support integrations through a Power-Up architecture.

## Non-Goals

The first version will NOT attempt to reproduce every Trello feature.

Avoid implementing these initially:

* Complex enterprise billing
* Advanced analytics
* AI features
* Dozens of third-party integrations
* Real-time video/audio
* Enterprise SSO
* Complex workflow engines
* Mobile applications
* Advanced automation DSL

These can be added later.

---

# 2. Technology Stack

## Frontend

### Vue 3

Use Vue 3 with Composition API.

Recommended structure:

```text
Vue 3
├── Vue Router
├── Pinia
├── shadcn-vue
├── Tailwind CSS
├── TanStack Query
├── VeeValidate
├── Zod
└── Axios / fetch
```

### Why?

Vue handles:

* Component architecture
* UI state
* Routing
* Forms
* Drag-and-drop UI
* Modal/dialog systems

---

# 3. Backend

Use TypeScript.

Recommended stack:

```text
Node.js
├── TypeScript
├──  Express
├── PostgreSQL
├── Prisma
├── Zod
├── JWT / session authentication
├── WebSocket / Socket.IO
└── Object storage
```


The backend should follow a modular architecture rather than putting everything into controllers.

---

# 4. Database

Use:

**PostgreSQL**

This application is highly relational.

For example:

```text
User
  ↓
Workspace
  ↓
Board
  ↓
List
  ↓
Card
```

And:

```text
Card
 ├── Members
 ├── Labels
 ├── Checklists
 ├── Comments
 ├── Attachments
 ├── Activity
 └── Notifications
```

A relational database is therefore a better fit than MongoDB for the core domain.

---

# 5. High-Level Architecture

```text
                   ┌─────────────────────┐
                   │      Vue 3 App      │
                   │                     │
                   │ shadcn-vue          │
                   │ Pinia               │
                   │ TanStack Query      │
                   └──────────┬──────────┘
                              │
                         HTTPS / WS
                              │
                   ┌──────────▼──────────┐
                   │    TypeScript API   │
                   │                     │
                   │ Auth                │
                   │ Workspace           │
                   │ Board               │
                   │ List                │
                   │ Card                │
                   │ Comment             │
                   │ Notification        │
                   │ Automation           │
                   └──────────┬──────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
          ┌──────▼─────┐ ┌────▼────┐ ┌────▼────────┐
          │ PostgreSQL │ │ Storage │ │ WebSocket   │
          │            │ │         │ │             │
          │ Prisma     │ │ Files   │ │ Realtime    │
          └────────────┘ └─────────┘ └─────────────┘
```

---

# 6. Core Domain Model

The most important architectural decision is the domain model.

## User

```text
User
-----
id
name
email
passwordHash
avatarUrl
createdAt
updatedAt
```

---

# 7. Workspace

A workspace contains multiple users and boards.

```text
Workspace
---------
id
name
description
createdBy
createdAt
updatedAt
```

Relationship:

```text
Workspace
   │
   ├── Members
   │
   └── Boards
```

---

# 8. Workspace Membership

Do NOT put `workspaceId` directly on User.

A user can belong to multiple workspaces.

```text
WorkspaceMember
---------------
id
workspaceId
userId
role
joinedAt
```

Roles:

```text
MEMBER
ADMIN
```

Potential future role:

```text
OWNER
```

---

# 9. Board

A workspace can contain multiple boards.

```text
Board
-----
id
workspaceId
name
description
visibility
background
status
createdBy
createdAt
updatedAt
```

Visibility:

```text
PRIVATE
WORKSPACE
ORGANIZATION
PUBLIC
```

Status:

```text
OPEN
ARCHIVED
```

---

# 10. Board Membership

A user can have different permissions on different boards.

```text
BoardMember
-----------
id
boardId
userId
role
joinedAt
```

Roles:

```text
ADMIN
MEMBER
OBSERVER
```

A guest can be represented through board membership plus workspace membership status.

---

# 11. Guest Model

A guest is a user who has access to a board but is not a workspace member.

Example:

```text
User
 │
 └── BoardMember
       │
       └── Board
```

The important authorization rule is:

```text
Workspace Member
    ↓
Can potentially access workspace boards

Guest
    ↓
Can access only explicitly assigned boards
```

Do not create a completely separate "GuestUser" entity unless there is a strong reason.

---

# 12. Lists

```text
List
----
id
boardId
name
position
createdAt
updatedAt
```

Example:

```text
Todo
In Progress
Code Review
Done
```

The `position` field is important.

Avoid relying only on integer positions:

```text
1
2
3
4
```

because moving cards repeatedly causes expensive updates.

Consider fractional ordering or LexoRank-style ordering.

Example:

```text
a
m
z
```

Move between:

```text
a
m
```

and assign:

```text
g
```

This minimizes database updates.

---

# 13. Cards

```text
Card
----
id
listId
title
description
position
cover
dueDate
startDate
status
createdBy
createdAt
updatedAt
```

Card status:

```text
OPEN
ARCHIVED
```

---

# 14. Card Members

Many users can be assigned to a card.

```text
CardMember
----------
cardId
userId
assignedAt
```

Relationship:

```text
Card
 ├── User A
 ├── User B
 └── User C
```

---

# 15. Labels

```text
Label
-----
id
boardId
name
color
createdAt
```

Many labels can belong to a card.

```text
CardLabel
---------
cardId
labelId
```

---

# 16. Checklists

```text
Checklist
---------
id
cardId
name
position
```

```text
ChecklistItem
-------------
id
checklistId
content
isCompleted
position
assignedUserId
dueDate
```

---

# 17. Comments

```text
Comment
-------
id
cardId
userId
content
createdAt
updatedAt
deletedAt
```

Use soft deletion for comments.

Example:

```text
deletedAt != null
```

instead of permanently deleting the row.

---

# 18. Attachments

```text
Attachment
----------
id
cardId
uploadedBy
fileName
fileSize
mimeType
storageKey
createdAt
```

Do NOT store the actual file inside PostgreSQL.

Store:

```text
PostgreSQL
    ↓
metadata

Object Storage
    ↓
actual file
```

For a zero-cost project, initially support local development storage.

Later use an object-storage provider with a free tier.

---

# 19. Activity System

Every important action should generate an activity record.

Example:

```text
Activity
--------
id
boardId
cardId
userId
type
metadata
createdAt
```

Examples:

```text
CARD_CREATED
CARD_MOVED
CARD_UPDATED
CARD_MEMBER_ADDED
COMMENT_CREATED
LIST_CREATED
BOARD_MEMBER_ADDED
BOARD_SETTINGS_CHANGED
```

Example metadata:

```json
{
  "fromList": "Todo",
  "toList": "In Progress"
}
```

This gives you an audit trail.

---

# 20. Notifications

Create a notification system early.

```text
Notification
------------
id
userId
type
actorId
entityType
entityId
message
isRead
createdAt
```

Examples:

```text
You were assigned to CARD-123.

John mentioned you in a comment.

Your card is due tomorrow.

Sarah moved your card to Done.
```

---

# 21. Permissions Architecture

Do NOT implement permission checks directly inside Vue.

Frontend permissions are only for UI.

The backend must always enforce authorization.

Correct architecture:

```text
Request
   ↓
Authentication
   ↓
Authorization
   ↓
Business Logic
   ↓
Database
```

Example:

```text
PATCH /boards/:boardId

        ↓

authenticateUser()

        ↓

requireBoardAdmin()

        ↓

updateBoard()
```

---

# 22. Permission Matrix

## Workspace Admin

```text
Manage workspace
Invite members
Remove members
Promote member
Demote admin
Manage workspace settings
Manage workspace boards
```

## Board Admin

```text
Manage board members
Invite guests
Remove members
Promote board admin
Change visibility
Change board settings
Archive board
Delete board
Manage Power-Ups
Manage automation
```

## Normal Member

```text
Create cards
Edit cards
Move cards
Create lists
Edit lists
Comment
Mention users
Assign members
Create labels
Create checklists
Add attachments
Watch cards
Vote
```

## Observer

```text
Read board
Read cards
Read lists
Search
Filter
Download attachments

Optional:
Comment
Vote
```

No:

```text
Create
Edit
Move
Delete
Assign
```

---

# 23. Important Permission Rule

Never trust:

```text
role: ADMIN
```

sent by the frontend.

Bad:

```http
PATCH /boards/123

{
  "role": "ADMIN"
}
```

The backend must determine:

```text
Who is making this request?

What workspace do they belong to?

What board are they accessing?

What is their role?

Is this operation allowed?
```

---

# 24. Board Settings

Board settings:

```text
BoardSettings
-------------
boardId

allowComments
allowVoting
allowMemberInvites
allowObservers

allowBackgroundCustomization
allowCovers

visibility
```

Avoid putting every setting directly into the Board table.

---

# 25. Card Features

The card should support:

```text
Title
Description
Markdown
Cover
Members
Labels
Checklists
Start Date
Due Date
Reminders
Attachments
Comments
Activity
Watch
Votes
Reactions
Custom Fields
```

---

# 26. Drag and Drop

Drag-and-drop is one of the core features.

Supported operations:

```text
Move card within list

Move card between lists

Reorder lists

Move card to another board
```

Frontend:

```text
Drag Start
    ↓
Drag Over
    ↓
Drop
    ↓
Optimistic UI update
    ↓
API request
    ↓
Server validates
    ↓
Database update
```

Use optimistic updates carefully.

If the API fails:

```text
Rollback UI
Show error
```

---

# 27. Real-Time Collaboration

Eventually users should see:

```text
Someone moved a card.

Someone added a comment.

Someone joined the board.

Someone changed the card title.
```

Use WebSockets.

Example:

```text
Client A
   │
   │ move card
   ▼
Backend
   │
   ├── PostgreSQL
   │
   └── WebSocket
          │
          ├── Client B
          └── Client C
```

Events:

```text
card.created
card.updated
card.moved
card.deleted

comment.created

list.created
list.updated

member.added
member.removed
```

Do not build real-time functionality on Day 1.

Build the normal REST API first.

---

# 28. Search and Filtering

Board search should support:

```text
Text
Member
Label
Due date
List
Status
```

Example:

```text
Search:
"payment"

Filters:
Member = John
Label = Bug
Due = This Week
```

Start with PostgreSQL queries.

Do not introduce Elasticsearch/OpenSearch.

You don't need it for this project.

---

# 29. Automation

Automation should eventually support:

```text
Trigger
    ↓
Condition
    ↓
Action
```

Example:

```text
WHEN
card moves to Done

THEN
mark due date complete
```

Another:

```text
WHEN
card is created

THEN
add "New" label
assign user
```

Domain model:

```text
AutomationRule
--------------
id
boardId
name
trigger
conditions
actions
enabled
createdBy
```

Initially support only a few triggers.

Example:

```text
CARD_CREATED
CARD_MOVED
CARD_DUE_DATE_REACHED
CARD_COMPLETED
```

Actions:

```text
MOVE_CARD
ADD_LABEL
REMOVE_LABEL
ASSIGN_MEMBER
ADD_CHECKLIST
SET_DUE_DATE
```

---

# 30. Power-Up Architecture

Do not hard-code integrations into cards.

Instead define:

```text
PowerUp
-------
id
name
key
description
enabled
configuration
```

Example:

```text
GitHub
Google Drive
Jira
Slack
```

Eventually:

```text
PowerUp Interface
        ↓
GitHubPowerUp
GoogleDrivePowerUp
JiraPowerUp
```

This keeps integrations isolated.

---

# 31. API Structure

Recommended API:

```text
/api/v1/auth

/api/v1/users

/api/v1/workspaces

/api/v1/workspaces/:workspaceId/members

/api/v1/boards

/api/v1/boards/:boardId

/api/v1/boards/:boardId/members

/api/v1/boards/:boardId/lists

/api/v1/boards/:boardId/cards

/api/v1/cards/:cardId

/api/v1/cards/:cardId/comments

/api/v1/cards/:cardId/checklists

/api/v1/cards/:cardId/attachments

/api/v1/cards/:cardId/members

/api/v1/notifications

/api/v1/automations
```

---

# 32. Backend Folder Structure

```text
server/
│
├── src/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── workspaces/
│   │   ├── boards/
│   │   ├── lists/
│   │   ├── cards/
│   │   ├── comments/
│   │   ├── checklists/
│   │   ├── labels/
│   │   ├── attachments/
│   │   ├── notifications/
│   │   ├── automations/
│   │   └── powerups/
│   │
│   ├── middleware/
│   ├── guards/
│   ├── database/
│   ├── websocket/
│   ├── shared/
│   └── app.ts
│
├── prisma/
│   └── schema.prisma
│
├── tests/
│
├── package.json
└── tsconfig.json
```

---

# 33. Frontend Folder Structure

```text
client/
│
├── src/
│   │
│   ├── components/
│   │
│   ├── layouts/
│   │
│   ├── pages/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── workspace/
│   │   ├── board/
│   │   ├── card/
│   │   ├── comments/
│   │   ├── notifications/
│   │   └── settings/
│   │
│   ├── stores/
│   ├── composables/
│   ├── services/
│   ├── router/
│   ├── types/
│   └── utils/
│
└── main.ts
```

Prefer feature-based organization over putting every component into one giant `components/` directory.

---

# 34. Recommended Frontend State Strategy

Do not put everything into Pinia.

Use:

### Pinia

For global client state:

```text
Auth
User
UI preferences
Workspace selection
```

### TanStack Query

For server state:

```text
Boards
Lists
Cards
Comments
Members
Notifications
```

This separation will prevent your Pinia stores from becoming huge.

---

# 35. Authentication

Initial authentication:

```text
Email
Password
```

Later:

```text
Google OAuth
GitHub OAuth
```

Password must be hashed.

Never store:

```text
password
```

Use:

```text
passwordHash
```

Recommended:

```text
Argon2
```

or another modern password hashing algorithm.

---

# 36. Security Requirements

Security should be part of the architecture from the beginning.

Implement:

```text
Password hashing
Authentication
Authorization
Input validation
Rate limiting
CORS
CSRF protection where applicable
Secure cookies
Security headers
File upload validation
File size limits
SQL injection protection
XSS protection
Audit logging
```

Never trust:

```text
userId
workspaceId
boardId
role
```

from the frontend.

---

# 37. API Validation

Every API input should be validated.

Example:

```text
POST /cards

{
  "title": "Fix login bug"
}
```

Validate:

```text
title exists
title length <= allowed limit
listId exists
user has permission
board exists
```

Use Zod or equivalent validation.

---

# 38. Database Transactions

Use database transactions for operations that change multiple records.

Example:

```text
Delete Board

BEGIN TRANSACTION

delete board members
delete lists
delete cards
delete comments
delete labels
delete board
create activity

COMMIT
```

If something fails:

```text
ROLLBACK
```

---

# 39. Soft Delete vs Hard Delete

Use soft deletion where recovery/audit history matters.

Examples:

```text
Comments
Users
Workspace members
Cards
```

Use hard deletion for data that should truly disappear.

For boards, initially:

```text
OPEN
 ↓
ARCHIVED
 ↓
PERMANENT DELETE
```

---

# 40. Error Handling

Standard API response:

```json
{
  "success": false,
  "error": {
    "code": "BOARD_ACCESS_DENIED",
    "message": "You do not have permission to access this board."
  }
}
```

Use consistent error codes.

Examples:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

# 41. Testing Strategy

As a solo developer, don't try to achieve 100% coverage.

Focus on high-value tests.

## Unit Tests

Test:

```text
Permission logic
Position calculation
Automation engine
Validation
Business rules
```

## Integration Tests

Test:

```text
Authentication
Board creation
Card creation
Member management
Permissions
```

## E2E Tests

Use Playwright.

Critical flows:

```text
Register
Login

Create workspace

Create board

Create list

Create card

Move card

Add member

Assign card

Comment

Change board settings

Archive board
```

---

# 42. Audit Log

Admin operations should be auditable.

Example:

```text
John promoted Sarah to Board Admin.

Sarah changed board visibility from PRIVATE to PUBLIC.

John removed David from the board.
```

Model:

```text
AuditLog
--------
id
actorId
workspaceId
boardId
action
entityType
entityId
metadata
createdAt
```

This becomes extremely useful for debugging and security.

---

# 43. Important Missing Features

Your original specification is strong, but I would add these features.

## Authentication

```text
Register
Login
Logout
Password reset
Email verification
Session management
```

## Workspace

```text
Workspace creation
Workspace settings
Workspace deletion
Workspace member invitations
Workspace member roles
```

## Board

```text
Board creation
Board cloning
Board archive
Board restore
Board deletion
Board activity
Board search
```

## Card

```text
Card duplication
Card archive
Card restore
Card deep link
Card activity
```

## Collaboration

```text
Mentions
Notifications
Watch
Activity feed
Real-time updates
```

## Reliability

```text
Undo where appropriate
Optimistic updates
Conflict handling
Error recovery
```

---

# 44. MVP Definition

Do NOT build everything initially.

Your first usable product should contain:

```text
Authentication
      ↓
Workspace
      ↓
Board
      ↓
Lists
      ↓
Cards
      ↓
Drag & Drop
      ↓
Members
      ↓
Permissions
      ↓
Comments
      ↓
Labels
      ↓
Checklists
```

This is your MVP.

---

# 45. MVP User Flow

A user should be able to:

```text
Register
   ↓
Login
   ↓
Create Workspace
   ↓
Create Board
   ↓
Create List
   ↓
Create Card
   ↓
Drag Card
   ↓
Open Card
   ↓
Add Description
   ↓
Add Checklist
   ↓
Add Label
   ↓
Assign Member
   ↓
Comment
   ↓
Invite another user
```

If this flow works reliably, you already have a meaningful product.

---

# 46. Development Roadmap

Because this is a solo project, work in vertical slices.

Do NOT spend 3 weeks building backend first and then start frontend.

Build:

```text
Feature
Backend
+
Database
+
Frontend
+
Tests
```

before moving to the next feature.

---

# Phase 0 — Foundation

Estimated effort: 2–3 days

```text
Repository setup
Frontend setup
Backend setup
PostgreSQL
Prisma
Docker Compose
Environment variables
Linting
Formatting
Git hooks
CI
```

Repository:

```text
trello-clone/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── shared/
│
├── docker-compose.yml
├── package.json
└── README.md
```

Use a monorepo.

---

# Phase 1 — Authentication

Estimated effort: 3–5 days

Build:

```text
Register
Login
Logout
Current user
Password hashing
Authentication middleware
```

Frontend:

```text
Login page
Register page
Protected routes
User menu
```

---

# Phase 2 — Workspace

Estimated effort: 3–4 days

Build:

```text
Create workspace
Rename workspace
Delete workspace
Workspace members
Invite member
Remove member
Workspace roles
```

---

# Phase 3 — Boards

Estimated effort: 3–5 days

Build:

```text
Create board
Rename board
Archive board
Delete board
Board visibility
Board members
Board admins
```

---

# Phase 4 — Lists

Estimated effort: 2–3 days

Build:

```text
Create list
Rename list
Delete list
Reorder list
```

---

# Phase 5 — Cards

Estimated effort: 5–7 days

Build:

```text
Create card
Edit card
Delete card
Archive card
Move card
Reorder card
Card modal
Description
```

This is one of the most important phases.

---

# Phase 6 — Drag & Drop

Estimated effort: 3–5 days

Support:

```text
Card → same list

Card → another list

List → reorder

Optimistic updates
Rollback
```

Test heavily.

---

# Phase 7 — Collaboration

Estimated effort: 5–7 days

Build:

```text
Assign members
Labels
Comments
Mentions
Checklists
Due dates
Attachments
Watch
Activity
```

---

# Phase 8 — Permissions

Estimated effort: 4–6 days

Implement:

```text
Workspace Admin
Board Admin
Member
Observer
Guest
```

Create a central authorization service.

Example:

```text
can(user, action, resource)
```

Examples:

```text
can(user, "BOARD_UPDATE", board)

can(user, "CARD_DELETE", card)

can(user, "MEMBER_INVITE", board)
```

---

# Phase 9 — Notifications

Estimated effort: 3–4 days

Build:

```text
In-app notifications
Unread count
Mark as read
Mentions
Assignments
Comments
Due dates
```

---

# Phase 10 — Real-Time

Estimated effort: 4–6 days

Add WebSockets.

Start with:

```text
card.updated
card.moved
comment.created
list.created
member.added
```

Do not attempt every event immediately.

---

# Phase 11 — Search & Filtering

Estimated effort: 2–4 days

Support:

```text
Text search
Members
Labels
Due dates
Lists
```

---

# Phase 12 — Automation

Estimated effort: 5–7 days

Build a minimal automation engine:

```text
Trigger
+
Condition
+
Action
```

Start with:

```text
CARD_CREATED
CARD_MOVED
DUE_DATE_REACHED
```

and:

```text
MOVE_CARD
ADD_LABEL
ASSIGN_MEMBER
ADD_CHECKLIST
```

---

# Phase 13 — Power-Ups

Estimated effort: 5–10+ days per integration

First create the architecture.

Do not immediately build 10 integrations.

Example:

```text
PowerUp
   ↓
GitHub
   ↓
Display PR information on card
```

Then expand.

---

# Phase 14 — Production Hardening

Before calling the application "production ready":

```text
Security audit
Rate limiting
Logging
Error tracking
Database backups
Input validation
File upload security
Performance testing
E2E tests
Accessibility
Responsive design
```

---

# 47. Solo Developer Priority Matrix

## P0 — Must Have

```text
Authentication
Workspace
Board
List
Card
Drag & Drop
Members
Permissions
Comments
Labels
Checklists
```

## P1 — Important

```text
Notifications
Attachments
Due dates
Search
Filtering
Activity
Real-time updates
Board archive
```

## P2 — Later

```text
Automation
Power-Ups
Voting
Card covers
Custom fields
Observers
Guest management
```

## P3 — Future

```text
GitHub integration
Jira integration
Google Drive
Slack
Advanced analytics
Mobile application
AI features
Enterprise SSO
Billing
```

---

# 48. Zero-Cost Development Strategy

The project should be designed so that you do not need to spend money.

## Local Development

Use:

```text
Node.js
PostgreSQL
Docker
Docker Compose
Git
GitHub
```

Everything can run locally.

Example:

```text
docker compose up
```

starts:

```text
PostgreSQL
API
```

---

# 49. Zero-Cost Infrastructure Philosophy

Do not design the application around paid infrastructure.

Use interfaces:

```text
DatabaseProvider
StorageProvider
EmailProvider
AuthProvider
```

Then development can use:

```text
Local PostgreSQL
Local file storage
Console email provider
```

Later production providers can be plugged in.

This prevents vendor lock-in.

Free tiers from hosting/database providers change over time, so verify the current limits before deploying. The architecture itself should remain provider-independent.

---

# 50. File Storage Strategy

During development:

```text
./uploads
```

Production:

```text
Object Storage
```

Create an abstraction:

```ts
interface StorageProvider {
  upload(file: File): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}
```

Then:

```text
LocalStorageProvider
S3StorageProvider
```

can implement the same interface.

---

# 51. Email Strategy

Do not make email a hard dependency during MVP.

Development:

```text
ConsoleEmailProvider
```

Example:

```text
Invitation email:

http://localhost:3000/invite/abc123
```

Later:

```text
EmailProvider
    ↓
SMTP / transactional email service
```

---

# 52. Environment Variables

Never commit secrets.

Example:

```env
DATABASE_URL=
JWT_SECRET=
STORAGE_PATH=
FRONTEND_URL=
```

Use:

```text
.env
.env.example
```

Commit only:

```text
.env.example
```

---

# 53. Git Strategy

Use small feature branches:

```text
main
develop

feature/auth
feature/workspace
feature/boards
feature/cards
feature/comments
feature/notifications
```

Commit examples:

```text
feat(auth): add login API

feat(board): create board management

feat(card): implement card movement

fix(card): rollback failed drag operation

test(permission): add board admin tests
```

---

# 54. Definition of Done

A feature is NOT complete just because the UI works.

For every feature:

```text
Database
   ✓

API
   ✓

Validation
   ✓

Authorization
   ✓

Frontend
   ✓

Error handling
   ✓

Loading state
   ✓

Empty state
   ✓

Tests
   ✓
```

Example:

### Create Card

Not:

```text
Button → card appears
```

Instead:

```text
Button
 ↓
Validation
 ↓
API
 ↓
Authorization
 ↓
Database transaction
 ↓
Response
 ↓
Cache update
 ↓
UI
 ↓
Activity
 ↓
WebSocket event
```

---

# 55. Performance Principles

Do not optimize everything prematurely.

Initially:

```text
PostgreSQL indexes
Pagination
Lazy loading
Optimistic UI
Debounced search
Efficient queries
```

Important indexes:

```text
Board.workspaceId

List.boardId

Card.listId

CardMember.cardId

CardMember.userId

Comment.cardId

Notification.userId
```

---

# 56. Important Architectural Decision

Cards can eventually become numerous.

Do not return the entire board with every card property every time.

Bad:

```http
GET /boards/123
```

returning:

```text
board
all lists
all cards
all comments
all attachments
all activities
all members
all checklists
```

Instead:

```text
GET /boards/:id

GET /boards/:id/lists

GET /lists/:id/cards

GET /cards/:id

GET /cards/:id/comments
```

Use appropriate caching on the frontend.

---

# 57. API Authorization Example

Suppose:

```text
DELETE /boards/123
```

Request:

```text
User = John
Board = 123
```

Backend:

```text
1. Authenticate John

2. Find Board 123

3. Find John's BoardMember record

4. Check role

5. Check permission

6. Delete/archive board
```

Never:

```text
if (user.role === "ADMIN")
```

because there are multiple levels of admin.

Instead:

```text
WorkspaceRole
BoardRole
ResourcePermission
```

must be considered independently.

---

# 58. Recommended Permission Service

Create:

```text
AuthorizationService
```

with methods such as:

```ts
canAccessWorkspace()

canManageWorkspaceMembers()

canAccessBoard()

canManageBoard()

canManageBoardMembers()

canCreateCard()

canUpdateCard()

canDeleteCard()

canComment()

canVote()
```

Eventually centralize these rules into a permission matrix.

---

# 59. Most Important Domain Rule

Remember:

```text
Workspace Admin ≠ Board Admin
```

A Workspace Admin has workspace-level authority.

A Board Admin has board-level authority.

A user can therefore be:

```text
Workspace A
    ADMIN

Board X
    MEMBER
```

while another user can be:

```text
Workspace A
    MEMBER

Board X
    ADMIN
```

Your database and authorization system must support this.

---

# 60. Recommended Development Order

The complete project should follow this dependency chain:

```text
Authentication
      ↓
User
      ↓
Workspace
      ↓
Workspace Membership
      ↓
Board
      ↓
Board Membership
      ↓
List
      ↓
Card
      ↓
Card Members
      ↓
Drag & Drop
      ↓
Comments
      ↓
Labels
      ↓
Checklists
      ↓
Due Dates
      ↓
Attachments
      ↓
Notifications
      ↓
Permissions
      ↓
Real-time
      ↓
Search
      ↓
Automation
      ↓
Power-Ups
```

---

# 61. Final Product Architecture

Eventually:

```text
                         ┌──────────────────┐
                         │     Browser      │
                         │                  │
                         │ Vue 3            │
                         │ shadcn-vue       │
                         │ Pinia            │
                         │ TanStack Query   │
                         └────────┬─────────┘
                                  │
                         HTTPS / WebSocket
                                  │
                         ┌────────▼────────┐
                         │   API Gateway   │
                         └────────┬────────┘
                                  │
                  ┌───────────────┼────────────────┐
                  │               │                │
          ┌───────▼──────┐ ┌─────▼─────┐ ┌────────▼───────┐
          │ Auth Module  │ │ Board     │ │ Collaboration  │
          │              │ │ Module    │ │ Module         │
          └──────────────┘ └───────────┘ └────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    │             │              │
             ┌──────▼─────┐ ┌────▼─────┐ ┌──────▼──────┐
             │ PostgreSQL │ │  Storage  │ │ WebSocket   │
             └────────────┘ └───────────┘ └─────────────┘
```

---

# 62. Solo Developer Rule

The most important rule for this project:

> **Do not build Trello. Build your Trello.**

Start with:

```text
Workspace
   ↓
Board
   ↓
List
   ↓
Card
```

Make that experience excellent.

Then add:

```text
Members
Permissions
Comments
Notifications
```

Then:

```text
Real-time
Automation
Power-Ups
```

Do not spend months building integrations before your core Kanban system works.

---

# 63. First Milestone

Your first milestone should be:

## "A user can manage a real project."

The complete flow:

```text
Register
 ↓
Login
 ↓
Create Workspace
 ↓
Create Board
 ↓
Create Lists
 ↓
Create Cards
 ↓
Drag Cards
 ↓
Open Card
 ↓
Edit Description
 ↓
Create Checklist
 ↓
Add Label
 ↓
Assign Member
 ↓
Comment
 ↓
See Activity
```

Once this works end-to-end, you have the foundation for the rest of the application.

---

# 64. Recommended First Sprint

### Week 1

```text
Day 1
Project architecture
Monorepo
Vue setup
Backend setup
Docker PostgreSQL

Day 2
Prisma
Database schema
User model
Workspace model

Day 3
Authentication
Register
Login
Logout

Day 4
Workspace
Create workspace
Workspace list

Day 5
Workspace members
Roles
Authorization middleware

Day 6
Board
Create board
List boards

Day 7
Board permissions
Board members
Board admin
```

### Week 2

```text
Lists
Cards
Card modal
Card CRUD
Drag & Drop
Position management
```

### Week 3

```text
Labels
Checklists
Comments
Assignments
Due dates
Activity
```

### Week 4

```text
Notifications
Search
Filtering
Board settings
Archive
Restore
Testing
```

At the end of four weeks, you should have a meaningful MVP rather than a collection of unfinished features.

---

# 65. Long-Term Architecture

If the project grows significantly:

```text
                    API
                     │
          ┌──────────┴──────────┐
          │                     │
     Application           WebSocket
          │
     Domain Services
          │
     Repository Layer
          │
     PostgreSQL
```

Keep the domain logic independent from:

```text
Vue
Express/Fastify
Prisma
PostgreSQL
```

This makes the project easier to test and evolve.

---

# 66. Project Success Criteria

The project is successful when:

* Users can create workspaces.
* Workspaces can contain multiple boards.
* Boards contain lists.
* Lists contain cards.
* Cards can be moved using drag-and-drop.
* Users can collaborate.
* Permissions are enforced server-side.
* Admin actions are auditable.
* Users receive notifications.
* The application works reliably with multiple users.
* The system can eventually support automation and integrations.
* The application can run locally without paid services.

---

# 67. Final Recommendation

Build the application in this order:

```text
                FOUNDATION
                    │
                    ▼
               AUTHENTICATION
                    │
                    ▼
                WORKSPACE
                    │
                    ▼
                  BOARD
                    │
                    ▼
                  LIST
                    │
                    ▼
                  CARD
                    │
                    ▼
             DRAG & DROP
                    │
                    ▼
              COLLABORATION
                    │
                    ▼
               PERMISSIONS
                    │
                    ▼
              NOTIFICATIONS
                    │
                    ▼
                REALTIME
                    │
                    ▼
                SEARCH
                    │
                    ▼
               AUTOMATION
                    │
                    ▼
               POWER-UPS
```

This ordering minimizes architectural rework while keeping the project achievable for one developer.

---

## Core Principle

**Build simple first. Build correctly second. Scale only when the application actually needs it.**

The goal is not to reproduce Trello feature-for-feature.

The goal is to build a **well-architected collaborative project-management platform** that demonstrates:

```text
Frontend Architecture
+
Backend Architecture
+
Database Design
+
Authentication
+
Authorization
+
Real-time Systems
+
Distributed Events
+
Testing
+
DevOps
+
System Design
```

