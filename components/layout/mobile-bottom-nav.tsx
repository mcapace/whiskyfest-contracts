'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, Home, Landmark, LayoutDashboard, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWineSpectatorPath } from '@/lib/product-portal';
import { nyweHref } from '@/lib/portal-host';
import { usePortalKind } from '@/components/portal/portal-context';
import { CommandPaletteTrigger } from '@/components/command-palette/command-palette';

function nywePathActive(pathname: string, internalHref: string): boolean {
  const href = internalHref;
  if (href === '/wine-spectator') return pathname === '/' || pathname === '/wine-spectator';
  if (href === '/wine-spectator/contracts/new') {
    return pathname === '/contracts/new' || pathname.startsWith('/wine-spectator/contracts/new');
  }
  if (href === '/wine-spectator/contracts') {
    return (
      pathname === '/contracts' ||
      pathname.startsWith('/contracts/') ||
      (pathname.startsWith('/wine-spectator/contracts') && !pathname.includes('/new'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  accountingOnly,
  showAccountingNav,
  wineSpectatorAccess,
}: {
  accountingOnly: boolean;
  showAccountingNav: boolean;
  wineSpectatorAccess: boolean;
}) {
  const pathname = usePathname();
  const portalKind = usePortalKind();
  const nywePortal = portalKind === 'nywe';
  const wineSpectatorPortal = (nywePortal || isWineSpectatorPath(pathname)) && wineSpectatorAccess;

  if (accountingOnly) {
    const accountingHref = nywePortal ? '/accounting/nywe' : '/accounting';
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/60 bg-bg-surface-raised/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden">
        <NavIcon
          href={accountingHref}
          active={pathname.startsWith('/accounting')}
          label="AR"
          icon={Landmark}
        />
        <div className="flex flex-col items-center gap-0.5 py-1">
          <CommandPaletteTrigger />
          <span className="text-[10px] text-muted-foreground">Search</span>
        </div>
      </nav>
    );
  }

  if (wineSpectatorPortal) {
    const homeHref = nyweHref('/wine-spectator', portalKind);
    const newHref = nyweHref('/wine-spectator/contracts/new', portalKind);
    const listHref = nyweHref('/wine-spectator/contracts', portalKind);
    const accountingHref = nyweHref('/accounting/nywe', portalKind);
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/60 bg-bg-surface-raised/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden">
        <NavIcon nywe={nywePortal} href={homeHref} active={nywePathActive(pathname, '/wine-spectator')} label="Home" icon={LayoutDashboard} />
        <NavIcon nywe={nywePortal} href={newHref} active={nywePathActive(pathname, '/wine-spectator/contracts/new')} label="New" icon={Plus} />
        <NavIcon nywe={nywePortal} href={listHref} active={nywePathActive(pathname, '/wine-spectator/contracts')} label="Contracts" icon={Home} />
        {showAccountingNav ? (
          <NavIcon
            nywe={nywePortal}
            href={accountingHref}
            active={pathname === '/accounting' || pathname.startsWith('/accounting/')}
            label="AR"
            icon={Landmark}
          />
        ) : null}
        <div className="flex min-w-[3rem] flex-col items-center gap-0.5 py-1">
          <CommandPaletteTrigger />
          <span className="text-[10px] text-muted-foreground">Search</span>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/60 bg-bg-surface-raised/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden">
      <NavIcon href="/" active={pathname === '/'} label="Home" icon={LayoutDashboard} />
      <NavIcon href="/#start-deal" active={pathname === '/'} label="Start" icon={Plus} />
      <NavIcon href="/contracts" active={pathname.startsWith('/contracts') && !pathname.includes('/new')} label="Contracts" icon={Home} />
      {showAccountingNav && (
        <NavIcon href="/accounting" active={pathname.startsWith('/accounting')} label="AR" icon={Calculator} />
      )}
      <div className="flex min-w-[3rem] flex-col items-center gap-0.5 py-1">
        <CommandPaletteTrigger />
        <span className="text-[10px] text-muted-foreground">Search</span>
      </div>
    </nav>
  );
}

function NavIcon({
  href,
  active,
  label,
  icon: Icon,
  nywe = false,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: LucideIcon;
  nywe?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
        nywe
          ? active
            ? 'text-rose-800'
            : 'text-muted-foreground hover:text-foreground'
          : active
            ? 'text-accent-brand'
            : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5',
          nywe ? (active ? 'text-rose-800' : 'text-muted-foreground') : active && 'text-accent-brand',
        )}
        strokeWidth={2}
      />
      {label}
    </Link>
  );
}
