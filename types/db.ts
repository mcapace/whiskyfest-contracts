// Database types — mirrors supabase/schema.sql
// Regenerate with `supabase gen types typescript` when the schema changes.

export type ContractStatus =
  | 'draft'
  | 'ready_for_review'
  | 'pending_events_review'
  | 'approved'
  | 'sent'
  | 'partially_signed'
  | 'signed'
  | 'executed'
  | 'voided'
  | 'cancelled'
  | 'error';

export type InvoiceStatus = 'pending' | 'invoice_sent' | 'paid';

export type UserRole = 'admin' | 'sales' | 'sales_rep' | 'viewer';

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
  exhibitor_address_line1: string | null;
  exhibitor_address_line2: string | null;
  exhibitor_city: string | null;
  exhibitor_state: string | null;
  exhibitor_zip: string | null;
  exhibitor_country: string | null;
  exhibitor_telephone: string | null;
  brands_poured: string | null;
  booth_count: number;
  booth_rate_cents: number;
  additional_brand_count: number;
  signer_1_name: string | null;
  signer_1_title: string | null;
  signer_1_email: string | null;
  sales_rep_id: string | null;
  draft_pdf_drive_id: string | null;
  draft_pdf_url: string | null;
  /** Primary PDF in Supabase Storage: `{contract_id}/draft.pdf` or `{contract_id}/signed.pdf`. */
  pdf_storage_path: string | null;
  docusign_envelope_id: string | null;
  signed_pdf_drive_id: string | null;
  signed_pdf_url: string | null;
  drafted_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  countersigned_by_email: string | null;
  countersigned_by_name: string | null;
  countersigned_at: string | null;
  executed_at: string | null;
  cancelled_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  voided_reason: string | null;
  discount_approved_at: string | null;
  discount_approved_by: string | null;
  discount_approval_reason: string | null;
  events_submitted_at: string | null;
  events_approved_at: string | null;
  events_approved_by: string | null;
  events_approval_reason: string | null;
  events_sent_back_at: string | null;
  events_sent_back_by: string | null;
  events_sent_back_reason: string | null;
  billing_same_as_corporate: boolean;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  accounting_notified_at: string | null;
  invoice_status: InvoiceStatus;
  invoice_sent_at: string | null;
  invoice_sent_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  accounting_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

export interface ContractWithTotals extends Contract {
  booth_subtotal_cents: number;
  additional_brand_fee_cents: number;
  grand_total_cents: number;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  event?: Event;
}

export interface AuditLogEntry {
  id: number;
  contract_id: string | null;
  actor_email: string | null;
  /** Present for impersonation_started / impersonation_ended rows. */
  impersonation_target_email?: string | null;
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
  is_events_team?: boolean;
  is_accounting?: boolean;
  can_impersonate?: boolean;
  /** Null means system (follow OS until user chooses). */
  theme_preference?: 'light' | 'dark' | 'system' | null;
  created_at: string;
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RepAssistant {
  id: string;
  assistant_email: string;
  rep_id: string;
  created_at: string;
}

