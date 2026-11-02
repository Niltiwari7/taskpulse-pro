/**
 * List API calls
 * 
 * Reading and creating are board-scoped (/boards/:id/lists);
 * rename and delete are addressed by list id (/lists/:id).
 */


import type {CreateListInput, List, UpdateListInput} from "@taskpulse/shared-types";

import { http } from "@/services/http";

type ListResponse = {data : {list: List}};

function boardListsPath(boardId: string) : string {
  return `/boards/${encodeURIComponent(boardId)}/lists`;
}

function listPath(listId: string): string {
  return `/lists/${encodeURIComponent(listId)}`;
}


export async function fetchLists(boardId: string): Promise<List[]> {
  const response = await http<{data: {lists: List[]}}>(boardListsPath(boardId));
  return response.data.lists;
}

export async function createList(boardId: string, input: CreateListInput): Promise<List> {
  const response = await http<ListResponse>(boardListsPath(boardId), {
    method: "POST",
    body: input,
  });
  return response.data.list;
}

export async function updateList(listId: string, input: UpdateListInput): Promise<List> {
  const response = await http<ListResponse>(listPath(listId), {
    method: "PATCH",
    body: input,
  });
  return response.data.list;
}

export async function deleteList(listId: string): Promise<void> {
  await http<void>(listPath(listId), {
    method: "DELETE",
  });
}