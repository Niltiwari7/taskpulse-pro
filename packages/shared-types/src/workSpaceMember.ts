export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
}