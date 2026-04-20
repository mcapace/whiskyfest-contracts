'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, LayoutDashboard, Plus, CalendarDays, Users } from 'lucide-react';
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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/50 bg-card/40 backdrop-blur-sm lg:flex lg:flex-col">
      {/* Brand lockup */}
      <div className="flex h-20 items-center border-b border-border/50 px-6">
        <Link href="/" className="group flex flex-col leading-none">
          <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
            WhiskyFest
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-brass-600">
            Contract Flow
          </span>
        </Link>
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
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-whisky-100/70 text-whisky-900'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-whisky-800' : 'text-muted-foreground/70')} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* User block */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-whisky-200 font-serif text-sm font-semibold text-whisky-900">
            {user.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{user.name ?? user.email}</p>
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{user.role ?? 'viewer'}</p>
          </div>
        </div>
        <form action="/api/auth/signout" method="POST" className="mt-2">
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
