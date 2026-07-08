import { getSupabaseAdmin } from '@/lib/supabase';
import { isNyweVendorEvent } from '@/lib/nywe-pricing';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import type { Contract, Event } from '@/types/db';

/** Stephen Senatore — head of Whisky Advocate; complimentary booth workflow. */
export const NO_CHARGE_BOOTH_OWNER_EMAIL = 'ssenatore@mshanken.com';

/** Katherine Brumley — books on Stephen's behalf. */
export const NO_CHARGE_BOOTH_ASSISTANT_EMAIL = 'kbrumley@mshanken.com';

export const NO_CHARGE_DISCOUNT_REASON = 'Complimentary booth — no charge workflow';

export function isNoChargeBoothContract(
  contract: Pick<Contract, 'no_charge_booth'> | { no_charge_booth?: boolean | null },
): boolean {
  return Boolean(contract.no_charge_booth);
}

export async function getStephenSenatoreRepId(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('sales_reps')
    .select('id')
    .eq('email', NO_CHARGE_BOOTH_OWNER_EMAIL)
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ?? null;
}

async function isWhiskyfestAdmin(actorEmail: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('app_users')
    .select('role, is_active')
    .eq('email', actorEmail.trim().toLowerCase())
    .maybeSingle();
  return Boolean(data?.is_active && data.role === 'admin');
}

/** True when the signed-in user may create/edit no-charge WhiskyFest booth deals. */
export async function actorCanUseNoChargeBooth(actorEmail: string): Promise<boolean> {
  if (await isWhiskyfestAdmin(actorEmail)) return true;

  const email = actorEmail.trim().toLowerCase();
  if (email === NO_CHARGE_BOOTH_OWNER_EMAIL) return true;
  if (email !== NO_CHARGE_BOOTH_ASSISTANT_EMAIL) return false;

  const supabase = getSupabaseAdmin();
  const stephenRepId = await getStephenSenatoreRepId();
  if (!stephenRepId) return false;

  const { data: row } = await supabase
    .from('rep_assistants')
    .select('id')
    .eq('assistant_email', NO_CHARGE_BOOTH_ASSISTANT_EMAIL)
    .eq('rep_id', stephenRepId)
    .maybeSingle();

  return Boolean(row?.id);
}

/** Katherine must assign Stephen; admins and Stephen may pick any rep. */
export async function noChargeMustAssignStephenRep(actorEmail: string): Promise<boolean> {
  if (await isWhiskyfestAdmin(actorEmail)) return false;
  return actorEmail.trim().toLowerCase() === NO_CHARGE_BOOTH_ASSISTANT_EMAIL;
}

/** Katherine must assign Stephen as sales rep; Stephen may use his own rep or admin pick. */
export async function assertNoChargeBoothAllowed(options: {
  actorEmail: string;
  salesRepId: string | null;
  event: Pick<Event, 'contract_template_profile' | 'workflow_profile'>;
  orderType: string | null | undefined;
  noChargeRequested: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!options.noChargeRequested) return { ok: true };

  if (!(await actorCanUseNoChargeBooth(options.actorEmail))) {
    return { ok: false, error: 'No-charge booth contracts are not available for this user.' };
  }

  if (isNyweVendorEvent(options.event)) {
    return { ok: false, error: 'No-charge booth is only available for WhiskyFest contracts.' };
  }

  if (options.orderType === 'sponsorship_only') {
    return { ok: false, error: 'No-charge booth applies to booth deals, not sponsorship-only.' };
  }

  if (await noChargeMustAssignStephenRep(options.actorEmail)) {
    const stephenRepId = await getStephenSenatoreRepId();
    if (!stephenRepId || options.salesRepId !== stephenRepId) {
      return {
        ok: false,
        error: 'No-charge contracts must be assigned to Stephen Senatore as sales rep.',
      };
    }
  }

  return { ok: true };
}

export function noChargeBoothFieldsForInsert(actorEmail: string): {
  no_charge_booth: true;
  booth_rate_cents: 0;
  discount_approved_at: string;
  discount_approved_by: string;
  discount_approval_reason: string;
  invoice_status: 'not_invoiced';
} {
  const now = new Date().toISOString();
  return {
    no_charge_booth: true,
    booth_rate_cents: 0,
    discount_approved_at: now,
    discount_approved_by: actorEmail,
    discount_approval_reason: NO_CHARGE_DISCOUNT_REASON,
    invoice_status: 'not_invoiced',
  };
}
