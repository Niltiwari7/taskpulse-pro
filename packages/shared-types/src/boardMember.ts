import {z} from 'zod';
export type BoardMemberRole = "ADMIN" | "MEMBER" | "OBSERVER" | "GUEST";

export interface boardMember {
  id : string,
  boardId : string,
  userId : string,
  role: BoardMemberRole,
  joinedAt : string
}


export const boardMemberRoleSchema = z.enum(['ADMIN', 'MEMBER', 'OBSERVER', 'GUEST']);


export const addBoardMemberSchema = z.object({
  email: z.string().email(),
  role: boardMemberRoleSchema.default('MEMBER'),
})