import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export function PersonalSalesSummary({
  contractsSigned,
  totalValueCents,
}: {
  contractsSigned: number;
  totalValueCents: number;
}) {
  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">Your performance</h3>
        <p className="mt-4 font-display text-4xl font-medium tabular-nums text-oak-800">{formatCurrency(totalValueCents)}</p>
        <p className="mt-2 font-sans text-sm text-ink-700">from {contractsSigned} signed contracts</p>
      </CardContent>
    </Card>
  );
}
