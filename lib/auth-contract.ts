import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessibleSalesRepIds } from '@/lib/rep-access';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import type { Contract, ContractStatus, ContractWithTotals } from '@/types/db';

export interface AppUserRow {
  email: string;
  role: string;
  is_active: boolean;
  name: string | null;
  is_events_team: boolean;
  is_accounting: boolean;
  can_view_all_sales: boolean;
}

/** Own sales_reps row id if any; union with accessibleSalesRepIds for scoped access. */
export interface ContractActorContext {
  email: string;
  appUser: AppUserRow;
  isAdmin: boolean;
  isEventsTeam: boolean;
  isAccounting: boolean;
  canViewAllSales: boolean;
  salesRepId: string | null;
  /** Own rep id plus any reps this user assists (unique). */
  accessibleSalesRepIds: string[];
}

function jsonErr(status: number, msg: string) {
  return { ok: false as const, response: NextResponse.json({ error: msg }, { status }) };
}

export async function resolveContractActor(session: Session | null): Promise<
  | { ok: true; actor: ContractActorContext }
  | { ok: false; response: NextResponse }
> {
  if (!session?.user?.email) return jsonErr(401, 'Unauthorized');

  const emailEff = getEffectiveUserEmail(session);
  if (!emailEff) return jsonErr(401, 'Unauthorized');

  const email = emailEff;
  const supabase = getSupabaseAdmin();
  const { data: appUser, error } = await supabase
    .from('app_users')
    .select('email, role, is_active, name, is_events_team, is_accounting, can_view_all_sales')
    .eq('email', email)
    .single();

  if (error || !appUser) return jsonErr(401, 'Unauthorized');
  if (!appUser.is_active) return jsonErr(401, 'Unauthorized');

  const isAdmin = appUser.role === 'admin';
  const isEventsTeam = Boolean((appUser as { is_events_team?: boolean }).is_events_team);
  const isAccounting = Boolean((appUser as { is_accounting?: boolean }).is_accounting);
  const canViewAllSales =
    isAdmin || isEventsTeam || isAccounting || Boolean((appUser as { can_view_all_sales?: boolean }).can_view_all_sales);

  let salesRepId: string | null = null;
  const { data: sr } = await supabase
    .from('sales_reps')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  salesRepId = sr?.id ?? null;

  const accessibleSalesRepIds = await getAccessibleSalesRepIds(email, supabase);

  if (!canViewAllSales && accessibleSalesRepIds.length === 0) {
    return jsonErr(403, 'Not a registered rep or assistant');
  }

  return {
    ok: true,
    actor: {
      email,
      appUser: {
        ...(appUser as object),
        is_events_team: isEventsTeam,
      } as AppUserRow,
      isAdmin,
      isEventsTeam,
      isAccounting,
      canViewAllSales,
      salesRepId,
      accessibleSalesRepIds,
    },
  };
}

export async function assertContractAccess(
  session: Session | null,
  contractId: string,
  opts?: {
    adminOnly?: boolean;
    /** When set, skips the non-admin ownership check (normally non-admins must match contract.sales_rep_id). */
    skipOwnership?: boolean;
    requireDraft?: boolean;
    allowedStatuses?: ContractStatus[];
  },
): Promise<
  | { ok: true; actor: ContractActorContext; contract: Contract }
  | { ok: false; response: NextResponse }
> {
  const r = await resolveContractActor(session);
  if (!r.ok) return r;

  const { actor } = r;
  const supabase = getSupabaseAdmin();

  const { data: contract, error } = await supabase.from('contracts').select('*').eq('id', contractId).single();

  if (error || !contract) return jsonErr(404, 'Contract not found');

  const c = contract as Contract;

  if (opts?.adminOnly && !actor.isAdmin) {
    return jsonErr(403, 'Forbidden');
  }

  const mustOwn = !actor.canViewAllSales && !opts?.skipOwnership;
  if (mustOwn) {
    const oid = c.sales_rep_id;
    if (!oid || !actor.accessibleSalesRepIds.includes(oid)) {
      return jsonErr(403, 'Forbidden');
    }
  }

  if (opts?.requireDraft && c.status !== 'draft') {
    return jsonErr(403, 'Contract must be in draft status');
  }

  if (opts?.allowedStatuses?.length && !opts.allowedStatuses.includes(c.status as ContractStatus)) {
    return jsonErr(409, `Invalid status for this action: ${c.status}`);
  }

  return { ok: true, actor, contract: c };
}

/**
 * Contract PDF redirects (same audience as contract detail): reps/admins/events team,
 * plus accounting users for executed contracts only.
 */
export async function assertContractPdfAccess(
  session: Session | null,
  contractId: string,
): Promise<{ ok: true; contract: Contract } | { ok: false; response: NextResponse }> {
  if (!session?.user?.email) return jsonErr(401, 'Unauthorized');
  const emailEff = getEffectiveUserEmail(session);
  if (!emailEff) return jsonErr(401, 'Unauthorized');

  const supabase = getSupabaseAdmin();
  const { data: appUser, error: uerr } = await supabase
    .from('app_users')
    .select('role, is_active, is_events_team, is_accounting')
    .eq('email', emailEff)
    .single();

  if (uerr || !appUser?.is_active) return jsonErr(401, 'Unauthorized');

  const { data: contract, error: cerr } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();

  if (cerr || !contract) return jsonErr(404, 'Contract not found');
  const c = contract as Contract;

  const isAdmin = appUser.role === 'admin';
  const isEventsTeam = Boolean((appUser as { is_events_team?: boolean }).is_events_team);
  const isAccounting = Boolean((appUser as { is_accounting?: boolean }).is_accounting);

  if (isAdmin || isEventsTeam) return { ok: true, contract: c };
  if (isAccounting && c.status === 'executed') return { ok: true, contract: c };

  const accessibleSalesRepIds = await getAccessibleSalesRepIds(emailEff, supabase);
  const sid = c.sales_rep_id;
  if (sid && accessibleSalesRepIds.includes(sid)) return { ok: true, contract: c };

  return jsonErr(403, 'Forbidden');
}

/** Server pages: login redirect for inactive; non-admins must have ≥1 accessible rep id. */
export interface PageContractActor {
  email: string;
  isAdmin: boolean;
  isEventsTeam: boolean;
  isAccounting: boolean;
  canViewAllSales: boolean;
  salesRepId: string | null;
  accessibleSalesRepIds: string[];
  role: string;
}

export async function requireContractActorForPage(): Promise<PageContractActor> {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');

  const emailEff = getEffectiveUserEmail(session);
  if (!emailEff) redirect('/auth/login');

  const email = emailEff;
  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, is_active, is_events_team, is_accounting, can_view_all_sales')
    .eq('email', email)
    .single();

  if (!appUser?.is_active) redirect('/auth/login');

  const isAdmin = appUser.role === 'admin';
  const isEventsTeam = Boolean(appUser.is_events_team);
  const isAccounting = Boolean((appUser as { is_accounting?: boolean }).is_accounting);
  const canViewAllSales =
    isAdmin || isEventsTeam || isAccounting || Boolean((appUser as { can_view_all_sales?: boolean }).can_view_all_sales);

  let salesRepId: string | null = null;
  const { data: sr } = await supabase
    .from('sales_reps')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  salesRepId = sr?.id ?? null;

  const accessibleSalesRepIds = await getAccessibleSalesRepIds(email, supabase);

  if (!canViewAllSales && accessibleSalesRepIds.length === 0) {
    redirect('/auth/login');
  }

  return {
    email,
    isAdmin,
    isEventsTeam,
    isAccounting,
    canViewAllSales,
    salesRepId,
    accessibleSalesRepIds,
    role: appUser.role,
  };
}

export async function getContractWithTotalsForViewer(
  contractId: string,
): Promise<{ actor: PageContractActor; contract: ContractWithTotals } | null> {
  const actor = await requireContractActorForPage();
  const supabase = getSupabaseAdmin();

  const { data: contract, error } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contractId)
    .single();

  if (error || !contract) return null;

  const row = contract as ContractWithTotals;
  const sid = row.sales_rep_id;
  const canViewAll = actor.canViewAllSales;
  if (!canViewAll && (!sid || !actor.accessibleSalesRepIds.includes(sid))) return null;

  return { actor, contract: row };
}
