/**
 * Workspace SERVER state — everything here goes through the TanStack Query cache.
 *
 * - useWorkspacesQuery: the list. Every component that calls it shares ONE cache
 *   entry, so the switcher and the dashboard trigger a single request.
 * - useCreateWorkspace: the mutation. On success it invalidates the list, which
 *   refetches it, which re-renders every component reading it. That is what makes
 *   a new workspace "appear without a manual refresh".
 * - useCurrentWorkspace: joins server state (list) with client state (selectedId)
 *   in a computed — derived, never stored.
 */
import { computed } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import { createWorkspace, fetchWorkspaces } from "@/services/workspaces";
import { useWorkspaceStore } from "@/stores/workspace";

// Query key factory: build keys here, never type ['workspaces', ...] by hand
export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, workspaceId, "members"] as const,
};

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: fetchWorkspaces,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const workspaceStore = useWorkspaceStore();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (workspace) => {
      workspaceStore.select(workspace.id);
      // Returning/awaiting keeps the mutation "pending" until the fresh list arrives,
      // so the dialog doesn't close a split second before the card shows up.
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useCurrentWorkspace() {
  const workspaceStore = useWorkspaceStore();
  const { data } = useWorkspacesQuery();

  return computed(() => {
    const workspaces = data.value ?? [];
    // Fall back to the first workspace when the stored id is stale
    // (workspace deleted, or another user logged in on this browser)
    return workspaces.find((w) => w.id === workspaceStore.selectedId) ?? workspaces[0] ?? null;
  });
}
