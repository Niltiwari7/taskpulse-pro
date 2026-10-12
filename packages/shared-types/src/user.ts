export interface User {
  id: string;
  fullName?: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Shape returned by the API (see apps/server/src/utils/toPublicUser.ts)
export interface PublicUser {
  id: string;
  username: string;
  email: string;
}
