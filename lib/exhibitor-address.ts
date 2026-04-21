import type { Contract } from '@/types/db';

type Addr = Pick<
  Contract,
  | 'exhibitor_address'
  | 'exhibitor_address_line1'
  | 'exhibitor_address_line2'
  | 'exhibitor_city'
  | 'exhibitor_state'
  | 'exhibitor_zip'
>;

/**
 * Single block for Google Doc merge token {{exhibitor_address}} and emails.
 * Prefers structured fields; falls back to legacy exhibitor_address text.
 */
export function formatExhibitorAddressBlock(c: Addr): string {
  const l1 = c.exhibitor_address_line1?.trim();
  const hasStructured = Boolean(l1 || c.exhibitor_city?.trim());
  if (hasStructured) {
    const lines: string[] = [];
    if (l1) lines.push(l1);
    const l2 = c.exhibitor_address_line2?.trim();
    if (l2) lines.push(l2);
    const city = c.exhibitor_city?.trim();
    const st = c.exhibitor_state?.trim();
    const z = c.exhibitor_zip?.trim();
    const tail = [city, [st, z].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (tail) lines.push(tail);
    return lines.join('\n');
  }
  return (c.exhibitor_address ?? '').trim();
}

/** Store legacy single column alongside structured rows (search, exports). */
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
