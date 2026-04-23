import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types/db';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role?: UserRole;
      is_events_team?: boolean;
      is_accounting?: boolean;
      /** True when user may access the main contract pipeline (admin, events team, or rep/assistant). */
      pipeline_access?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    is_events_team?: boolean;
    is_accounting?: boolean;
    pipeline_access?: boolean;
  }
}
