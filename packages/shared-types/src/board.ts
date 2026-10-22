import z from "zod";

export interface Board {
  id: string;
  name: string;
  workspaceId: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';
  archivedAt: string | null;
  backgroundColorOrUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const name = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const visibility = z.enum(['PUBLIC', 'PRIVATE', 'WORKSPACE']).default('WORKSPACE');

const backgroundColorOrUrl = z.string().trim().min(1).optional();

export const createBoardSchema = z.object({
  name,
  visibility,
  backgroundColorOrUrl: backgroundColorOrUrl.optional(),
})

export const updateBoardSchema = z
  .object({
    name: name.optional(),
    visibility: z.enum(['PRIVATE', 'WORKSPACE', 'PUBLIC']).optional(),
    backgroundColorOrUrl: backgroundColorOrUrl.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
  );