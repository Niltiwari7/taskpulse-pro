/**
 * Workspace MEMBERS server state — same split as useWorkspaces.ts.
 *
 * - useWorkspaceMembersQuery: the member list for one workspace, cached per id.
 * - useInviteMember / useUpdateMemberRole / useRemoveMember: mutations that
 *   invalidate that list on success, so every row re-renders from fresh data.
 *
 * `workspaceId` is a ref/getter because it comes from the route: when the user
 * switches workspace, the query key changes and TanStack fetches the new list.
 */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { InviteMemberInput, WorkspaceRole } from "@taskpulse/shared-types";

import { fetchMembers, inviteMember, removeMember, updateMemberRole } from "@/services/workspaces";
import { workspaceKeys } from "./useWorkspaces";

export function useWorkspaceMembersQuery(workspaceId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => workspaceKeys.members(toValue(workspaceId))),
    queryFn: () => fetchMembers(toValue(workspaceId)),
  });
}

export function useInviteMember(workspaceId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteMemberInput) => inviteMember(toValue(workspaceId), input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(toValue(workspaceId)) }),
  });
}

export function useUpdateMemberRole(workspaceId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      updateMemberRole(toValue(workspaceId), userId, { role }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(toValue(workspaceId)) }),
  });
}

export function useRemoveMember(workspaceId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeMember(toValue(workspaceId), userId),
    // Invalidate everything workspace-related: if you removed yourself, the
    // workspace must also disappear from your dashboard and switcher.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
