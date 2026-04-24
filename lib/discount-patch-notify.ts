import { notifyAdminsOfDiscountRequest } from '@/lib/notifications';
import { requiresDiscountApproval } from '@/lib/contracts';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Contract, ContractWithTotals } from '@/types/db';

/**
 * When a draft (or signer) PATCH lowers booth rate into "discounted & unapproved" territory
 * for the first time, notify admins — same as POST /api/contracts create.
 * Skips if the contract already required discount approval before the edit, or no longer does after.
 */
export async function notifyAdminsIfNewlyRequiresDiscountApproval(params: {
  contractId: string;
  before: Pick<Contract, 'booth_rate_cents' | 'discount_approved_at'>;
  incomingBoothRate: number;
  shouldResetDiscountApproval: boolean;
  editor: { email: string; name?: string | null };
}): Promise<void> {
  const { contractId, before, incomingBoothRate, shouldResetDiscountApproval, editor } = params;

  const newDiscountApprovedAt = shouldResetDiscountApproval ? null : before.discount_approved_at;
  const beforeNeeded = requiresDiscountApproval(before);
  const afterNeeded = requiresDiscountApproval({
    booth_rate_cents: incomingBoothRate,
    discount_approved_at: newDiscountApprovedAt,
  });

  if (beforeNeeded || !afterNeeded) return;

  const supabase = getSupabaseAdmin();
  const { data: withTotals } = await supabase.from('contracts_with_totals').select('*').eq('id', contractId).maybeSingle();
  if (!withTotals) return;

  try {
    await notifyAdminsOfDiscountRequest(withTotals as ContractWithTotals, {
      email: editor.email,
      name: editor.name ?? undefined,
    });
  } catch (e) {
    console.error('[notifyAdminsIfNewlyRequiresDiscountApproval]', e);
  }
}
