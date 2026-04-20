// Database types — mirrors supabase/schema.sql
// Regenerate with `supabase gen types typescript` when the schema changes.

export type ContractStatus =
  | 'draft'
  | 'ready_for_review'
  | 'approved'
  | 'sent'
  | 'signed'
  | 'executed'
  | 'cancelled'
  | 'error';

export type UserRole = 'admin' | 'sales' | 'viewer';

export interface Event {
  id: string;
  name: string;
  tagline: string | null;
  location: string | null;
  event_date: string; // ISO date
  venue: string | null;
  year: number;
  booth_rate_cents: number;
  shanken_signatory_name: string;
  shanken_signatory_title: string;
  shanken_signatory_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  event_id: string;
  status: ContractStatus;
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  exhibitor_address: string | null;
  exhibitor_telephone: string | null;
  brands_poured: string | null;
  booth_count: number;
  booth_rate_cents: number;
  additional_brand_count: number;
  signer_1_name: string | null;
  signer_1_title: string | null;
  signer_1_email: string | null;
  draft_pdf_drive_id: string | null;
  draft_pdf_url: string | null;
  docusign_envelope_id: string | null;
  signed_pdf_drive_id: string | null;
  signed_pdf_url: string | null;
  drafted_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  executed_at: string | null;
  accounting_notified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface ContractWithTotals extends Contract {
  booth_subtotal_cents: number;
  additional_brand_fee_cents: number;
  grand_total_cents: number;
  event?: Event;
}

export interface AuditLogEntry {
  id: number;
  contract_id: string | null;
  actor_email: string | null;
  action: string;
  from_status: ContractStatus | null;
  to_status: ContractStatus | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

export interface AppUser {
  email: string;
  name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// UI-facing status metadata (labels, colors, ordering)
// ---------------------------------------------------------------------------

export const STATUS_META: Record<ContractStatus, { label: string; tone: string; order: number }> = {
  draft:             { label: 'Draft',            tone: 'bg-whisky-100 text-whisky-900 border-whisky-300', order: 1 },
  ready_for_review:  { label: 'Ready for Review', tone: 'bg-amber-100 text-amber-900 border-amber-300',    order: 2 },
  approved:          { label: 'Approved',         tone: 'bg-blue-100 text-blue-900 border-blue-300',       order: 3 },
  sent:              { label: 'Sent',             tone: 'bg-indigo-100 text-indigo-900 border-indigo-300', order: 4 },
  signed:            { label: 'Signed',           tone: 'bg-emerald-50 text-emerald-800 border-emerald-300', order: 5 },
  executed:          { label: 'Executed',         tone: 'bg-emerald-600 text-white border-emerald-700',    order: 6 },
  cancelled:         { label: 'Cancelled',        tone: 'bg-stone-200 text-stone-700 border-stone-300',    order: 7 },
  error:             { label: 'Error',            tone: 'bg-red-100 text-red-900 border-red-300',          order: 8 },
};
