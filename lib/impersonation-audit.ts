import { getSupabaseAdmin } from '@/lib/supabase';

export type ImpersonationEndReason = 'manual' | 'expired';

export async function logImpersonationStarted(actorEmail: string, targetEmail: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('audit_log').insert({
    contract_id: null,
    actor_email: actorEmail.toLowerCase(),
    action: 'impersonation_started',
    from_status: null,
    to_status: null,
    impersonation_target_email: targetEmail.toLowerCase(),
    metadata: null,
  });
}

export async function logImpersonationEnded(
  actorEmail: string,
  targetEmail: string,
  reason: ImpersonationEndReason,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('audit_log').insert({
    contract_id: null,
    actor_email: actorEmail.toLowerCase(),
    action: 'impersonation_ended',
    from_status: null,
    to_status: null,
    impersonation_target_email: targetEmail.toLowerCase(),
    metadata: { reason },
  });
}
