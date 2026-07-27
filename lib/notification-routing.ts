import { isEventsManagedWorkflow, isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { NYWE_COUNTERSIGNER_EMAILS } from '@/lib/nywe-countersigner';
import { WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS } from '@/lib/wf-bslv-countersigner';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

/** Internal SendGrid notification categories — each has explicit routing rules. */
export type NotificationKind =
  | 'discount_request'
  | 'discount_approved'
  | 'partial_signature'
  | 'fully_signed'
  | 'contract_executed'
  | 'pending_review'
  | 'events_approved'
  | 'contract_recalled'
  | 'contract_sent_back'
  | 'contract_voided'
  | 'contract_voided_visibility'
  | 'invoice_sent'
  | 'invoice_paid';

export type ContractNotificationContext = {
  contractId?: string;
  eventId?: string | null;
  salesRepId?: string | null;
  createdBy?: string | null;
  event?: Partial<Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>> | null;
};

async function resolveWorkflow(ctx: ContractNotificationContext): Promise<{
  eventsManaged: boolean;
  nywe: boolean;
  countersignerEmail: string | null;
}> {
  if (ctx.event?.workflow_profile != null) {
    const event = ctx.event as Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>;
    return {
      eventsManaged: isEventsManagedWorkflow(event),
      nywe: isNyweEventsManagedEvent(event),
      countersignerEmail: event.shanken_signatory_email?.trim().toLowerCase() || null,
    };
  }
  return loadEventWorkflow(ctx.eventId);
}

export type ResolvedRecipients = {
  /** When true, skip SendGrid entirely (DocuSign or auto-release already handled it). */
  skip: boolean;
  skipReason?: string;
  to: string[];
  cc: string[];
  bcc: string[];
};

function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

function uniq(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

function exclude(emails: string[], blocked: Set<string>): string[] {
  return emails.filter((e) => !blocked.has(e.toLowerCase()));
}

function nyweOpsInbox(): string[] {
  return parseEmailList(
    process.env['NYWE_OPS_NOTIFICATION_EMAILS'] ??
      process.env['EVENTS_MANAGED_INVOICE_NOTIFICATION_EMAILS'],
  );
}

function nyweReviewInbox(): string[] {
  return parseEmailList(process.env['NYWE_EVENTS_REVIEW_EMAILS']);
}

function globalExcluded(): Set<string> {
  return new Set([...NYWE_COUNTERSIGNER_EMAILS, ...parseEmailList(process.env['NOTIFICATION_EXCLUDED_EMAILS'])]);
}

function countersignerExcluded(): Set<string> {
  return globalExcluded();
}

async function loadEventWorkflow(eventId: string | null | undefined): Promise<{
  eventsManaged: boolean;
  nywe: boolean;
  countersignerEmail: string | null;
}> {
  if (!eventId) return { eventsManaged: false, nywe: false, countersignerEmail: null };

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('workflow_profile, product_key, shanken_signatory_email')
    .eq('id', eventId)
    .maybeSingle<Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>>();

  if (!event) return { eventsManaged: false, nywe: false, countersignerEmail: null };

  const eventsManaged = isEventsManagedWorkflow(event);
  const nywe = isNyweEventsManagedEvent(event);
  const countersignerEmail = event.shanken_signatory_email?.trim().toLowerCase() || null;

  return { eventsManaged, nywe, countersignerEmail };
}

async function getActiveEventsTeamEmails(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: members } = await supabase
    .from('app_users')
    .select('email')
    .eq('is_events_team', true)
    .eq('is_active', true);

  return uniq((members ?? []).map((m) => String((m as { email: string }).email ?? '')));
}

async function getSalesRepEmail(salesRepId: string | null | undefined): Promise<string | null> {
  if (!salesRepId) return null;
  const supabase = getSupabaseAdmin();
  const { data: rep } = await supabase.from('sales_reps').select('email').eq('id', salesRepId).maybeSingle();
  return rep?.email?.trim().toLowerCase() ?? null;
}

async function getAdminEmails(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: admins } = await supabase
    .from('app_users')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true);

  return uniq((admins ?? []).map((a) => String((a as { email: string }).email ?? '')));
}

/** Prefer sales rep on WhiskyFest deals; roster creator on NYWE / events-managed. */
async function contractOwnerEmail(ctx: ContractNotificationContext, wf: { eventsManaged: boolean }): Promise<string | null> {
  if (!wf.eventsManaged) {
    return getSalesRepEmail(ctx.salesRepId);
  }
  let createdBy = ctx.createdBy?.trim().toLowerCase();
  if (!createdBy && ctx.contractId) {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase.from('contracts').select('created_by').eq('id', ctx.contractId).maybeSingle();
    createdBy = row?.created_by?.trim().toLowerCase() ?? undefined;
  }
  return createdBy ?? null;
}

async function resolvedCreatedBy(ctx: ContractNotificationContext): Promise<string | null> {
  if (ctx.createdBy?.trim()) return ctx.createdBy.trim().toLowerCase();
  if (!ctx.contractId) return null;
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase.from('contracts').select('created_by').eq('id', ctx.contractId).maybeSingle();
  return row?.created_by?.trim().toLowerCase() ?? null;
}

/**
 * Resolve who should receive an internal notification.
 * NYWE routes are narrow (ops inbox / owner / review queue). WhiskyFest keeps rep + events team where appropriate.
 */
export async function resolveNotificationRecipients(
  kind: NotificationKind,
  ctx: ContractNotificationContext,
): Promise<ResolvedRecipients> {
  const wf = await resolveWorkflow(ctx);

  const empty = (skipReason?: string): ResolvedRecipients => ({
    skip: Boolean(skipReason),
    skipReason,
    to: [],
    cc: [],
    bcc: [],
  });

  if (kind === 'discount_request') {
    // Exclude ops who opted out of discount mail (NOTIFICATION_EXCLUDED_EMAILS).
    // Do not use countersignerExcluded() — that would drop Susannah from WhiskyFest discount alerts.
    const admins = exclude(await getAdminEmails(), new Set(parseEmailList(process.env['NOTIFICATION_EXCLUDED_EMAILS'])));
    return admins.length ? { skip: false, to: admins, cc: [], bcc: [] } : empty('No admin recipients');
  }

  if (kind === 'partial_signature') {
    if (wf.nywe) {
      return empty('NYWE exhibitor signed — countersigner action is via DocuSign only');
    }
    // WhiskyFest / Big Smoke: Liz, Nicole, Tobi (+ admins on BCC). Susannah is NYWE-only.
    const to = [...WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS];
    const team = exclude(await getActiveEventsTeamEmails(), countersignerExcluded());
    const rep = await getSalesRepEmail(ctx.salesRepId);
    const bcc = exclude(uniq([...(rep ? [rep] : []), ...team]), new Set(to));
    return { skip: false, to, cc: [], bcc };
  }

  if (kind === 'fully_signed') {
    if (wf.nywe) {
      return empty('NYWE countersigned — auto-release handles accounting handoff');
    }
    const team = await getActiveEventsTeamEmails();
    const rep = await getSalesRepEmail(ctx.salesRepId);
    const to = rep ? [rep] : team.slice(0, 1);
    const bcc = exclude(rep ? team : team.slice(1), new Set(to));
    return { skip: to.length === 0 && bcc.length === 0, to, cc: [], bcc };
  }

  /**
   * All products: alert deal owner when status becomes executed (handed to AR).
   * TO = assigned sales rep when present, else creator.
   * CC = creator when different from TO (e.g. Katherine creates Stephen/Jody deals).
   * Assistants are merged by the caller via mergeAssistantCc (Katherine → Stephen & Jody).
   */
  if (kind === 'contract_executed') {
    const rep = await getSalesRepEmail(ctx.salesRepId);
    const createdBy = await resolvedCreatedBy(ctx);
    const owner = rep ?? createdBy;
    if (!owner) return empty('No sales rep or creator for executed alert');
    const cc =
      createdBy && createdBy !== owner.toLowerCase() ? [createdBy] : [];
    return { skip: false, to: [owner], cc, bcc: [] };
  }

  if (kind === 'pending_review') {
    if (wf.nywe) {
      const configured = nyweReviewInbox();
      const fallback = wf.countersignerEmail ? [wf.countersignerEmail] : [];
      const owner = await resolvedCreatedBy(ctx);
      const candidates = configured.length > 0 ? configured : fallback.length > 0 ? fallback : owner ? [owner] : [];
      const to = candidates.slice(0, 1);
      const bcc = exclude(candidates.slice(1), new Set(to));
      return { skip: to.length === 0, to, cc: [], bcc };
    }
    const team = await getActiveEventsTeamEmails();
    return team.length
      ? { skip: false, to: [team[0]!], cc: [], bcc: team.slice(1) }
      : empty('No events team recipients');
  }

  if (
    kind === 'events_approved' ||
    kind === 'contract_recalled' ||
    kind === 'contract_sent_back' ||
    kind === 'contract_voided' ||
    kind === 'discount_approved'
  ) {
    const owner = await contractOwnerEmail(ctx, wf);
    if (!owner) return empty('No contract owner / sales rep');
    return { skip: false, to: [owner], cc: [], bcc: [] };
  }

  if (kind === 'contract_voided_visibility') {
    if (wf.nywe) {
      const ops = exclude(nyweOpsInbox(), countersignerExcluded());
      return ops.length
        ? { skip: false, to: [ops[0]!], cc: [], bcc: ops.slice(1) }
        : empty('No NYWE void visibility recipients');
    }
    const team = await getActiveEventsTeamEmails();
    return team.length
      ? { skip: false, to: [team[0]!], cc: [], bcc: team.slice(1) }
      : empty('No events team recipients');
  }

  if (kind === 'invoice_sent' || kind === 'invoice_paid') {
    const blocked = countersignerExcluded();
    if (wf.eventsManaged) {
      const ops = exclude(nyweOpsInbox(), blocked);
      const owner = await resolvedCreatedBy(ctx);
      const candidates = ops.length > 0 ? ops : owner && !blocked.has(owner) ? [owner] : [];
      return candidates.length
        ? { skip: false, to: [candidates[0]!], cc: [], bcc: candidates.slice(1) }
        : empty('No NYWE invoice notification recipients');
    }
    const rep = await getSalesRepEmail(ctx.salesRepId);
    if (!rep) return empty('No sales rep');
    return { skip: false, to: [rep], cc: [], bcc: [] };
  }

  return empty('Unknown notification kind');
}

/** Merge assistant CC without duplicating TO/BCC recipients. */
export function mergeAssistantCc(
  routed: ResolvedRecipients,
  assistants: string[],
): ResolvedRecipients {
  const taken = new Set([...routed.to, ...routed.cc, ...routed.bcc].map((e) => e.toLowerCase()));
  const cc = uniq([...routed.cc, ...assistants.filter((a) => !taken.has(a.toLowerCase()))]);
  return { ...routed, cc };
}
