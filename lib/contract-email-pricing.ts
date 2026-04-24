import { formatCurrency } from '@/lib/utils';

export type ContractPricingEmailFields = {
  booth_subtotal_cents: number;
  line_items_subtotal_cents?: number | null;
  grand_total_cents: number;
};

/** Plain-text lines for notification bodies. */
export function contractPricingTextLines(c: ContractPricingEmailFields): string[] {
  const li = c.line_items_subtotal_cents ?? 0;
  if (li <= 0) return [`Total: ${formatCurrency(c.grand_total_cents)}`];
  return [
    `Booth package: ${formatCurrency(c.booth_subtotal_cents)}`,
    `Line items: ${formatCurrency(li)}`,
    `Total: ${formatCurrency(c.grand_total_cents)}`,
  ];
}

/** Compact HTML fragment (no outer wrapper). */
export function contractPricingHtmlFragment(c: ContractPricingEmailFields): string {
  const li = c.line_items_subtotal_cents ?? 0;
  if (li <= 0) {
    return `<p><strong>Total:</strong> ${formatCurrency(c.grand_total_cents)}</p>`;
  }
  return `<p style="margin-top:12px;line-height:1.65;">
    <strong>Booth package:</strong> ${formatCurrency(c.booth_subtotal_cents)}<br/>
    <strong>Line items:</strong> ${formatCurrency(li)}<br/>
    <strong>Total:</strong> ${formatCurrency(c.grand_total_cents)}
  </p>`;
}
