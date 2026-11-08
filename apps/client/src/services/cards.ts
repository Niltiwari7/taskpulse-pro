import type { Card, CreateCardInput, UpdateCardInput } from "@taskpulse/shared-types";
import {http} from '@/services/http'
type CardResponse = {data: {card: Card}}

const cardPath = (cardId: string) => `/cards/${encodeURIComponent(cardId)}`;

export async function createCard(listId: string, input: CreateCardInput): Promise<Card> {
    const res = await http<CardResponse>(`/lists/${encodeURIComponent(listId)}/cards`, {
      method: 'POST',
      body: input
    })

    return res.data.card;
}

export async function fetchCard(cardId : string): Promise<Card> {
  const res = await http<CardResponse>(cardPath(cardId));
  return res.data.card;
}

export async function updateCard(cardId : string, input : UpdateCardInput):Promise<Card> {
  const res = await http<CardResponse>(cardPath(cardId), {
    method: 'PATCH',
    body:input
  })

  return res.data.card;
}