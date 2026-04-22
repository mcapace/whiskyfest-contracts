import type { Contract } from '@/types/db';

type Addr = Pick<
  Contract,
  | 'exhibitor_address_line1'
  | 'exhibitor_address_line2'
  | 'exhibitor_city'
  | 'exhibitor_state'
  | 'exhibitor_zip'
  | 'exhibitor_country'
>;

type BillingAddr = Pick<
  Contract,
  | 'billing_address_line1'
  | 'billing_address_line2'
  | 'billing_city'
  | 'billing_state'
  | 'billing_zip'
  | 'billing_country'
>;

/**
 * Build multi-line address for merge/email consumption.
 * Format:
 *  line 1
 *  City, ST ZIP
 *  Country (only when non-US)
 */
/** Invoice / AP mailing — same formatting rules as corporate mailing address. */
export function formatBillingAddressBlock(c: BillingAddr): string {
  const lines: string[] = [];

  const l1 = c.billing_address_line1?.trim();
  if (l1) lines.push(l1);

  const l2 = c.billing_address_line2?.trim();
  if (l2) lines.push(l2);

  const city = c.billing_city?.trim();
  const st = c.billing_state?.trim();
  const z = c.billing_zip?.trim();
  const cityStateZip = [
    city,
    [st, z].filter(Boolean).join(' ').trim() || null,
  ].filter(Boolean).join(', ');
  if (cityStateZip) lines.push(cityStateZip);

  const country = c.billing_country?.trim();
  if (country && country !== 'United States') lines.push(country);

  return lines.join('\n').trim();
}

export function formatExhibitorAddressBlock(c: Addr): string {
  const lines: string[] = [];

  const l1 = c.exhibitor_address_line1?.trim();
  if (l1) lines.push(l1);

  const l2 = c.exhibitor_address_line2?.trim();
  if (l2) lines.push(l2);

  const city = c.exhibitor_city?.trim();
  const st = c.exhibitor_state?.trim();
  const z = c.exhibitor_zip?.trim();
  const cityStateZip = [
    city,
    [st, z].filter(Boolean).join(' ').trim() || null,
  ].filter(Boolean).join(', ');
  if (cityStateZip) lines.push(cityStateZip);

  const country = c.exhibitor_country?.trim();
  if (country && country !== 'United States') lines.push(country);

  return lines.join('\n').trim();
}

/** Canonical formatted address string for display and merges. */
export function canonicalExhibitorAddress(c: Addr): string {
  return formatExhibitorAddressBlock(c);
}

export const US_STATE_CODES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];
