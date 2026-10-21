import type { BoardMemberRole, WorkspaceRole } from "@taskpulse/shared-types"

// Facts about the user *for this board's workspace and this board*.
// The caller looks these up; this function never touches the DB.
export interface BoardAccessUser {
  workspaceRole: WorkspaceRole | null; // null = not in this board's workspace
  boardRole: BoardMemberRole | null;   // null = not a member of this board
}

export interface BoardAccessBoard {
  visibility: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';
}

// `user` is null for anonymous requests. See the truth table in docs/permissions.md.
export function canAccessBoard(user: BoardAccessUser | null, board: BoardAccessBoard): boolean {
  if (board.visibility === 'PUBLIC') {
    return true;
  }
  if (!user) {
    return false;
  }
  // Explicit board membership always grants access, including guests 
  if (user.boardRole) {
    return true;
  }
  if (board.visibility === 'WORKSPACE') {
    return user.workspaceRole !== null;
  }
  // PRIVATE: workspace admins can see it so they can manage it 
  return user.workspaceRole === 'ADMIN';
}
