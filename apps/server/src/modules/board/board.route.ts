import { Router } from 'express';
import { requireAuth } from '../../middleware/requiredAuth';
import {
  archiveBoard,
  deleteBoard,
  getBoard,
  listBoardMembers,
  updateBoard,
  addBoardMember,
  removeBoardMember,
  listLists,
  createList
} from './board.controller';

// Routes addressed by board id. The workspace-scoped ones (create, list) live in workspace.routes.ts
// so they can reuse requireWorkspaceRole.
const boardRouter = Router();

boardRouter.use(requireAuth);

// Access checks need the board's workspace, so each handler does them itself (loadAccessibleBoard).
boardRouter.get('/:boardId', getBoard);
boardRouter.patch('/:boardId', updateBoard);
boardRouter.post('/:boardId/archive', archiveBoard);
boardRouter.delete('/:boardId', deleteBoard);

boardRouter.get('/:boardId/members', listBoardMembers);
boardRouter.post('/:boardId/members', addBoardMember);
boardRouter.delete('/:boardId/members/:userId', removeBoardMember);

boardRouter.get('/:boardId/lists', listLists);
boardRouter.post('/:boardId/lists', createList);

export default boardRouter;
