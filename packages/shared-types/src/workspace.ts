export interface Workspace {
  id: string;
  name: string;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
}