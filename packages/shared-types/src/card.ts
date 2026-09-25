export interface Card {
  id: string,
  listId : string,
  title: string,
  description: string,
  position: number,
  coverImageUrl?: string,
  startDate?: string,
  dueDate?:string,
  dueDateReminder?:string,
  isDueDateCompleted?: boolean,
  isArchived?: boolean,
  createdAt: string
}