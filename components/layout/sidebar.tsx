'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, LayoutDashboard, Plus, CalendarDays, Users } from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/',                 label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/contracts/new',    label: 'New Contract',  icon: Plus },
  { href: '/contracts',        label: 'All Contracts', icon: FileText },
  { href: '/events',           label: 'Events',        icon: CalendarDays,  adminOnly: true },
  { href: '/users',            label: 'Users',         icon: Users,         adminOnly: true },
];

export function Sidebar({ user }: { user: { email?: string | null; name?: string | null; role?: string } }) {
  const pathname = usePathname();
  const isAdmin = user.role === 'admin';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-fest-600/15 bg-card/50 backdrop-blur-sm lg:flex lg:flex-col">
      {/* Brand lockup — centered with subtle gradient backdrop */}
      <div className="shrink-0 border-b border-fest-600/15 bg-gradient-to-b from-fest-100/90 via-brass-50/50 to-fest-50/40 px-3 py-4">
        <div className="mx-auto max-w-[220px] px-3 py-2">
          <Link href="/" className="relative mx-auto block h-12 w-full max-w-[200px]">
            <Image
              src="/images/whiskyfest-ny25-logo.png"
              alt="WhiskyFest"
              fill
              className="object-contain object-center mix-blend-multiply"
              sizes="200px"
              priority
            />
          </Link>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-6">
        {nav
          .filter(item => !item.adminOnly || isAdmin)
          .map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-fest-600 bg-gradient-to-r from-fest-600/10 to-transparent text-whisky-900'
                    : 'border-transparent text-muted-foreground hover:border-fest-600/25 hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-fest-700' : 'text-muted-foreground/70')} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* User block */}
      <div className="border-t border-fest-600/15 p-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fest-100 font-serif text-sm font-semibold text-fest-800 ring-1 ring-fest-600/20">
            {user.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{user.name ?? user.email}</p>
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{user.role ?? 'viewer'}</p>
          </div>
        </div>
        <form action={signOutAction} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
