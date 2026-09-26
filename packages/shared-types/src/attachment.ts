export interface Attachment {
  id: string;
  cardId: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  uploadedAt: string;
}