/**
 * Workspace API calls — plain async functions, no Vue, no caching.
 *
 * They unwrap the server's `{ data: { ... } }` envelope so the rest of the app
 * only ever sees `Workspace` objects. TanStack Query (composables/useWorkspaces)
 * decides *when* these run; this file only knows *how* to talk to the server.
 */
import type { CreateWorkspaceInput, Workspace } from "@taskpulse/shared-types";

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
