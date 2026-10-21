/**
 * Workspace API calls — plain async functions, no Vue, no caching.
 *
 * They unwrap the server's `{ data: { ... } }` envelope so the rest of the app
 * only ever sees `Workspace` objects. TanStack Query (composables/useWorkspaces)
 * decides *when* these run; this file only knows *how* to talk to the server.
 */
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  Workspace,
  WorkspaceMemberWithUser,
} from "@taskpulse/shared-types";

import { http } from "@/services/http";

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await http<{ data: { workspaces: Workspace[] } }>("/workspaces");
  return response.data.workspaces;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const response = await http<{ data: { workspace: Workspace } }>("/workspaces", {
    method: "POST",
    body: input,
  });
  return response.data.workspace;
}

type MemberResponse = { data: { member: WorkspaceMemberWithUser } };

function membersPath(workspaceId: string, userId?: string): string {
  const base = `/workspaces/${encodeURIComponent(workspaceId)}/members`;
  return userId ? `${base}/${encodeURIComponent(userId)}` : base;
}

export async function fetchMembers(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
  const response = await http<{ data: { members: WorkspaceMemberWithUser[] } }>(membersPath(workspaceId));
  return response.data.members;
}

export async function inviteMember(workspaceId: string, input: InviteMemberInput): Promise<WorkspaceMemberWithUser> {
  const response = await http<MemberResponse>(membersPath(workspaceId), {
    method: "POST",
    body: input,
  });
  return response.data.member;
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  input: UpdateMemberRoleInput,
): Promise<WorkspaceMemberWithUser> {
  const response = await http<MemberResponse>(membersPath(workspaceId, userId), {
    method: "PATCH",
    body: input,
  });
  return response.data.member;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await http<null>(membersPath(workspaceId, userId), { method: "DELETE" });
}
