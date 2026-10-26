/**
 * Board server state — same split as useWorkspaces.ts.
 *
 * - useBoardsQuery: the open boards of one workspace, cached per workspace id.
 * - useBoardQuery: a single board, for the board page.
 * - useCreateBoard: POSTs, seeds the new board's detail cache (so opening it is
 *   instant) and invalidates the workspace's list so the grid shows it.
 */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { CreateBoardInput } from "@taskpulse/shared-types";

import { ApiError } from "@/services/http";
import { createBoard, fetchBoard, fetchBoards } from "@/services/boards";

export const boardKeys = {
  all: ["boards"] as const,
  list: (workspaceId: string) => [...boardKeys.all, "list", workspaceId] as const,
  detail: (boardId: string) => [...boardKeys.all, "detail", boardId] as const,
};

export function useBoardsQuery(workspaceId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => boardKeys.list(toValue(workspaceId) ?? "")),
    queryFn: () => fetchBoards(toValue(workspaceId)!),
    // No workspace yet (first run) → nothing to fetch
    enabled: computed(() => Boolean(toValue(workspaceId))),
  });
}

export function useBoardQuery(boardId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => boardKeys.detail(toValue(boardId))),
    queryFn: () => fetchBoard(toValue(boardId)),
    // A 404 is a real answer (missing or not yours), retrying won't change it
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  });
}

export function useCreateBoard(workspaceId: MaybeRefOrGetter<string | null | undefined>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBoardInput) => createBoard(toValue(workspaceId)!, input),
    onSuccess: async (board) => {
      queryClient.setQueryData(boardKeys.detail(board.id), board);
      await queryClient.invalidateQueries({ queryKey: boardKeys.list(board.workspaceId) });
    },
  });
}
