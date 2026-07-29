import {
  accountingDashboardHref,
  PRODUCT_BIG_SMOKE,
  PRODUCT_WHISKYFEST,
  PRODUCT_WINE_SPECTATOR,
  productBasePath,
  productDisplayLabel,
  type ProductKey,
} from '@/lib/product-portal';
import { appBaseUrlForProduct, formatEventDisplayName, sendGridFromForProduct } from '@/lib/product-email';
import { formatInvoiceStatus } from '@/lib/invoice-status';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractStatus, Event, InvoiceStatus } from '@/types/db';

/** Default digest owners — Kate (WF), Jake (Cigar/Big Smoke), Susannah (NYWE). */
export const PRODUCT_DIGEST_DEFAULT_RECIPIENTS: Record<
  typeof PRODUCT_WHISKYFEST | typeof PRODUCT_WINE_SPECTATOR | typeof PRODUCT_BIG_SMOKE,
  { name: string; email: string }
> = {
  [PRODUCT_WHISKYFEST]: { name: 'Kate Brumley', email: 'kbrumley@mshanken.com' },
  [PRODUCT_BIG_SMOKE]: { name: 'Jake Cohen', email: 'jcohen@mshanken.com' },
  [PRODUCT_WINE_SPECTATOR]: { name: 'Susannah Nolan', email: 'snolan@mshanken.com' },
};

const DIGEST_PRODUCTS = [PRODUCT_WHISKYFEST, PRODUCT_BIG_SMOKE, PRODUCT_WINE_SPECTATOR] as const;

function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export function digestRecipientsForProduct(productKey: ProductKey): string[] {
  const envKey =
    productKey === PRODUCT_WINE_SPECTATOR
      ? 'PRODUCT_DIGEST_NYWE_EMAILS'
      : productKey === PRODUCT_BIG_SMOKE
        ? 'PRODUCT_DIGEST_BIG_SMOKE_EMAILS'
        : 'PRODUCT_DIGEST_WHISKYFEST_EMAILS';
  const fromEnv = parseEmailList(process.env[envKey]);
  if (fromEnv.length) return fromEnv;
  const fallback = PRODUCT_DIGEST_DEFAULT_RECIPIENTS[productKey as keyof typeof PRODUCT_DIGEST_DEFAULT_RECIPIENTS];
  return fallback ? [fallback.email] : [];
}

export function digestCcEmails(): string[] {
  return parseEmailList(process.env['PRODUCT_DIGEST_CC_EMAILS']);
}

const PIPELINE_STATUSES: ContractStatus[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'executed',
  'error',
];

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_events_review':
      return 'Events review';
    case 'ready_for_review':
      return 'Ready for review';
    case 'partially_signed':
      return 'Partially signed';
    case 'invoice_sent':
      return 'Invoice sent';
    case 'not_invoiced':
      return 'Do not invoice';
    case 'invoice_voided':
      return 'Invoice voided';
    default:
      return status.replace(/_/g, ' ');
  }
}

export type ProductDigestRow = {
  id: string;
  company: string;
  status: string;
  invoiceStatus: string | null;
  updatedAt: string;
};

export type ProductDigestPayload = {
  productKey: ProductKey;
  productLabel: string;
  eventLabel: string | null;
  portalUrl: string;
  accountingUrl: string;
  statusCounts: Record<string, number>;
  invoiceCounts: Record<string, number>;
  needsAttention: ProductDigestRow[];
  recentlyUpdated: ProductDigestRow[];
  recipients: string[];
  cc: string[];
};

async function loadActiveEvents(productKey: ProductKey): Promise<Event[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', productKey)
    .eq('is_active', true)
    .order('year', { ascending: false });
  return (data ?? []) as Event[];
}

export async function buildProductDigest(
  productKey: ProductKey,
  options?: { recentHours?: number },
): Promise<ProductDigestPayload | null> {
  const recipients = digestRecipientsForProduct(productKey);
  if (recipients.length === 0) return null;

  const events = await loadActiveEvents(productKey);
  const eventIds = events.map((e) => e.id);
  const productLabel = productDisplayLabel(productKey);
  const portalBase = appBaseUrlForProduct(productKey);
  const basePath = productBasePath(productKey);
  const portalUrl = `${portalBase}${basePath || '/'}`;
  const accountingUrl = `${portalBase}${accountingDashboardHref(productKey)}`;

  if (eventIds.length === 0) {
    return {
      productKey,
      productLabel,
      eventLabel: null,
      portalUrl,
      accountingUrl,
      statusCounts: {},
      invoiceCounts: {},
      needsAttention: [],
      recentlyUpdated: [],
      recipients,
      cc: digestCcEmails().filter((e) => !recipients.includes(e)),
    };
  }

  const eventLabel = events
    .map((e) => formatEventDisplayName(e.name, e.year))
    .filter(Boolean)
    .join(', ');

  const supabase = getSupabaseAdmin();
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, status, invoice_status, updated_at')
    .in('event_id', eventIds);

  const statusCounts: Record<string, number> = {};
  const invoiceCounts: Record<string, number> = {};
  const rows: ProductDigestRow[] = [];

  for (const row of contracts ?? []) {
    const status = String(row.status ?? '');
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (status === 'executed') {
      const inv = String(row.invoice_status ?? 'pending');
      invoiceCounts[inv] = (invoiceCounts[inv] ?? 0) + 1;
    }
    rows.push({
      id: row.id as string,
      company: String(row.exhibitor_company_name ?? '—'),
      status,
      invoiceStatus: row.invoice_status ? String(row.invoice_status) : null,
      updatedAt: String(row.updated_at ?? ''),
    });
  }

  const attentionStatuses = new Set([
    'pending_events_review',
    'approved',
    'sent',
    'partially_signed',
    'signed',
    'error',
  ]);
  const needsAttention = rows
    .filter((r) => attentionStatuses.has(r.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 25);

  const recentHours = options?.recentHours ?? 8;
  const cutoff = Date.now() - recentHours * 60 * 60 * 1000;
  const recentlyUpdated = rows
    .filter((r) => {
      const t = Date.parse(r.updatedAt);
      return !Number.isNaN(t) && t >= cutoff && PIPELINE_STATUSES.includes(r.status as ContractStatus);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);

  return {
    productKey,
    productLabel,
    eventLabel: eventLabel || null,
    portalUrl,
    accountingUrl,
    statusCounts,
    invoiceCounts,
    needsAttention,
    recentlyUpdated,
    recipients,
    cc: digestCcEmails().filter((e) => !recipients.includes(e)),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function countLines(counts: Record<string, number>, labelFn: (k: string) => string): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `  ${labelFn(k)}: ${n}`);
}

export function formatProductDigestEmail(payload: ProductDigestPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const when = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const subject = `${payload.productLabel} contracts update — ${when} ET`;

  const statusBlock = countLines(payload.statusCounts, statusLabel);
  const invoiceBlock = countLines(payload.invoiceCounts, (k) => formatInvoiceStatus(k as InvoiceStatus));

  const attentionLines = payload.needsAttention.map(
    (r) => `  • ${r.company} — ${statusLabel(r.status)}`,
  );
  const recentLines = payload.recentlyUpdated.map(
    (r) => `  • ${r.company} — ${statusLabel(r.status)}`,
  );

  const text = [
    `${payload.productLabel} status digest`,
    payload.eventLabel ? `Event: ${payload.eventLabel}` : 'No active event',
    `As of ${when} ET`,
    ``,
    'Pipeline counts:',
    ...(statusBlock.length ? statusBlock : ['  (none)']),
    ``,
    'Executed → invoice:',
    ...(invoiceBlock.length ? invoiceBlock : ['  (none executed)']),
    ``,
    'Needs attention:',
    ...(attentionLines.length ? attentionLines : ['  (none)']),
    ``,
    'Updated in the last ~8 hours:',
    ...(recentLines.length ? recentLines : ['  (none)']),
    ``,
    `Portal: ${payload.portalUrl}`,
    `Accounting: ${payload.accountingUrl}`,
  ].join('\n');

  const statusHtml = statusBlock.length
    ? `<ul>${statusBlock.map((l) => `<li>${escapeHtml(l.trim())}</li>`).join('')}</ul>`
    : '<p>(none)</p>';
  const invoiceHtml = invoiceBlock.length
    ? `<ul>${invoiceBlock.map((l) => `<li>${escapeHtml(l.trim())}</li>`).join('')}</ul>`
    : '<p>(none executed)</p>';
  const attentionHtml = payload.needsAttention.length
    ? `<ul>${payload.needsAttention
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.company)}</strong> — ${escapeHtml(statusLabel(r.status))}</li>`,
        )
        .join('')}</ul>`
    : '<p>(none)</p>';
  const recentHtml = payload.recentlyUpdated.length
    ? `<ul>${payload.recentlyUpdated
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.company)}</strong> — ${escapeHtml(statusLabel(r.status))}</li>`,
        )
        .join('')}</ul>`
    : '<p>(none)</p>';

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px; color: #1a1a1a;">
      <p><strong>${escapeHtml(payload.productLabel)} status digest</strong><br/>
      ${payload.eventLabel ? `Event: ${escapeHtml(payload.eventLabel)}<br/>` : ''}
      As of ${escapeHtml(when)} ET</p>
      <h3 style="margin-bottom:4px;">Pipeline counts</h3>
      ${statusHtml}
      <h3 style="margin-bottom:4px;">Executed → invoice</h3>
      ${invoiceHtml}
      <h3 style="margin-bottom:4px;">Needs attention</h3>
      ${attentionHtml}
      <h3 style="margin-bottom:4px;">Updated in the last ~8 hours</h3>
      ${recentHtml}
      <p style="margin-top:20px;">
        <a href="${escapeHtml(payload.portalUrl)}">Open ${escapeHtml(payload.productLabel)} portal</a><br/>
        <a href="${escapeHtml(payload.accountingUrl)}">Open accounting</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendProductDigest(payload: ProductDigestPayload): Promise<{
  productKey: ProductKey;
  sent: boolean;
  to: string[];
  skippedReason?: string;
}> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    return { productKey: payload.productKey, sent: false, to: [], skippedReason: 'SENDGRID_API_KEY missing' };
  }
  if (payload.recipients.length === 0) {
    return { productKey: payload.productKey, sent: false, to: [], skippedReason: 'No recipients' };
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(apiKey);
  const from = sendGridFromForProduct(payload.productKey);
  const { subject, text, html } = formatProductDigestEmail(payload);

  await sgMail.send({
    to: payload.recipients,
    ...(payload.cc.length ? { cc: payload.cc } : {}),
    from: { email: from.email, name: from.name },
    subject,
    text,
    html,
  });

  return { productKey: payload.productKey, sent: true, to: payload.recipients };
}

/** Build + send digests for all three portals. */
export async function runAllProductStatusDigests(options?: {
  recentHours?: number;
}): Promise<{ results: Awaited<ReturnType<typeof sendProductDigest>>[] }> {
  const results: Awaited<ReturnType<typeof sendProductDigest>>[] = [];
  for (const productKey of DIGEST_PRODUCTS) {
    const payload = await buildProductDigest(productKey, options);
    if (!payload) {
      results.push({ productKey, sent: false, to: [], skippedReason: 'No payload' });
      continue;
    }
    results.push(await sendProductDigest(payload));
  }
  return { results };
}
