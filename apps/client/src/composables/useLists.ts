/**
 * List server state - One cache entry per board, holding its lists in rank order.
 * 
 * Mutations patch that entry with setQueryData instead of refetching the server
 * tells us exactly what changed (new list is always last, rename returns the list, delete is by id), so a round trip would only add latency.
 */


import {computed, toValue, type MaybeRefOrGetter} from "vue";
import {useMutation, useQuery, useQueryClient} from "@tanstack/vue-query";
import type {CreateListInput, List} from "@taskpulse/shared-types";

import {ApiError} from "@/services/http";
import {createList, deleteList, fetchLists, updateList} from "@/services/lists";


export const listKeys = {
  all: ["lists"] as const,
  byBoard: (boardId: string) => [...listKeys.all, "board", boardId] as const,
}


export function useListsQuery(boardId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => listKeys.byBoard(toValue(boardId))),
    queryFn: () => fetchLists(toValue(boardId)),
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  });
}

export function useCreateList(boardId : MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListInput) => createList(toValue(boardId), input),
    onSuccess: (list)=> {
      queryClient.setQueryData<List[]>(listKeys.byBoard(list.boardId), (old) => (old ? [...old, list] : [list]));
    }
  })
}

export function useRenameList(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({listId, name}: {listId: string, name: string}) => updateList(listId, {name}),
    onSuccess: (updated) => {
      queryClient.setQueryData<List[]>(listKeys.byBoard(toValue(boardId)), (old) =>
        old?.map((list) => (list.id === updated.id ? updated : list)),
      );
    },       
  })
}


export function useDeleteList(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listId: string) => deleteList(listId),
    // Second argument is what we passed to mutate(), i.e. the list id
    onSuccess: (_data, listId) => {
      queryClient.setQueryData<List[]>(listKeys.byBoard(toValue(boardId)), (old) =>
        old?.filter((list) => list.id !== listId),
      );
    },
  });
}