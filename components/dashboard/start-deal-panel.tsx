'use client';

import Link from 'next/link';
import { Megaphone, PackagePlus, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CONTRACT_DEAL_KINDS,
  dealKindMeta,
  type ContractDealKind,
} from '@/lib/contract-deal-kind';

const ICONS: Record<ContractDealKind, LucideIcon> = {
  booth: Store,
  sponsorship_only: Megaphone,
  booth_and_sponsorship: PackagePlus,
};

const ACCENT: Record<ContractDealKind, string> = {
  booth: 'text-fest-700 bg-fest-100/80 ring-fest-300/40',
  sponsorship_only: 'text-whisky-800 bg-whisky-100/80 ring-whisky-300/40',
  booth_and_sponsorship: 'text-amber-800 bg-amber-100/70 ring-amber-300/40',
};

export function StartDealPanel({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <section id="start-deal" data-tour="start-deal-panel" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-medium text-foreground">Start a deal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how this contract is structured — booth, sponsorship only, or both on one agreement.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {CONTRACT_DEAL_KINDS.map((kind) => {
          const meta = dealKindMeta(kind);
          const Icon = ICONS[kind];
          const inner = (
            <Card
              className={cn(
                'h-full transition-all',
                readOnly
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:-translate-y-0.5 hover:border-fest-600/25 hover:shadow-wf-editorial-sm',
              )}
            >
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md ring-1',
                    ACCENT[kind],
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-lg font-semibold text-foreground">{meta.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-fest-700">
                  {readOnly ? 'View-only mode' : 'Start order →'}
                </p>
              </CardContent>
            </Card>
          );

          if (readOnly) {
            return <div key={kind}>{inner}</div>;
          }

          return (
            <Link key={kind} href={meta.href} className="block h-full">
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
