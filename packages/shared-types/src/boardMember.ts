export type BoardMemberRole = "ADMIN" | "NORMAL" | "OBSERVER";

export interface boardMember {
  id : string,
  boardId : string,
  userId : string,
  role: BoardMemberRole,
  joinedAt : string
}
