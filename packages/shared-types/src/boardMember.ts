export interface boardMember {
  id : string,
  boardId : string,
  userId : string,
  role: "ADMIN" | "NORMAL"| "OBSERVER",
  joinedAt : string
}