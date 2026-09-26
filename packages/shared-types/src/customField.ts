export interface CustomField {
  id: string;
  boardId: string;
  name: string;
  type: "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "CHECKBOX";
}