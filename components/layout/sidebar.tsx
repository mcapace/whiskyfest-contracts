'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { FileText, LayoutDashboard, Plus, CalendarDays, Users, UserRound, Landmark, ChevronDown } from 'lucide-react';
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

function AccountingNavLink({ pathname }: { pathname: string }) {
  const href = '/accounting';
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
        active
          ? 'border-fest-600 bg-gradient-to-r from-fest-600/10 to-transparent text-whisky-900'
          : 'border-transparent text-muted-foreground hover:border-fest-600/25 hover:bg-accent hover:text-foreground',
      )}
    >
      <Landmark className={cn('h-4 w-4', active ? 'text-fest-700' : 'text-muted-foreground/70')} />
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
}: {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
    pipelineAccess?: boolean;
    isAccounting?: boolean;
  };
  canImpersonate?: boolean;
  readOnlyImpersonation?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === 'admin';
  const pipelineAccess = Boolean(user.pipelineAccess);
  const isAccounting = Boolean(user.isAccounting);
  const accountingOnly = isAccounting && !pipelineAccess;
  const homeHref = accountingOnly ? '/accounting' : '/';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-fest-600/15 bg-card/50 backdrop-blur-sm lg:flex lg:flex-col">
      <div className="shrink-0 border-b border-fest-600/15 bg-gradient-to-b from-fest-100/90 via-brass-50/50 to-fest-50/40 px-3 py-4">
        <div className="mx-auto max-w-[220px] px-3 py-2">
          <Link href={homeHref} className="relative mx-auto block h-12 w-full max-w-[200px]">
            <Image
              src="/images/WA_BLUE-removebg-preview%20%282%29.png"
              alt="Whisky Advocate"
              fill
              className="object-contain object-center mix-blend-multiply"
              sizes="200px"
              priority
            />
          </Link>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
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
                    className={cn(
                      'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-fest-600 bg-gradient-to-r from-fest-600/10 to-transparent text-whisky-900'
                        : 'border-transparent text-muted-foreground hover:border-fest-600/25 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-fest-700' : 'text-muted-foreground/70')} />
                    {item.label}
                  </Link>
                );
              })}
            {isAccounting ? (
              <div className="pt-6">
                <p className="mb-2 px-[10px] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Accounting
                </p>
                <AccountingNavLink pathname={pathname} />
              </div>
            ) : null}
          </>
        )}
      </nav>

      <div className="border-t border-fest-600/15 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fest-100 font-serif text-sm font-semibold text-fest-800 ring-1 ring-fest-600/20">
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
