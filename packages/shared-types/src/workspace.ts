import { z } from 'zod';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
}

const name = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const description = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters')
  .nullable();

const visibility = z.enum(['PUBLIC', 'PRIVATE']);

export const createWorkspaceSchema = z.object({
  name,
  description: description.optional(),
  visibility: visibility.default('PRIVATE'),
});

// PATCH: every field is optional, but an empty body is rejected.
export const updateWorkspaceSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    visibility: visibility.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
