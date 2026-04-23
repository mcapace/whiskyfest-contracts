import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('animate-wf-skeleton rounded-md bg-muted/80', className)} {...rest} />;
}
