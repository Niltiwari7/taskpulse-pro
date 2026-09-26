export interface ChecklistItem {
  id: string;
  checklistId: string;
  content: string;
  isCompleted: boolean;
  assignedUserId: string;
  dueDate: string;
  position: number;
}