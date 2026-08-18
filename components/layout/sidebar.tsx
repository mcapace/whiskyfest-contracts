'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  QrCode,
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
import { canAccessParticipationReport } from '@/lib/participation-report-shared';
import {
  isAccountingPath,
  isBigSmokePath,
  isWineSpectatorPath,
} from '@/lib/product-portal';
import { isBigSmokeAccountingPath, isNyweAccountingPath } from '@/lib/accounting-portal';
import { bigSmokeHref, nyweHref, type PortalKind } from '@/lib/portal-host';
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
import { CigarAficionadoLogo } from '@/components/brand/cigar-aficionado-logo';
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
    bigSmokeAccess?: boolean;
  };
}) {
  const pipeline = Boolean(user.pipelineAccess);
  const events = Boolean(user.isEventsTeam);
  const accounting = Boolean(user.isAccounting);
  const wine = Boolean(user.wineSpectatorAccess);
  const bigSmoke = Boolean(user.bigSmokeAccess);

  const rows = [
    { label: 'Role', value: formatRoleLabel(user.role) },
    { label: 'Contract pipeline', value: pipeline ? 'Yes' : 'No' },
    { label: 'NYWE', value: wine ? 'Yes' : 'No' },
    { label: 'Big Smoke', value: bigSmoke ? 'Yes' : 'No' },
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
  /** Exclusive allowlist (Kate + Michael) — not all admins. */
  participationReportOk?: boolean;
  wineSpectatorAdminOk?: boolean;
  bigSmokeAdminOk?: boolean;
  legacyImport?: boolean;
};

const whiskyfestNav: SidebarNavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/#start-deal', label: 'Start a deal', icon: Plus },
  { href: '/contracts', label: 'All Contracts', icon: FileText },
  { href: '/contracts/import', label: 'Import Contract', icon: Upload, legacyImport: true },
  { href: '/sponsors', label: 'Sponsors', icon: Building2 },
  { href: '/reports/participation', label: 'Participation', icon: ClipboardList, participationReportOk: true },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/sales-reps', label: 'Sales Reps', icon: UserRound, adminOnly: true },
  { href: '/events', label: 'Events', icon: CalendarDays, adminOnly: true },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
];

const wineSpectatorNav: SidebarNavItem[] = [
  { href: '/wine-spectator', label: 'Home', icon: LayoutDashboard },
  { href: '/wine-spectator/roster', label: 'Exhibitor list', icon: Users },
  { href: '/wine-spectator/qr', label: 'Booth QR', icon: QrCode },
  { href: '/wine-spectator/contracts', label: 'All contracts', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/events', label: 'Events', icon: CalendarDays, adminOnly: true, wineSpectatorAdminOk: true },
];

const bigSmokeNav: SidebarNavItem[] = [
  { href: '/big-smoke', label: 'Home', icon: LayoutDashboard },
  { href: '/big-smoke/contracts', label: 'All contracts', icon: FileText },
  { href: '/big-smoke/contracts/new', label: 'New contract', icon: Plus },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/sales-reps', label: 'Sales Reps', icon: UserRound, adminOnly: true },
  {
    href: '/events',
    label: 'Events',
    icon: CalendarDays,
    adminOnly: true,
    bigSmokeAdminOk: true,
  },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
];

const whiskyfestAccountingNav: SidebarNavItem[] = [
  { href: '/accounting', label: 'Accounts receivable', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const nyweAccountingNav: SidebarNavItem[] = [
  { href: '/accounting/nywe', label: 'Accounts receivable', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const bigSmokeAccountingNav: SidebarNavItem[] = [
  { href: '/accounting/big-smoke', label: 'Accounts receivable', icon: Landmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function portalNavLinkActive(pathname: string, href: string): boolean {
  const equivalents = new Set([href]);
  if (href === '/') {
    equivalents.add('/wine-spectator');
    equivalents.add('/big-smoke');
  }
  if (href === '/wine-spectator' || href === '/big-smoke') equivalents.add('/');
  if (href === '/roster') equivalents.add('/wine-spectator/roster');
  if (href === '/wine-spectator/roster') equivalents.add('/roster');
  if (href === '/qr') equivalents.add('/wine-spectator/qr');
  if (href === '/wine-spectator/qr') equivalents.add('/qr');
  if (href === '/contracts') {
    equivalents.add('/wine-spectator/contracts');
    equivalents.add('/big-smoke/contracts');
  }
  if (href === '/wine-spectator/contracts' || href === '/big-smoke/contracts') {
    equivalents.add('/contracts');
  }
  if (href === '/accounting') {
    equivalents.add('/accounting/nywe');
    equivalents.add('/accounting/big-smoke');
  }
  if (href === '/accounting/nywe' || href === '/accounting/big-smoke') {
    equivalents.add('/accounting');
  }

  for (const candidate of equivalents) {
    if (candidate === '/' || candidate === '/wine-spectator' || candidate === '/big-smoke') {
      if (pathname === candidate) return true;
      continue;
    }
    if (candidate === '/accounting') {
      if (
        pathname === '/accounting' ||
        (pathname.startsWith('/accounting/') &&
          !pathname.startsWith('/accounting/nywe') &&
          !pathname.startsWith('/accounting/big-smoke'))
      ) {
        return true;
      }
      continue;
    }
    if (candidate === '/accounting/nywe') {
      if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) return true;
      continue;
    }
    if (candidate === '/accounting/big-smoke') {
      if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) {
        return true;
      }
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
  return items.map((item) => {
    if (portalKind === 'nywe') return { ...item, href: nyweHref(item.href, portalKind) };
    if (portalKind === 'big_smoke') return { ...item, href: bigSmokeHref(item.href, portalKind) };
    return item;
  });
}

function nyweNavLinkClass(active: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
    active
      ? 'border-rose-700 bg-gradient-to-r from-rose-50/90 to-transparent text-foreground'
      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
  );
}

function nyweNavIconClass(active: boolean) {
  return cn('h-4 w-4', active ? 'text-rose-800' : 'text-muted-foreground/70 group-hover:text-foreground');
}

function bigSmokeNavLinkClass(active: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
    active
      ? 'border-amber-700 bg-gradient-to-r from-amber-50/90 to-transparent text-foreground'
      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
  );
}

function bigSmokeNavIconClass(active: boolean) {
  return cn('h-4 w-4', active ? 'text-amber-800' : 'text-muted-foreground/70 group-hover:text-foreground');
}

function defaultNavLinkClass(active: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
    active
      ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
      : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
  );
}

function defaultNavIconClass(active: boolean) {
  return cn('h-4 w-4', active ? 'text-accent-brand' : 'text-muted-foreground/70');
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
    bigSmokeAccess?: boolean;
    bigSmokeAdmin?: boolean;
  };
  canImpersonate?: boolean;
  readOnlyImpersonation?: boolean;
  pendingAccessRequests?: number;
}) {
  const pathname = usePathname();
  const portalKind = usePortalKind();
  const isAdmin = user.role === 'admin';
  const showParticipationReport = canAccessParticipationReport(user.email);
  const wineSpectatorAdmin = Boolean(user.wineSpectatorAdmin);
  const bigSmokeAdmin = Boolean(user.bigSmokeAdmin);
  const pipelineAccess = Boolean(user.pipelineAccess);
  const isAccounting = Boolean(user.isAccounting);
  const canAccounting = isAccounting || isAdmin;
  const accountingOnly = isAccounting && !pipelineAccess;
  const useAccountingOnlyNav = accountingOnly && !isAdmin;
  const nywePortal = portalKind === 'nywe';
  const bigSmokePortal = portalKind === 'big_smoke';
  const accountingPortal =
    isAccountingPath(pathname) ||
    (nywePortal && pathname.startsWith('/accounting')) ||
    (bigSmokePortal && pathname.startsWith('/accounting'));
  const wineSpectatorPortal = isWineSpectatorPath(pathname) || nywePortal;
  const bigSmokeProductPortal = isBigSmokePath(pathname) || bigSmokePortal;
  const showAccountingChrome = accountingPortal && useAccountingOnlyNav;
  const homeHref = accountingOnly
    ? isNyweAccountingPath(pathname, portalKind)
      ? nyweHref('/accounting/nywe', portalKind)
      : isBigSmokeAccountingPath(pathname, portalKind)
        ? bigSmokeHref('/accounting/big-smoke', portalKind)
        : '/accounting'
    : wineSpectatorPortal
      ? nyweHref('/wine-spectator', portalKind)
      : bigSmokeProductPortal
        ? bigSmokeHref('/big-smoke', portalKind)
        : '/';
  const accountingNavItems = nywePortal
    ? nyweAccountingNav
    : bigSmokePortal
      ? bigSmokeAccountingNav
      : whiskyfestAccountingNav;
  const rawNav =
    useAccountingOnlyNav && accountingPortal
      ? accountingNavItems
      : wineSpectatorPortal
        ? wineSpectatorNav
        : bigSmokeProductPortal
          ? bigSmokeNav
          : whiskyfestNav;
  const nav = mapNavForPortal(rawNav, portalKind);
  const nyweChrome = nywePortal;
  const bigSmokeChrome = bigSmokePortal;

  function navLinkClass(active: boolean) {
    if (nyweChrome) return nyweNavLinkClass(active);
    if (bigSmokeChrome) return bigSmokeNavLinkClass(active);
    return defaultNavLinkClass(active);
  }

  function navIconClass(active: boolean) {
    if (nyweChrome) return nyweNavIconClass(active);
    if (bigSmokeChrome) return bigSmokeNavIconClass(active);
    return defaultNavIconClass(active);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-bg-surface/95 backdrop-blur-md lg:flex">
      <div
        className={cn(
          'shrink-0 border-b border-border/50 px-3 py-4',
          wineSpectatorPortal || bigSmokeProductPortal
            ? 'bg-gradient-to-b from-bg-surface-raised to-bg-surface'
            : showAccountingChrome
              ? 'bg-gradient-to-b from-brass-700/[0.08] via-bg-surface-raised to-bg-surface'
              : 'bg-gradient-to-b from-fest-600/[0.07] via-bg-surface-raised to-bg-surface',
        )}
      >
        <div className="flex justify-center px-3 py-2">
          {wineSpectatorPortal ? (
            <NyweLogo
              href={homeHref}
              priority
              mark="event"
              centered
              className="w-full max-w-[200px]"
              imageClassName="max-h-12"
            />
          ) : bigSmokeProductPortal ? (
            <CigarAficionadoLogo
              href={homeHref}
              priority
              variant="onDark"
              className="mx-auto w-full max-w-[200px]"
              imageClassName="max-h-10"
            />
          ) : showAccountingChrome ? (
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
        {useAccountingOnlyNav ? (
          <div className="space-y-1">
            {mapNavForPortal(accountingNavItems, portalKind).map((item) => {
              const active = portalNavLinkActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClass(active)}
                >
                  <Icon className={navIconClass(active)} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            {nav
              .filter((item) => {
                if ('participationReportOk' in item && item.participationReportOk) {
                  return showParticipationReport;
                }
                if ('adminOnly' in item && item.adminOnly) {
                  if (isAdmin) return true;
                  if (wineSpectatorPortal && wineSpectatorAdmin && item.wineSpectatorAdminOk) return true;
                  if (
                    bigSmokeProductPortal &&
                    item.bigSmokeAdminOk &&
                    (bigSmokeAdmin || Boolean(user.isEventsTeam))
                  ) {
                    return true;
                  }
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
                  item.href === '/big-smoke/contracts/new' ||
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
                    className={navLinkClass(active)}
                  >
                    <Icon className={navIconClass(active)} />
                    {item.label}
                  </Link>
                );
              })}
            {canAccounting && !useAccountingOnlyNav && (
              <Link
                href={
                  nywePortal
                    ? nyweHref('/accounting/nywe', portalKind)
                    : bigSmokePortal
                      ? bigSmokeHref('/accounting/big-smoke', portalKind)
                      : '/accounting'
                }
                className={navLinkClass(portalNavLinkActive(pathname, '/accounting'))}
              >
                <Landmark className={navIconClass(portalNavLinkActive(pathname, '/accounting'))} />
                Accounts receivable
              </Link>
            )}
            {isAdmin ? (
              <div className="pt-6">
                <p className="mb-2 px-[10px] wf-label-caps text-[10px]">Admin</p>
                <Link
                  href="/admin/access-requests"
                  className={cn(navLinkClass(pathname.startsWith('/admin/access-requests')), 'justify-between')}
                >
                  <span className="inline-flex items-center gap-3">
                    <UserPlus className={navIconClass(pathname.startsWith('/admin/access-requests'))} />
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
