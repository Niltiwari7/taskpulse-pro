import { z } from 'zod';
export interface Card {
  id: string,
  listId : string,
  title: string,
  description: string | null,
  position: string,
  coverImageUrl: string | null,
  startDate: string | null,
  dueDate: string | null,
  dueDateReminder: string | null,
  isDueComplete: boolean,
  isArchived: boolean,
  createdAt: string
}

const cardTitle = z.string({error: 'Title is required'})
                   .trim()
                   .min(1, 'Title is required')
                   .max(500,'Title must be at most 500 characters');


export const createCardSchema = z.object({
  title:cardTitle,
  description: z.string().max(10_000).optional()
}).strict();

export const updateCardSchema = z.object({
      title: cardTitle.optional(),
      description: z.string().max(10_000).nullable().optional(),
      startDate: z.iso.datetime().nullable().optional(),
      dueDate: z.iso.datetime().nullable().optional(),
      isDueComplete: z.boolean().optional()
}).strict()
  .refine((d)=>Object.keys(d).length>0, {message: 'At least one field must be provided'});

export const moveCardSchema = z.object({
  targetListId : z.string().min(1),
  beforeId : z.string().min(1).nullable(),
  afterId : z.string().min(1).nullable()
}).strict()
  .refine((d) => d.beforeId === null || d.beforeId !== d.afterId, {
    message: 'beforeId and afterId must differ'
  })

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;