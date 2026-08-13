import { isEventsManagedWorkflow, isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import {
  NO_CHARGE_BOOTH_ASSISTANT_EMAIL,
  NO_CHARGE_BOOTH_OWNER_EMAIL,
} from '@/lib/no-charge-booth';
import { NYWE_COUNTERSIGNER_EMAILS } from '@/lib/nywe-countersigner';
import { notificationExcludedEmailSet } from '@/lib/notification-exclusions';
import { PRODUCT_WHISKYFEST } from '@/lib/product-portal';
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
  whiskyfest: boolean;
  countersignerEmail: string | null;
}> {
  if (ctx.event?.workflow_profile != null || ctx.event?.product_key != null) {
    const event = ctx.event as Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>;
    return {
      eventsManaged: isEventsManagedWorkflow(event),
      nywe: isNyweEventsManagedEvent(event),
      whiskyfest: (event.product_key ?? '').toLowerCase() === PRODUCT_WHISKYFEST,
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

/**
 * Kate / Stephen: only a short allowlist of workflow emails (not approved / mid-funnel noise).
 * Override with WHISKYFEST_KATE_NOTIFICATION_KINDS / WHISKYFEST_STEVE_NOTIFICATION_KINDS
 * (comma-separated kinds). Empty Steve env value = no workflow emails for Stephen.
 */
const DEFAULT_KATE_NOTIFICATION_KINDS: NotificationKind[] = ['contract_executed', 'invoice_sent'];
const DEFAULT_STEVE_NOTIFICATION_KINDS: NotificationKind[] = ['contract_executed'];

function parseKindList(raw: string | undefined, fallback: NotificationKind[]): Set<NotificationKind> {
  if (raw === undefined) return new Set(fallback);
  const trimmed = raw.trim();
  if (!trimmed) return new Set();
  return new Set(
    trimmed
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) as NotificationKind[],
  );
}

/** Email → allowed notification kinds. Unlisted emails are unrestricted. */
export function quietRecipientAllowlists(): Map<string, Set<NotificationKind>> {
  const map = new Map<string, Set<NotificationKind>>();
  map.set(
    NO_CHARGE_BOOTH_ASSISTANT_EMAIL.toLowerCase(),
    parseKindList(process.env['WHISKYFEST_KATE_NOTIFICATION_KINDS'], DEFAULT_KATE_NOTIFICATION_KINDS),
  );
  map.set(
    NO_CHARGE_BOOTH_OWNER_EMAIL.toLowerCase(),
    parseKindList(process.env['WHISKYFEST_STEVE_NOTIFICATION_KINDS'], DEFAULT_STEVE_NOTIFICATION_KINDS),
  );
  return map;
}

/**
 * Strip Kate/Steve from kinds they opted out of. If TO is emptied, promote from CC/BCC.
 * If nobody remains, skip the send.
 * Also strips hardcoded / env notification blocks (e.g. Connie).
 */
export function applyQuietRecipientPolicy(
  kind: NotificationKind,
  routed: ResolvedRecipients,
): ResolvedRecipients {
  if (routed.skip) return routed;
  const allow = quietRecipientAllowlists();
  const blocked = notificationExcludedEmailSet();

  const keep = (email: string) => {
    const e = email.trim().toLowerCase();
    if (blocked.has(e)) return false;
    const allowed = allow.get(e);
    if (!allowed) return true;
    return allowed.has(kind);
  };

  let to = uniq(routed.to.filter(keep));
  let cc = uniq(routed.cc.filter(keep));
  let bcc = uniq(routed.bcc.filter(keep));

  if (to.length === 0) {
    const pool = [...cc, ...bcc];
    if (pool.length === 0) {
      return {
        skip: true,
        skipReason: `No recipients after quiet-recipient filter (${kind})`,
        to: [],
        cc: [],
        bcc: [],
      };
    }
    to = [pool[0]!];
    const taken = new Set(to.map((e) => e.toLowerCase()));
    cc = cc.filter((e) => !taken.has(e.toLowerCase()));
    bcc = bcc.filter((e) => !taken.has(e.toLowerCase()));
  }

  const toSet = new Set(to.map((e) => e.toLowerCase()));
  cc = cc.filter((e) => !toSet.has(e.toLowerCase()));
  const ccSet = new Set(cc.map((e) => e.toLowerCase()));
  bcc = bcc.filter((e) => !toSet.has(e.toLowerCase()) && !ccSet.has(e.toLowerCase()));

  return { skip: false, to, cc, bcc };
}

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
  return new Set([...NYWE_COUNTERSIGNER_EMAILS, ...notificationExcludedEmailSet()]);
}

function countersignerExcluded(): Set<string> {
  return globalExcluded();
}

/** Susannah is NYWE-only — strip her from WhiskyFest / Big Smoke internal notification lists. */
function excludeNyweOnlyRecipients(emails: string[], nywe: boolean): string[] {
  if (nywe) return emails;
  return exclude(emails, NYWE_COUNTERSIGNER_EMAILS);
}

async function loadEventWorkflow(eventId: string | null | undefined): Promise<{
  eventsManaged: boolean;
  nywe: boolean;
  whiskyfest: boolean;
  countersignerEmail: string | null;
}> {
  if (!eventId) return { eventsManaged: false, nywe: false, whiskyfest: false, countersignerEmail: null };

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('workflow_profile, product_key, shanken_signatory_email')
    .eq('id', eventId)
    .maybeSingle<Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>>();

  if (!event) return { eventsManaged: false, nywe: false, whiskyfest: false, countersignerEmail: null };

  const eventsManaged = isEventsManagedWorkflow(event);
  const nywe = isNyweEventsManagedEvent(event);
  const whiskyfest = (event.product_key ?? '').toLowerCase() === PRODUCT_WHISKYFEST;
  const countersignerEmail = event.shanken_signatory_email?.trim().toLowerCase() || null;

  return { eventsManaged, nywe, whiskyfest, countersignerEmail };
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
    // Admins only. Exclude opted-out ops + hardcoded blocks (Connie) + NYWE-only countersigner.
    const blocked = new Set([...notificationExcludedEmailSet(), ...NYWE_COUNTERSIGNER_EMAILS]);
    const admins = exclude(await getAdminEmails(), blocked);
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
    const team = excludeNyweOnlyRecipients(await getActiveEventsTeamEmails(), false);
    const rep = await getSalesRepEmail(ctx.salesRepId);
    const to = rep ? [rep] : team.slice(0, 1);
    const bcc = exclude(rep ? team : team.slice(1), new Set(to));
    return { skip: to.length === 0 && bcc.length === 0, to, cc: [], bcc };
  }

  /**
   * All products: alert deal owner when status becomes executed (handed to AR).
   * TO = assigned sales rep when present, else creator.
   * CC = creator when different from TO.
   * WhiskyFest only: always CC Katherine Brumley for every rep's deals.
   * Assistants are merged by the caller via mergeAssistantCc.
   * Quiet-recipient policy then limits Kate to executed + invoice_sent (Steve: executed only).
   */
  if (kind === 'contract_executed') {
    const rep = await getSalesRepEmail(ctx.salesRepId);
    const createdBy = await resolvedCreatedBy(ctx);
    const owner = rep ?? createdBy;
    if (!owner) return empty('No sales rep or creator for executed alert');
    const cc: string[] = [];
    if (createdBy && createdBy !== owner.toLowerCase()) cc.push(createdBy);
    if (wf.whiskyfest) {
      const kate = NO_CHARGE_BOOTH_ASSISTANT_EMAIL.toLowerCase();
      if (kate !== owner.toLowerCase() && !cc.includes(kate)) cc.push(kate);
    }
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
    const team = excludeNyweOnlyRecipients(await getActiveEventsTeamEmails(), false);
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
    const team = excludeNyweOnlyRecipients(await getActiveEventsTeamEmails(), false);
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
    const cc: string[] = [];
    // Mirror executed alerts: Kate gets invoice-sent for all WhiskyFest deals (not invoice-paid).
    if (kind === 'invoice_sent' && wf.whiskyfest) {
      const kate = NO_CHARGE_BOOTH_ASSISTANT_EMAIL.toLowerCase();
      if (kate !== rep.toLowerCase()) cc.push(kate);
    }
    return { skip: false, to: [rep], cc, bcc: [] };
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
