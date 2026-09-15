import type {User} from '@taskpulse/shared-types';

const testUser : User = {
  id: 'user_01',
  username:'builder',
  email: 'builder@taskpuls.io',
  role: 'ADMIN'
}

console.log('Symlink verification successful! Loaded User:',testUser);