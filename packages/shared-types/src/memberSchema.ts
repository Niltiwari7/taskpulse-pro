import {z} from 'zod';

export const inviteMemberSchema = z.object({
  email: z.email().trim().lowercase(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER')
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});
