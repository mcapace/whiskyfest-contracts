import { isAccountingPath, isWineSpectatorPath } from '@/lib/product-portal';

export type AppShellCrumb = { label: string; href?: string };

/** Human-readable page title + breadcrumbs from pathname. */
export function appShellPageMeta(pathname: string): { title: string; crumbs: AppShellCrumb[] } {
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/' || pathname === '') {
    return { title: 'Overview', crumbs: [{ label: 'WhiskyFest' }, { label: 'Overview' }] };
  }

  if (isAccountingPath(pathname)) {
    if (segments.length === 1) {
      return { title: 'Accounts receivable', crumbs: [{ label: 'Accounting' }, { label: 'Overview' }] };
    }
    return { title: 'Contract detail', crumbs: [{ label: 'Accounting', href: '/accounting' }, { label: 'Contract' }] };
  }

  if (isWineSpectatorPath(pathname)) {
    const root: AppShellCrumb = { label: 'Wine Spectator', href: '/wine-spectator' };
    if (pathname === '/wine-spectator') {
      return { title: 'Overview', crumbs: [root, { label: 'Overview' }] };
    }
    if (pathname.startsWith('/wine-spectator/roster')) {
      return { title: 'Exhibitor roster', crumbs: [root, { label: 'Exhibitor roster' }] };
    }
    if (pathname === '/wine-spectator/contracts/new') {
      return { title: 'New vendor license', crumbs: [root, { label: 'Licenses', href: '/wine-spectator/contracts' }, { label: 'New' }] };
    }
    if (pathname.startsWith('/wine-spectator/contracts/')) {
      return { title: 'License detail', crumbs: [root, { label: 'Licenses', href: '/wine-spectator/contracts' }, { label: 'Detail' }] };
    }
    if (pathname.startsWith('/wine-spectator/contracts')) {
      return { title: 'Licenses', crumbs: [root, { label: 'Licenses' }] };
    }
    return { title: 'Wine Spectator', crumbs: [root] };
  }

  const map: Record<string, { title: string; label: string }> = {
    contracts: { title: 'Contracts', label: 'Contracts' },
    sponsors: { title: 'Sponsors', label: 'Sponsors' },
    settings: { title: 'Settings', label: 'Settings' },
    events: { title: 'Events', label: 'Events' },
    users: { title: 'Users', label: 'Users' },
    'sales-reps': { title: 'Sales reps', label: 'Sales reps' },
    accounting: { title: 'Accounting', label: 'Accounting' },
    admin: { title: 'Admin', label: 'Admin' },
  };

  const key = segments[0] ?? '';
  const meta = map[key];
  if (meta) {
    const root = { label: 'WhiskyFest', href: '/' as const };
    if (segments.length === 1) {
      return { title: meta.title, crumbs: [root, { label: meta.label }] };
    }
    if (key === 'contracts' && segments[1] === 'new') {
      return { title: 'New contract', crumbs: [root, { label: 'Contracts', href: '/contracts' }, { label: 'New' }] };
    }
    if (key === 'contracts' && segments[1]) {
      return { title: 'Contract detail', crumbs: [root, { label: 'Contracts', href: '/contracts' }, { label: 'Detail' }] };
    }
    return { title: meta.title, crumbs: [root, { label: meta.label }] };
  }

  return { title: 'Dashboard', crumbs: [{ label: 'WhiskyFest' }] };
}
