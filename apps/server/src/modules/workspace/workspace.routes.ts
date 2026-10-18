import { Router } from 'express';
import { requireAuth } from '../../middleware/requiredAuth';
import { requireWorkspaceRole } from '../../middleware/requireWorkspaceRole';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from './workspace.controller';

const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

// No :workspaceId yet, so no role check: any logged-in user may create or list their own.
workspaceRouter.post('/', createWorkspace);
workspaceRouter.get('/', listWorkspaces);

workspaceRouter.get('/:workspaceId', requireWorkspaceRole('MEMBER'), getWorkspace);
workspaceRouter.patch('/:workspaceId', requireWorkspaceRole('ADMIN'), updateWorkspace);
workspaceRouter.delete('/:workspaceId', requireWorkspaceRole('ADMIN'), deleteWorkspace);

export default workspaceRouter;
