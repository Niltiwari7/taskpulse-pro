export interface Task {
  id: string;
  title: string;
  description: string;
  columnId: string;
  assigneeId?: string;
  position: number;
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}