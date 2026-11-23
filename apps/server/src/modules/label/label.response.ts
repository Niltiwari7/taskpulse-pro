type LabelRow = {
  id: string;
  boardId: string;
  name: string | null; // default labels have no name
  color: string;
  createdAt: string;
};

export function toLabelResponse(label: LabelRow) {
  return {
    id: label.id,
    boardId: label.boardId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt,
  };
}
