import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types/db';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role?: UserRole;
      is_events_team?: boolean;
      is_accounting?: boolean;
      can_view_all_sales?: boolean;
      /** True when user may access the main contract pipeline (admin, events team, or rep/assistant). */
      pipeline_access?: boolean;
      /** True when user may open the Wine Spectator portal (admin, events team, or Susannah Nolan). */
      wine_spectator_access?: boolean;
      /** Admin within Wine Spectator / NYWE (events settings + contract admin actions). */
      is_wine_spectator_admin?: boolean;
      /** True when user may open the Big Smoke portal (admin, events team, Big Smoke admin, AR). */
      big_smoke_access?: boolean;
      /** Admin within Big Smoke (events settings + contract admin actions). */
      is_big_smoke_admin?: boolean;
      /** Real login user — true only for users allowed to use "View as…". */
      can_impersonate?: boolean;
      /** Restricted user with access limited exclusively to NYWE executed booth QR codes. */
      is_qr_only?: boolean;
      /** Persisted UI theme; null/undefined = system. */
      theme_preference?: 'light' | 'dark' | 'system' | null;
      tour_completed_at?: string | null;
      tour_last_role?: string | null;
      /** Opt-in success sound + haptic on contract actions. */
      sound_enabled?: boolean;
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
    can_view_all_sales?: boolean;
    pipeline_access?: boolean;
    wine_spectator_access?: boolean;
    is_wine_spectator_admin?: boolean;
    big_smoke_access?: boolean;
    is_big_smoke_admin?: boolean;
    real_can_impersonate?: boolean;
    is_qr_only?: boolean;
    impersonation_target_email?: string | null;
    impersonation_target_name?: string | null;
    impersonation_started_at?: number | null;
    effective_role_description?: string;
    theme_preference?: 'light' | 'dark' | 'system' | null;
    tour_completed_at?: string | null;
    tour_last_role?: string | null;
    sound_enabled?: boolean;
  }
}
