export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}