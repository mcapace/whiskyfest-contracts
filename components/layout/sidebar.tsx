'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isAccountingPath,
  isWineSpectatorPath,
} from '@/lib/product-portal';
import { isNyweAccountingPath } from '@/lib/accounting-portal';
import { nyweHref, type PortalKind } from '@/lib/portal-host';
import { usePortalKind } from '@/components/portal/portal-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { WhiskyAdvocateLogo } from '@/components/brand/whisky-advocate-logo';
import { ImpersonationMenu } from '@/components/impersonation/impersonation-menu';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';

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

function AccountPermissionSummary({
  user,
}: {
  user: {
    role?: string | null;
    pipelineAccess?: boolean;
    isAccounting?: boolean;
    isEventsTeam?: boolean;
    wineSpectatorAccess?: boolean;
  };
}) {
  const pipeline = Boolean(user.pipelineAccess);
  const events = Boolean(user.isEventsTeam);
  const accounting = Boolean(user.isAccounting);
  const wine = Boolean(user.wineSpectatorAccess);

  const rows = [
    { label: 'Role', value: formatRoleLabel(user.role) },
    { label: 'Contract pipeline', value: pipeline ? 'Yes' : 'No' },
    { label: 'NYWE', value: wine ? 'Yes' : 'No' },
    { label: 'Events team', value: events ? 'Yes' : 'No' },
    { label: 'Accounting', value: accounting ? 'Yes' : 'No' },
  ];

  return (
    <div className="px-2 py-2.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your access</p>
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-xs leading-snug">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-right font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  wineSpectatorAdminOk?: boolean;
  legacyImport?: boolean;
};

const whiskyfestNav: SidebarNavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/#start-deal', label: 'Start a deal', icon: Plus },
  { href: '/contracts', label: 'All Contracts', icon: FileText },
  { href: '/contracts/import', label: 'Import Contract', icon: Upload, legacyImport: true },
  { href: '/sponsors', label: 'Sponsors', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/sales-reps', label: 'Sales Reps', icon: UserRound, adminOnly: true },
  { href: '/events', label: 'Events', icon: CalendarDays, adminOnly: true },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
];

const wineSpectatorNav: SidebarNavItem[] = [
  { href: '/wine-spectator', label: 'Home', icon: LayoutDashboard },
  { href: '/wine-spectator/roster', label: 'Exhibitor list', icon: Users },
  { href: '/wine-spectator/contracts', label: 'All contracts', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/events', label: 'Events', icon: CalendarDays, adminOnly: true, wineSpectatorAdminOk: true },
];

const whiskyfestAccountingNav: SidebarNavItem[] = [
  { href: '/accounting', label: 'Accounts receivable', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const nyweAccountingNav: SidebarNavItem[] = [
  { href: '/accounting/nywe', label: 'Accounts receivable', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function portalNavLinkActive(pathname: string, href: string): boolean {
  const equivalents = new Set([href]);
  if (href === '/') equivalents.add('/wine-spectator');
  if (href === '/wine-spectator') equivalents.add('/');
  if (href === '/roster') equivalents.add('/wine-spectator/roster');
  if (href === '/wine-spectator/roster') equivalents.add('/roster');
  if (href === '/contracts') equivalents.add('/wine-spectator/contracts');
  if (href === '/wine-spectator/contracts') equivalents.add('/contracts');
  if (href === '/accounting') equivalents.add('/accounting/nywe');
  if (href === '/accounting/nywe') equivalents.add('/accounting');

  for (const candidate of equivalents) {
    if (candidate === '/' || candidate === '/wine-spectator') {
      if (pathname === candidate) return true;
      continue;
    }
    if (candidate === '/accounting') {
      if (pathname === '/accounting' || (pathname.startsWith('/accounting/') && !pathname.startsWith('/accounting/nywe'))) {
        return true;
      }
      continue;
    }
    if (candidate === '/accounting/nywe') {
      if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) return true;
      continue;
    }
    if (candidate === '/#start-deal') {
      if (pathname === '/') return true;
      continue;
    }
    if (pathname === candidate || pathname.startsWith(`${candidate}/`)) return true;
  }
  return false;
}

function mapNavForPortal(items: SidebarNavItem[], portalKind: PortalKind): SidebarNavItem[] {
  return items.map((item) => ({ ...item, href: nyweHref(item.href, portalKind) }));
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
  const portalKind = usePortalKind();
  const isAdmin = user.role === 'admin';
  const wineSpectatorAdmin = Boolean(user.wineSpectatorAdmin);
  const pipelineAccess = Boolean(user.pipelineAccess);
  const isAccounting = Boolean(user.isAccounting);
  const canAccounting = isAccounting || isAdmin;
  const accountingOnly = isAccounting && !pipelineAccess;
  const nywePortal = portalKind === 'nywe';
  const accountingPortal = isAccountingPath(pathname) || (nywePortal && pathname.startsWith('/accounting'));
  const wineSpectatorPortal = isWineSpectatorPath(pathname) || nywePortal;
  const homeHref = accountingOnly || accountingPortal
    ? isNyweAccountingPath(pathname, portalKind)
      ? nyweHref('/accounting/nywe', portalKind)
      : '/accounting'
    : wineSpectatorPortal
      ? nyweHref('/wine-spectator', portalKind)
      : '/';
  const accountingNavItems = nywePortal ? nyweAccountingNav : whiskyfestAccountingNav;
  const rawNav = accountingPortal
    ? accountingNavItems
    : wineSpectatorPortal
      ? wineSpectatorNav
      : whiskyfestNav;
  const nav = mapNavForPortal(rawNav, portalKind);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-bg-surface/95 backdrop-blur-md lg:flex">
      <div
        className={cn(
          'shrink-0 border-b border-border/50 px-3 py-4',
          wineSpectatorPortal
            ? 'bg-gradient-to-b from-fest-600/[0.07] via-bg-surface-raised to-bg-surface'
            : accountingPortal
              ? 'bg-gradient-to-b from-brass-700/[0.08] via-bg-surface-raised to-bg-surface'
              : 'bg-gradient-to-b from-fest-600/[0.07] via-bg-surface-raised to-bg-surface',
        )}
      >
        <div className="mx-auto max-w-[220px] px-3 py-2">
          {wineSpectatorPortal ? (
            <NyweLogo href={homeHref} priority imageClassName="max-h-12" />
          ) : accountingPortal ? (
            <Link href={homeHref} className="block rounded-lg border border-brass-700/25 bg-stone-950/60 px-4 py-3 text-center">
              <Landmark className="mx-auto h-6 w-6 text-brass-400" />
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass-300">Accounting</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Accounts receivable</p>
            </Link>
          ) : (
            <WhiskyAdvocateLogo href={homeHref} priority className="mx-auto max-w-[200px]" imageClassName="max-h-12" />
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-5">
        {accountingOnly ? (
          <div className="space-y-1">
            {mapNavForPortal(accountingNavItems, portalKind).map((item) => {
              const active = portalNavLinkActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-accent-brand' : 'text-muted-foreground/70')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            {nav
              .filter((item) => {
                if ('adminOnly' in item && item.adminOnly) {
                  if (isAdmin) return true;
                  if (wineSpectatorPortal && wineSpectatorAdmin && item.wineSpectatorAdminOk) return true;
                  return false;
                }
                if ('legacyImport' in item && item.legacyImport && accountingOnly) return false;
                return true;
              })
              .map((item) => {
                const active = portalNavLinkActive(pathname, item.href);
                const Icon = item.icon;
                const isNewContract =
                  item.href === '/#start-deal' ||
                  item.href === '/wine-spectator/contracts/new' ||
                  item.href === '/contracts/new';
                const navDisabled = readOnlyImpersonation && isNewContract;
                if (navDisabled) {
                  return (
                    <span
                      key={item.href}
                      title={IMPERSONATION_BUTTON_TOOLTIP}
                      className="group flex cursor-not-allowed items-center gap-3 rounded-md border-l-2 border-transparent py-2 pl-[10px] pr-3 text-sm font-medium text-muted-foreground/50"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground/40" />
                      {item.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={
                      item.href === '/events'
                        ? 'sidebar-events'
                        : item.href === '/users'
                          ? 'sidebar-users'
                          : undefined
                    }
                    className={cn(
                      'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-accent-brand' : 'text-muted-foreground/70')} />
                    {item.label}
                  </Link>
                );
              })}
            {canAccounting && !accountingPortal && !accountingOnly && (
              <Link
                href={nywePortal ? nyweHref('/accounting/nywe', portalKind) : '/accounting'}
                className={cn(
                  'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                  portalNavLinkActive(pathname, '/accounting')
                    ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <Landmark className="h-4 w-4 text-muted-foreground/70" />
                Accounts receivable
              </Link>
            )}
            {isAdmin ? (
              <div className="pt-6">
                <p className="mb-2 px-[10px] wf-label-caps text-[10px]">Admin</p>
                <Link
                  href="/admin/access-requests"
                  className={cn(
                    'group flex items-center justify-between rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                    pathname.startsWith('/admin/access-requests')
                      ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <UserPlus className="h-4 w-4 text-muted-foreground/70" />
                    Access Requests
                  </span>
                  {pendingAccessRequests > 0 ? (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                      {pendingAccessRequests}
                    </span>
                  ) : null}
                </Link>
              </div>
            ) : null}
          </>
        )}
      </nav>

      <div className="border-t border-border/50 bg-bg-surface-raised/50 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-serif text-sm font-semibold text-foreground ring-1 ring-border">
                {user.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{user.name ?? user.email}</p>
                <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                  {accountingOnly ? 'Accounting' : user.role ?? 'viewer'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <AccountPermissionSummary user={user} />
            <DropdownMenuSeparator />
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
