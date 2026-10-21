import { z } from 'zod';

export type WorkspaceRole = 'ADMIN' | 'MEMBER';

// Normalise before validating: z.email() alone would reject "Bob@Example.com " outright.
export const inviteMemberSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email address')),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

// z.input, so `role` stays optional for callers; the server fills in the default.
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// Shape returned by the members API (see toWorkspaceMemberResponse on the server)
export interface WorkspaceMemberWithUser {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}
