/**
 * Card server state.
 *
 * Cards live in one flat array per board (cardKeys.byBoard), seeded by the board
 * query from GET /boards/:id — no request of their own. Flat, not nested under
 * lists, so a card added to a list created after the board loaded still has a home.
 */

import {computed, toValue, type MaybeRefOrGetter} from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type {Card, CreateCardInput, UpdateCardInput} from "@taskpulse/shared-types"

import { ApiError } from "@/services/http";
import { createCard, fetchCard, updateCard } from "@/services/cards";

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