export type CardRow = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: string;
  coverImageUrl: string | null;
  startDate: string | null;
  dueDate: string | null;
  dueDateReminder: string | null;
  isDueComplete: boolean;
  isArchived: boolean;
  createdAt: string;
};

export function toCardResponse(card: CardRow) {
  return {
    id: card.id,
    listId: card.listId,
    title: card.title,
    description: card.description,
    position: card.position,
    coverImageUrl: card.coverImageUrl,
    startDate: card.startDate,
    dueDate: card.dueDate,
    dueDateReminder: card.dueDateReminder,
    isDueComplete: card.isDueComplete,
    isArchived: card.isArchived,
    createdAt: card.createdAt,
  };
}
