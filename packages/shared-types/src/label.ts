import {z} from 'zod'
export const LABEL_COLORS = ['green', 'yellow', 'orange', 'red','purple', 'blue'] as const
export type LabelColor = (typeof LABEL_COLORS)[number];
export const labelColorSchema = z.enum(LABEL_COLORS);
export interface Label {
  id: string;
  boardId: string;
  name: string | null;
  color: LabelColor;
  createdAt : string;
}

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40).nullable().optional(),
  color: labelColorSchema,
});

export const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(40).nullable().optional(),
  color: labelColorSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
);

export type createLabelSchemaInput = z.input<typeof createLabelSchema>;
export type updateLabelSchemaInput = z.input<typeof updateLabelSchema>;