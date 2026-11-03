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
import {createList, deleteList, fetchLists, moveList, updateList} from "@/services/lists";
import { toast } from "vue-sonner";


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

export function useMoveList(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  const key = () => listKeys.byBoard(toValue(boardId));

  return useMutation({
    mutationFn: (v: { listId: string; beforeId: string | null; afterId: string | null; optimistic: List[] }) =>
      moveList(v.listId, { beforeId: v.beforeId, afterId: v.afterId }),

    onMutate: async (v) => {
      // Stop an in-flight refetch from overwriting the optimistic order.
      await queryClient.cancelQueries({ queryKey: key() });
      const previous = queryClient.getQueryData<List[]>(key());
      queryClient.setQueryData<List[]>(key(), v.optimistic);
      return { previous };
    },
    onError: (error, _v, context) => {
      queryClient.setQueryData(key(), context?.previous);
      // 409 means our view was stale; fetch the real order.
      if (error instanceof ApiError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: key() });
      }
      toast.error("Couldn't move the list");
    },
    onSuccess: (moved) => {
      // Keep the server's rank so the next move computes from real data.
      queryClient.setQueryData<List[]>(key(), (old) => old?.map((l) => (l.id === moved.id ? moved : l)));
    },
  });
}
