/**
 * Card server state.
 *
 * Cards live in one flat array per board (cardKeys.byBoard), seeded by the board
 * query from GET /boards/:id — no request of their own. Flat, not nested under
 * lists, so a card added to a list created after the board loaded still has a home.
 */

import {computed, toValue, type MaybeRefOrGetter} from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import type {Card, CreateCardInput, MoveCardInput, UpdateCardInput} from "@taskpulse/shared-types"

import { ApiError } from "@/services/http";
import { createCard, fetchCard, updateCard, moveCard } from "@/services/cards";
import { applyCardMove } from "@/lib/reorder";
// useBoards imports cardKeys from here too; safe, because both are only read inside functions.
import { boardKeys } from "./useBoards";

export const cardKeys = {
  all: ["cards"] as const,
  byBoard: (boardId: string) => [...cardKeys.all, "board", boardId] as const,
  detail: (cardId: string) => [...cardKeys.all, "detail", cardId] as const,
};

export function useBoardCards(boardId : MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey : computed(()=>cardKeys.byBoard(toValue(boardId))),
    queryFn: ()=> [] as Card[],
    enabled: false
  })
}

export function useCreateCard(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { listId: string; input: CreateCardInput }) => createCard(v.listId, v.input),
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(cardKeys.byBoard(toValue(boardId)), (old) => [...(old ?? []), card]);
    },
  })
}

export function useCardQuery(boardId : MaybeRefOrGetter<string>, cardId : MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: computed(()=>cardKeys.detail(toValue(cardId))),
    queryFn:() => fetchCard(toValue(cardId)),
    placeholderData: ()=> queryClient.getQueryData<Card[]>(cardKeys.byBoard(toValue(boardId)))?.find((c)=>c.id === toValue(cardId)),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 3
  })
}

export function useUpdateCard(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { cardId: string; input: UpdateCardInput }) => updateCard(v.cardId, v.input),
    onSuccess: (updated) => {
      // Same card sits in two caches: the board's tiles and the modal's detail.
      queryClient.setQueryData(cardKeys.detail(updated.id), updated);
      queryClient.setQueryData<Card[]>(cardKeys.byBoard(toValue(boardId)), (old) =>
        old?.map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });
}


export function useMoveCard(boardId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  const cardsKey = () => cardKeys.byBoard(toValue(boardId));
  const boardKey = () => boardKeys.detail(toValue(boardId));

  return useMutation({
    mutationKey:["moveCard"],
    mutationFn: (v: { cardId: string; input: MoveCardInput }) => moveCard(v.cardId, v.input),
    onMutate: async({cardId, input})=> {
      //1. A board refetch landing now would overwrite our guess
      await queryClient.cancelQueries({queryKey:boardKey()});
      // 2. snapshot
       const previous = queryClient.getQueryData<Card[]>(cardsKey());
      // 3. apply the guess
      if(previous) {
        try {
          queryClient.setQueryData<Card[]>(cardsKey(),applyCardMove(previous,cardId, input));
        }catch {
          // Neighbors out of order: skip the guess and let the server decide
        }
      }
      // 4. Becomes 'context' in onError
      return {previous};
    },
    onError:(error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(cardsKey(), context.previous);
      toast.error(
        error instanceof ApiError && error.status === 409 ?
        "The board changes while you were dragging. Showing the latest" :
        "Could not move the card"
      )
    },
    onSuccess: (moved) => {
      // Swap the guessed rank for the real one (keep the existing body).
      queryClient.setQueryData(cardKeys.detail(moved.id), moved);
      queryClient.setQueryData<Card[]>(cardsKey(), (old) => old?.map((c) => (c.id === moved.id ? moved : c)));
    },
    onSettled: ()=> {
      // Only resync after the last move in a burst of drags, otherwise
      // the refetch can briefly undo moves that are still in flight
      if(queryClient.isMutating({mutationKey:["moveCard"]})===1) {
        return queryClient.invalidateQueries({queryKey:boardKey()})
      }
    }
  });
}
