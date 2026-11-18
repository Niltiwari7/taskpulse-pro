import {z} from 'zod'
export const LABEL_COLORS = ['green', 'yellow', 'orange', 'red','purple', 'blue']
export type LabelColor = (typeof LABEL_COLORS)[number];
export const labelColorSchema = z.enum(LABEL_COLORS);
export interface Label {
  id: string;
  boardId: string;
  name: string | null;
  color: LabelColor;
  createdAt : string;
}

