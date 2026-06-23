'use client';

import type { ContractStatus } from '@/types/db';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Plain status badge — no framer-motion (avoids hydration / React #310 on corporate browsers). */
export function StatusBadge({
  status,
  className,
  dataTour,
}: {
  status: ContractStatus;
  className?: string;
  dataTour?: string;
}) {
  return (
    <Badge
      data-tour={dataTour}
      className={cn(
        statusBadgeClassName(status),
        'border motion-safe:transition-colors',
        status === 'partially_signed' && 'motion-safe:[animation:wf-status-glow_1.6s_ease-out]',
        className,
      )}
    >
      {status === 'partially_signed' && (
        <span
          className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
          aria-hidden
        />
      )}
      {formatStatus(status)}
    </Badge>
  );
}
