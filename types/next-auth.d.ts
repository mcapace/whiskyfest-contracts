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
      /** Real login user — true only for users allowed to use "View as…". */
      can_impersonate?: boolean;
      /** Persisted UI theme; null/undefined = system. */
      theme_preference?: 'light' | 'dark' | 'system' | null;
      tour_completed_at?: string | null;
      tour_last_role?: string | null;
    };
    impersonation?: {
      active: boolean;
      target_email: string;
      target_name: string | null;
      started_at: string;
      role_description: string;
    } | null;
    /** True while viewing as another user — mutating API calls are blocked. */
    is_read_only_impersonation?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    is_events_team?: boolean;
    is_accounting?: boolean;
    pipeline_access?: boolean;
    real_can_impersonate?: boolean;
    impersonation_target_email?: string | null;
    impersonation_target_name?: string | null;
    impersonation_started_at?: number | null;
    effective_role_description?: string;
    theme_preference?: 'light' | 'dark' | 'system' | null;
    tour_completed_at?: string | null;
    tour_last_role?: string | null;
  }
}
