import {
  fetchEnvelopeSigners,
  fetchRecipientTextTabs,
  type DocuSignSignerRow,
} from '@/lib/docusign';

export function textTabsToLabelMap(tabs: { tabLabel: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tabs) {
    const k = t.tabLabel.trim();
    if (!k) continue;
    out[k] = t.value.trim();
  }
  return out;
}

export type ExhibitorCaptureDbRow = {
  exhibitor_address_line1: string | null;
  exhibitor_address_line2: string | null;
  exhibitor_city: string | null;
  exhibitor_state: string | null;
  exhibitor_zip: string | null;
  exhibitor_country: string | null;
  exhibitor_telephone: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  event_contact_name: string | null;
  event_contact_email: string | null;
  billing_same_as_corporate: boolean;
  exhibitor_fields_captured_at: string;
};

function gv(map: Record<string, string>, k: string): string {
  return (map[k] ?? '').trim();
}

/**
 * Returns DB patch when required mailing + phone + billing tabs are present; otherwise null.
 * `exhibitor_fields_captured_at` marks capture of mailing, phone, billing, and optional event fields together.
 */
export function buildExhibitorCaptureDbPatch(map: Record<string, string>): ExhibitorCaptureDbRow | null {
  const exhibitor_address_line1 = gv(map, 'exhibitor_address_line1');
  const exhibitor_city = gv(map, 'exhibitor_city');
  const exhibitor_state = gv(map, 'exhibitor_state');
  const exhibitor_zip = gv(map, 'exhibitor_zip');
  const exhibitor_country = gv(map, 'exhibitor_country');
  const exhibitor_telephone = gv(map, 'exhibitor_telephone');

  const billing_contact_name = gv(map, 'billing_contact_name');
  const billing_contact_email = gv(map, 'billing_contact_email');
  const billing_address_line1 = gv(map, 'billing_address_line1');
  const billing_city = gv(map, 'billing_city');
  const billing_state = gv(map, 'billing_state');
  const billing_zip = gv(map, 'billing_zip');
  const billing_country = gv(map, 'billing_country');

  if (
    !exhibitor_address_line1 ||
    !exhibitor_city ||
    !exhibitor_state ||
    !exhibitor_zip ||
    !exhibitor_country ||
    !exhibitor_telephone ||
    !billing_contact_name ||
    !billing_contact_email ||
    !billing_address_line1 ||
    !billing_city ||
    !billing_state ||
    !billing_zip ||
    !billing_country
  ) {
    return null;
  }

  const mailLine2 = gv(map, 'exhibitor_address_line2');
  const line2 = gv(map, 'billing_address_line2');
  const eventName = gv(map, 'event_contact_name');
  const eventEmail = gv(map, 'event_contact_email');

  return {
    exhibitor_address_line1,
    exhibitor_address_line2: mailLine2 || null,
    exhibitor_city,
    exhibitor_state,
    exhibitor_zip,
    exhibitor_country,
    exhibitor_telephone,
    billing_contact_name,
    billing_contact_email,
    billing_address_line1,
    billing_address_line2: line2 || null,
    billing_city,
    billing_state,
    billing_zip,
    billing_country,
    event_contact_name: eventName || null,
    event_contact_email: eventEmail || null,
    billing_same_as_corporate: false,
    exhibitor_fields_captured_at: new Date().toISOString(),
  };
}

/**
 * Read exhibitor (routing order 1) DocuSign text tabs and build a DB capture patch.
 * Returns null when required tabs are incomplete or DocuSign fetch fails.
 */
export async function fetchExhibitorCaptureFromEnvelope(
  envelopeId: string,
  signers?: DocuSignSignerRow[],
): Promise<ExhibitorCaptureDbRow | null> {
  try {
    const rows = signers ?? (await fetchEnvelopeSigners(envelopeId));
    const exhibitor = rows.find((s) => s.routingOrder === '1') ?? rows[0];
    const exhibitorRecipientId = exhibitor?.recipientId?.trim() || '1';
    const tabs = await fetchRecipientTextTabs(envelopeId, exhibitorRecipientId);
    return buildExhibitorCaptureDbPatch(textTabsToLabelMap(tabs));
  } catch (e) {
    console.error('[docusign-sync] exhibitor tabs fetch failed', {
      envelopeId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
