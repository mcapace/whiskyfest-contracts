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
 * Returns DB patch when required exhibitor billing tabs are present; otherwise null.
 */
export function buildExhibitorCaptureDbPatch(map: Record<string, string>): ExhibitorCaptureDbRow | null {
  const billing_contact_name = gv(map, 'billing_contact_name');
  const billing_contact_email = gv(map, 'billing_contact_email');
  const billing_address_line1 = gv(map, 'billing_address_line1');
  const billing_city = gv(map, 'billing_city');
  const billing_state = gv(map, 'billing_state');
  const billing_zip = gv(map, 'billing_zip');
  const billing_country = gv(map, 'billing_country');

  if (
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

  const line2 = gv(map, 'billing_address_line2');
  const eventName = gv(map, 'event_contact_name');
  const eventEmail = gv(map, 'event_contact_email');

  return {
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
