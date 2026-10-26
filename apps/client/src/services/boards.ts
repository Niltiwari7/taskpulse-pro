/**
 * Board API calls — plain async functions, same shape as services/workspaces.
 *
 * Creating and listing are workspace-scoped (/workspaces/:id/boards); everything
 * else is addressed by board id (/boards/:id).
 */
import type { Board, CreateBoardInput } from "@taskpulse/shared-types";

import { http } from "@/services/http";

type BoardResponse = { data: { board: Board } };

function workspaceBoardsPath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/boards`;
}

export async function fetchBoards(workspaceId: string): Promise<Board[]> {
  const response = await http<{ data: { boards: Board[] } }>(workspaceBoardsPath(workspaceId));
  return response.data.boards;
}

export async function createBoard(workspaceId: string, input: CreateBoardInput): Promise<Board> {
  const response = await http<BoardResponse>(workspaceBoardsPath(workspaceId), {
    method: "POST",
    body: input,
  });
  return response.data.board;
}

export async function fetchBoard(boardId: string): Promise<Board> {
  const response = await http<BoardResponse>(`/boards/${encodeURIComponent(boardId)}`);
  return response.data.board;
}
