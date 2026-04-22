import type { ContractStatus } from '@/types/db';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return (
    <Badge className={cn(statusBadgeClassName(status), 'border', className)}>{formatStatus(status)}</Badge>
  );
}
