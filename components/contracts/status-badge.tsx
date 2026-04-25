'use client';

import type { ContractStatus } from '@/types/db';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

export function StatusBadge({
  status,
  className,
  dataTour,
}: {
  status: ContractStatus;
  className?: string;
  dataTour?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.span
      layout
      initial={reduce ? false : { opacity: 0.65, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
      className="inline-flex"
    >
      <Badge
        data-tour={dataTour}
        className={cn(
          statusBadgeClassName(status),
          'border motion-safe:transition-colors',
          status === 'partially_signed' && !reduce && 'motion-safe:[animation:wf-status-glow_1.6s_ease-out]',
          className
        )}
      >
        {status === 'partially_signed' && (
          <span
            className={cn(
              'mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current',
              !reduce && 'motion-safe:animate-pulse'
            )}
            aria-hidden
          />
        )}
        {formatStatus(status)}
      </Badge>
    </motion.span>
  );
}
