export interface Activity {
  id: string;
  boardId: string;
  cardId?: string;
  userId: string;
  actionType: string;
  details?: string;
  createdAt: string;
}