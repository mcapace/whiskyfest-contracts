import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types/db';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role?: UserRole;
    };
  }
}
