'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { FileText, LayoutDashboard, Plus, CalendarDays, Users, UserRound, Landmark, ChevronDown, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  };
}) {
  const pipeline = Boolean(user.pipelineAccess);
  const events = Boolean(user.isEventsTeam);
  const accounting = Boolean(user.isAccounting);

  const rows = [
    { label: 'Role', value: formatRoleLabel(user.role) },
    { label: 'Contract pipeline', value: pipeline ? 'Yes' : 'No' },
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

function AccountingNavLink({ pathname }: { pathname: string }) {
  const href = '/accounting';
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      data-tour="sidebar-accounting"
      className={cn(
        'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
        active
          ? 'border-accent-brand bg-gradient-to-r from-accent-brand/12 to-transparent text-foreground'
          : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <Landmark className={cn('h-4 w-4', active ? 'text-accent-brand' : 'text-muted-foreground/70')} />
      Accounting Dashboard
    </Link>
  );
}

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contracts/new', label: 'New Contract', icon: Plus },
  { href: '/contracts', label: 'All Contracts', icon: FileText },
  { href: '/sales-reps', label: 'Sales Reps', icon: UserRound, adminOnly: true },
  { href: '/events', label: 'Events', icon: CalendarDays, adminOnly: true },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
];

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
  };
  canImpersonate?: boolean;
  readOnlyImpersonation?: boolean;
  pendingAccessRequests?: number;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === 'admin';
  const pipelineAccess = Boolean(user.pipelineAccess);
  const isAccounting = Boolean(user.isAccounting);
  const accountingOnly = isAccounting && !pipelineAccess;
  const homeHref = accountingOnly ? '/accounting' : '/';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-bg-surface/95 backdrop-blur-md lg:flex">
      <div className="shrink-0 border-b border-border/50 bg-gradient-to-b from-fest-600/[0.07] via-bg-surface-raised to-bg-surface px-3 py-4">
        <div className="mx-auto max-w-[220px] px-3 py-2">
          <Link href={homeHref} className="relative mx-auto block h-12 w-full max-w-[200px]">
            <Image
              src="/images/WA_BLUE-removebg-preview%20%282%29.png"
              alt="Whisky Advocate"
              fill
              className="object-contain object-center mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
              sizes="200px"
              priority
            />
          </Link>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-5">
        {accountingOnly ? (
          <AccountingNavLink pathname={pathname} />
        ) : (
          <>
            {nav
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                const isNewContract = item.href === '/contracts/new';
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
            {isAccounting ? (
              <div className="pt-6">
                <p className="mb-2 px-[10px] wf-label-caps text-[10px]">Accounting</p>
                <AccountingNavLink pathname={pathname} />
              </div>
            ) : null}
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
