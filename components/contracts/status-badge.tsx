'use client';

import type { ContractStatus } from '@/types/db';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

export function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.span
      layout
      initial={reduce ? false : { opacity: 0.65, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
      className="inline-flex"
    >
      <Badge className={cn(statusBadgeClassName(status), 'border motion-safe:transition-colors', className)}>
        {formatStatus(status)}
      </Badge>
    </motion.span>
  );
}
