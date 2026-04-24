import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyAdminsOfAccessRequest } from '@/lib/notifications';

function tokenExpIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function ensureAccessRequestForUnknownUser(params: { email: string; name?: string | null }): Promise<void> {
  const supabase = getSupabaseAdmin();
  const email = params.email.toLowerCase();
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from('access_requests')
    .select('id, status, token_expires_at')
    .eq('email', email)
    .maybeSingle();

  const pendingStillValid =
    existing?.status === 'pending' && existing.token_expires_at && new Date(existing.token_expires_at).getTime() > Date.now();
  if (pendingStillValid) return;

  const approvalToken = randomBytes(32).toString('hex');
  const payload = {
    email,
    name: params.name ?? null,
    requested_at: nowIso,
    status: 'pending' as const,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    approval_token: approvalToken,
    token_expires_at: tokenExpIso(24),
    granted_role: null,
    granted_flags: null,
  };

  const { data: row, error } = await supabase
    .from('access_requests')
    .upsert(payload, { onConflict: 'email' })
    .select('id, email, name, requested_at, approval_token')
    .single();
  if (error) throw error;

  await notifyAdminsOfAccessRequest({
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string | null) ?? null,
    requestedAtIso: row.requested_at as string,
    approvalToken: row.approval_token as string,
  });
}
