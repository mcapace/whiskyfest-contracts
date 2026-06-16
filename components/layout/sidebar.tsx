'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  LayoutDashboard,
  Plus,
  CalendarDays,
  Users,
  UserRound,
  Landmark,
  ChevronDown,
  UserPlus,
  Building2,
  Settings,
  Upload,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isAccountingPath,
  isWineSpectatorPath,
} from '@/lib/product-portal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { ImpersonationMenu } from '@/components/impersonation/impersonation-menu';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { AppNavLink } from '@/components/layout/app-nav-link';
import { PortalSwitcher } from '@/components/layout/portal-switcher';

function formatRoleLabel(role?: string | null): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'sales':
    case 'sales_rep':
      return 'Sales';
    case 'viewer':
      return 'Viewer';
    default:
      return role?.trim() ? role : 'User';
  }
}

type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  wineSpectatorAdminOk?: boolean;
  legacyImport?: boolean;
  tourId?: string;
};

const whiskyfestNav: SidebarNavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/contracts', label: 'Contracts', icon: FileText },
  { href: '/sponsors', label: 'Sponsors', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const whiskyfestAdminNav: SidebarNavItem[] = [
  { href: '/sales-reps', label: 'Sales reps', icon: UserRound },
  { href: '/events', label: 'Events', icon: CalendarDays, tourId: 'sidebar-events' },
  { href: '/users', label: 'Users', icon: Users, tourId: 'sidebar-users' },
  { href: '/contracts/import', label: 'Import legacy', icon: Upload, legacyImport: true },
];

const wineSpectatorNav: SidebarNavItem[] = [
  { href: '/wine-spectator', label: 'Overview', icon: LayoutDashboard },
  { href: '/wine-spectator/roster', label: 'Exhibitor roster', icon: ClipboardList },
  { href: '/wine-spectator/contracts', label: 'Licenses', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const wineSpectatorAdminNav: SidebarNavItem[] = [
  { href: '/events', label: 'Event settings', icon: CalendarDays, wineSpectatorAdminOk: true, tourId: 'sidebar-events' },
  { href: '/users', label: 'Users', icon: Users, tourId: 'sidebar-users' },
];

const accountingNav: SidebarNavItem[] = [
  { href: '/accounting', label: 'Overview', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function portalNavLinkActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/wine-spectator' || href === '/accounting') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </p>
      {children}
    </div>
  );
}

export function Sidebar({
  user,
  canImpersonate = false,
  readOnlyImpersonation = false,
  pendingAccessRequests = 0,
}: {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
    pipelineAccess?: boolean;
    isAccounting?: boolean;
    isEventsTeam?: boolean;
    wineSpectatorAccess?: boolean;
    wineSpectatorAdmin?: boolean;
  };
  canImpersonate?: boolean;
  readOnlyImpersonation?: boolean;
  pendingAccessRequests?: number;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === 'admin';
  const wineSpectatorAdmin = Boolean(user.wineSpectatorAdmin);
  const pipelineAccess = Boolean(user.pipelineAccess);
  const isAccounting = Boolean(user.isAccounting);
  const canAccounting = isAccounting || isAdmin;
  const canWineSpectator = Boolean(user.wineSpectatorAccess);
  const accountingOnly = isAccounting && !pipelineAccess;
  const accountingPortal = isAccountingPath(pathname);
  const wineSpectatorPortal = isWineSpectatorPath(pathname);
  const homeHref = accountingOnly || accountingPortal ? '/accounting' : wineSpectatorPortal ? '/wine-spectator' : '/';

  const workspaceNav = accountingPortal || accountingOnly
    ? accountingNav
    : wineSpectatorPortal
      ? wineSpectatorNav
      : whiskyfestNav;

  const adminNav = wineSpectatorPortal ? wineSpectatorAdminNav : whiskyfestAdminNav;

  const showItem = (item: SidebarNavItem) => {
    if (item.adminOnly || item.wineSpectatorAdminOk) {
      if (isAdmin) return true;
      if (wineSpectatorPortal && wineSpectatorAdmin && item.wineSpectatorAdminOk) return true;
      return false;
    }
    if (item.legacyImport && accountingOnly) return false;
    return true;
  };

  const primaryCta = wineSpectatorPortal
    ? { href: '/wine-spectator/contracts/new', label: 'New vendor license' }
    : accountingPortal || accountingOnly
      ? null
      : { href: '/contracts/new', label: 'New contract' };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-border/50 bg-[#f4f5f7] dark:bg-bg-surface lg:flex">
      <div className="shrink-0 border-b border-border/40 px-4 py-4">
        <div className="mx-auto max-w-[200px]">
          {wineSpectatorPortal ? (
            <NyweLogo href={homeHref} priority imageClassName="max-h-10" />
          ) : accountingPortal || accountingOnly ? (
            <Link href={homeHref} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900 text-brass-400">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Accounting</p>
                <p className="text-[11px] text-muted-foreground">Accounts receivable</p>
              </div>
            </Link>
          ) : (
            <Link href={homeHref} className="relative mx-auto block h-10 w-full max-w-[180px]">
              <Image
                src="/images/WA_BLUE-removebg-preview%20%282%29.png"
                alt="Whisky Advocate"
                fill
                className="object-contain object-left mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                sizes="180px"
                priority
              />
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {!accountingOnly ? (
          <PortalSwitcher pathname={pathname} canWineSpectator={canWineSpectator} canAccounting={canAccounting} />
        ) : null}

        {primaryCta && !readOnlyImpersonation ? (
          <Button asChild size="sm" className="h-9 w-full justify-center gap-1.5 shadow-sm">
            <Link href={primaryCta.href}>
              <Plus className="h-4 w-4" />
              {primaryCta.label}
            </Link>
          </Button>
        ) : primaryCta && readOnlyImpersonation ? (
          <Button size="sm" className="h-9 w-full" disabled title={IMPERSONATION_BUTTON_TOOLTIP}>
            <Plus className="h-4 w-4" />
            {primaryCta.label}
          </Button>
        ) : null}

        <NavSection label="Workspace">
          {workspaceNav.map((item) => (
            <AppNavLink
              key={item.href}
              href={item.href}
              active={portalNavLinkActive(pathname, item.href)}
              icon={item.icon}
              label={item.label}
              tourId={item.tourId}
            />
          ))}
        </NavSection>

        {(isAdmin || (wineSpectatorPortal && wineSpectatorAdmin)) && adminNav.some(showItem) ? (
          <NavSection label="Administration">
            {adminNav.filter(showItem).map((item) => (
              <AppNavLink
                key={item.href}
                href={item.href}
                active={portalNavLinkActive(pathname, item.href)}
                icon={item.icon}
                label={item.label}
                tourId={item.tourId}
              />
            ))}
            {isAdmin ? (
              <AppNavLink
                href="/admin/access-requests"
                active={pathname.startsWith('/admin/access-requests')}
                icon={UserPlus}
                label="Access requests"
                badge={pendingAccessRequests}
              />
            ) : null}
          </NavSection>
        ) : null}
      </div>

      <div className="border-t border-border/40 bg-white/50 p-3 dark:bg-bg-surface-raised/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white dark:hover:bg-muted/40"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fest-600 to-fest-800 text-xs font-semibold text-white">
                {user.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{user.name ?? user.email}</p>
                <p className="truncate text-[11px] text-muted-foreground">{formatRoleLabel(user.role)}</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canImpersonate ? (
              <>
                <ImpersonationMenu canImpersonate />
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void signOut({ callbackUrl: '/auth/login' });
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
