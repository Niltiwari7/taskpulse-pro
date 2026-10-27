export type BoardMemberRole = "ADMIN" | "MEMBER" | "OBSERVER" | "GUEST";

export interface boardMember {
  id : string,
  boardId : string,
  userId : string,
  role: BoardMemberRole,
  joinedAt : string
}
