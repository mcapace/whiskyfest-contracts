import { STATUS_META, type ContractStatus } from '@/types/db';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const meta = STATUS_META[status];
  return <Badge className={cn(meta.tone, 'border', className)}>{meta.label}</Badge>;
}
