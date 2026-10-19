/**
 * Workspace store — CLIENT state only.
 *
 * It holds *which* workspace the user picked, never the workspace data itself.
 * The list of workspaces is server state and lives in the TanStack Query cache
 * (see composables/useWorkspaces). Copying it here would create a second source
 * of truth that goes stale the moment someone creates or renames a workspace.
 */
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export const useWorkspaceStore = defineStore("workspace", () => {
  // Persisted so the selection survives a page refresh
  const selectedId = useLocalStorage<string | null>("taskpulse:selected-workspace-id", null);

  function select(id: string | null) {
    selectedId.value = id;
  }

  return { selectedId, select };
});
