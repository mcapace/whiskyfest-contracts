import type { ContractStatus, ContractWithTotals, Event, SalesRep } from '@/types/db';

/** Exclusive allowlist — Participation report is only for Kate + Michael (builder/tester). */
export const PARTICIPATION_REPORT_ALLOWED_EMAILS = [
  'kbrumley@mshanken.com',
  'mcapace@mshanken.com',
] as const;

export function canAccessParticipationReport(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return (PARTICIPATION_REPORT_ALLOWED_EMAILS as readonly string[]).includes(normalized);
}

export type PipelineSection = 'pending_renewal' | 'new_business';


export type WfPipelineTarget = {
  id: string;
  event_id: string;
  section: PipelineSection;
  company_name: string;
  sales_rep_id: string | null;
  brands_text: string | null;
  booth_count: number;
  rate_per_booth_cents: number;
  sponsorship_cents: number;
  total_spend_cents: number;
  notes: string | null;
  linked_contract_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sales_rep_name?: string | null;
  sales_rep_email?: string | null;
};

/** One display row in the participation report (any section). */
export type ParticipationReportRow = {
  id: string;
  section: 'confirmed' | PipelineSection;
  company_name: string;
  sales_rep_id: string | null;
  sales_rep_name: string | null;
  sales_rep_initials: string;
  brands_text: string;
  booth_count: number;
  rate_per_booth_cents: number;
  sponsorship_label: string;
  sponsorship_cents: number;
  total_spend_cents: number;
  /** Kate’s portal notes (editable). */
  notes: string;
  /** Live notes from Google Sheets (read-only reference). */
  sheet_notes: string;
  /** Pipeline status for pending/new business (contract lifecycle). */
  pipeline_status: string;
  contract_id: string | null;
  contract_status: ContractStatus | null;
  target_id: string | null;
};

export type ParticipationReport = {
  event: Pick<Event, 'id' | 'name' | 'year'>;
  confirmed: ParticipationReportRow[];
  pending: ParticipationReportRow[];
  newBusiness: ParticipationReportRow[];
  totals: {
    confirmedBooths: number;
    confirmedSpendCents: number;
    pendingBooths: number;
    pendingSpendCents: number;
    confirmedPlusPendingBooths: number;
    confirmedPlusPendingSpendCents: number;
  };
  salesReps: Pick<SalesRep, 'id' | 'name' | 'email'>[];
  /** ISO timestamp of last live Google Sheets pull (pending + new business). */
  sheetsFetchedAt: string | null;
  sheetsError: string | null;
};

/** Normalize company names for matching across sheets / contracts. */
export function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|co|company|corp|corporation|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REP_INITIALS: Record<string, string> = {
  'ssenatore@mshanken.com': 'SS',
  'mdichiara@mshanken.com': 'MD',
  'jcohen@mshanken.com': 'JC',
  'aweiss@mshanken.com': 'AW',
  'mmorgenstern@mshanken.com': 'MRS',
  'jspitalnik@mshanken.com': 'JS',
};

const INITIALS_TO_EMAIL: Record<string, string> = {
  SS: 'ssenatore@mshanken.com',
  MD: 'mdichiara@mshanken.com',
  JC: 'jcohen@mshanken.com',
  AW: 'aweiss@mshanken.com',
  MRS: 'mmorgenstern@mshanken.com',
  JS: 'jspitalnik@mshanken.com',
  CM: 'ssenatore@mshanken.com', // legacy Constellation owner → Stephen
};

export function salesRepInitials(name: string | null | undefined, email: string | null | undefined): string {
  const byEmail = email?.trim().toLowerCase();
  if (byEmail && REP_INITIALS[byEmail]) return REP_INITIALS[byEmail];
  const n = (name ?? '').trim();
  if (!n) return '—';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function resolveRepEmailFromInitials(initials: string): string | null {
  const key = initials.trim().toUpperCase();
  return INITIALS_TO_EMAIL[key] ?? null;
}

export function parseMoneyToCents(raw: string | number | null | undefined): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(Math.abs(raw) < 1000 && !Number.isInteger(raw) ? raw * 100 : raw);
  }
  const s = String(raw).replace(/[$,\s]/g, '').trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function parseBoothCount(raw: string | number | null | undefined): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** Statuses that graduate a pending/new-business row into Confirmed. */
export const CONFIRMED_CONTRACT_STATUSES: ContractStatus[] = ['executed'];
export const GRADUATED_CONTRACT_STATUSES: ContractStatus[] = ['signed', 'executed'];

export function contractIsConfirmed(status: ContractStatus): boolean {
  return CONFIRMED_CONTRACT_STATUSES.includes(status);
}

export function contractIsGraduated(status: ContractStatus): boolean {
  return GRADUATED_CONTRACT_STATUSES.includes(status);
}

export function pipelineStatusLabel(contract: ContractWithTotals | null): string {
  if (!contract) return 'No contract';
  switch (contract.status) {
    case 'draft':
    case 'ready_for_review':
    case 'pending_events_review':
    case 'approved':
      return 'Contract in progress';
    case 'sent':
      return 'Contract sent';
    case 'partially_signed':
      return 'Awaiting countersignature';
    case 'signed':
      return 'Fully signed';
    case 'executed':
      return 'Executed';
    case 'cancelled':
    case 'voided':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return contract.status;
  }
}

export function sponsorshipFromContract(contract: ContractWithTotals): {
  label: string;
  cents: number;
} {
  const line = Number(contract.line_items_subtotal_cents ?? 0);
  if (contract.order_type === 'sponsorship_only' || (contract.booth_count === 0 && line > 0)) {
    return { label: line > 0 ? formatSponsorshipLabel(line) : 'Y', cents: line };
  }
  if (line > 0) return { label: formatSponsorshipLabel(line), cents: line };
  return { label: 'N', cents: 0 };
}

function formatSponsorshipLabel(cents: number): string {
  if (cents <= 0) return 'Y';
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function brandsFromContract(contract: ContractWithTotals, boothBrandNames?: string[]): string {
  const fromBooths = (boothBrandNames ?? []).map((b) => b.trim()).filter(Boolean);
  if (fromBooths.length) {
    return fromBooths.map((b, i) => `${i + 1}) ${b}`).join(' ');
  }
  const poured = contract.brands_poured?.trim();
  if (!poured) return '';
  const parts = poured
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return poured;
  return parts.map((b, i) => `${i + 1}) ${b}`).join(' ');
}

export function companiesMatch(a: string, b: string): boolean {
  const ka = normalizeCompanyKey(a);
  const kb = normalizeCompanyKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  // Jim Beam / Suntory aliases
  const aliases: [string, string][] = [
    ['jim beam brands', 'suntory global spirits'],
    ['remy', 'remy cointreau'],
    ['oliva cigar', 'oliva cigars'],
    ['padron cigars', 'padrón cigars'],
    ['ej gallo', 'gallo'],
    ['foley family wines', 'foley family wines spirits'],
    ['marussia beverages', 'torabhaig hatozaki'],
  ];
  for (const [x, y] of aliases) {
    if ((ka.includes(x) && kb.includes(y)) || (ka.includes(y) && kb.includes(x))) return true;
    if ((ka.includes(x) && kb.includes(x)) || (ka.includes(y) && kb.includes(y))) return true;
  }
  return false;
}
