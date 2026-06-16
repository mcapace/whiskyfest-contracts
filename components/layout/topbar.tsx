'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { appShellPageMeta } from '@/lib/app-shell';
import { cn } from '@/lib/utils';
import { TopbarSearch } from '@/components/layout/topbar-search';

export function Topbar({
  title,
  className,
  endSlot,
}: {
  title?: string | null;
  className?: string;
  endSlot?: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const meta = appShellPageMeta(pathname);
  const pageTitle = title ?? meta.title;

  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-border/50 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:bg-bg-surface-raised/90',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-4 px-4 lg:px-8">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="mb-0.5 hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            {meta.crumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 opacity-50" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="transition hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{pageTitle}</h1>
        </div>
        <TopbarSearch />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">{endSlot}</div>
      </div>
    </header>
  );
}
