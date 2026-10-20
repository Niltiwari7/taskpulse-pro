import { Router } from 'express';
import { requireAuth } from '../../middleware/requiredAuth';
import { requireWorkspaceRole } from '../../middleware/requireWorkspaceRole';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
  listWorkspaceMembers,
  addMemberToWorkspace,
  removeMemberFromWorkspace,
  updateWorkspaceMemberRole
} from './workspace.controller';

const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

// No :workspaceId yet, so no role check: any logged-in user may create or list their own.
workspaceRouter.post('/', createWorkspace);
workspaceRouter.get('/', listWorkspaces);

workspaceRouter.get('/:workspaceId', requireWorkspaceRole('MEMBER'), getWorkspace);
workspaceRouter.patch('/:workspaceId', requireWorkspaceRole('ADMIN'), updateWorkspace);
workspaceRouter.delete('/:workspaceId', requireWorkspaceRole('ADMIN'), deleteWorkspace);

// Members management in the workspace
workspaceRouter.get('/:workspaceId/members', requireWorkspaceRole('MEMBER'), listWorkspaceMembers);
workspaceRouter.post('/:workspaceId/members', requireWorkspaceRole('ADMIN'), addMemberToWorkspace);
workspaceRouter.delete('/:workspaceId/members/:userId', requireWorkspaceRole('ADMIN'), removeMemberFromWorkspace);
workspaceRouter.patch('/:workspaceId/members/:userId', requireWorkspaceRole('ADMIN'), updateWorkspaceMemberRole);


export default workspaceRouter;
