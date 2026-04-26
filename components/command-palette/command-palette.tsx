'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Command } from 'cmdk';
import {
  Building2,
  Calculator,
  Clock3,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Plus,
  Search,
  Sun,
  Users,
} from 'lucide-react';
import { STORAGE_KEYS } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/status-display';
import { requiresDiscountApproval } from '@/lib/contracts';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractWithTotals } from '@/types/db';

type ImpersonationCand = { email: string; name: string | null; role_description: string; segment: string };

type ImpersonationSegments = {
  admins: ImpersonationCand[];
  events_team: ImpersonationCand[];
  accounting: ImpersonationCand[];
  sales_reps: ImpersonationCand[];
  assistants: ImpersonationCand[];
};

const Ctx = createContext<{ setOpen: (v: boolean) => void } | null>(null);
const RECENT_CONTRACTS_KEY = 'wf.recentContracts.v1';

export function useCommandPalette() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return c;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setOpenStable = useCallback((v: boolean) => setOpen(v), []);

  return (
    <Ctx.Provider value={{ setOpen: setOpenStable }}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette();
  return (
    <button
      type="button"
      data-tour="command-palette-trigger"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-bg-surface px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:bg-muted/60"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">⌘K</span>
    </button>
  );
}

function CommandPaletteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [contracts, setContracts] = useState<ContractWithTotals[] | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [impersonation, setImpersonation] = useState<ImpersonationCand[] | null>(null);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [debouncedPaletteQuery, setDebouncedPaletteQuery] = useState('');
  const [cmdkInstance, setCmdkInstance] = useState(0);

  const isAdmin = session?.user?.role === 'admin';
  const isEventsTeam = Boolean(session?.user?.is_events_team);
  const isAccounting = Boolean(session?.user?.is_accounting);
  const canImpersonate = Boolean(session?.user?.can_impersonate);
  const showAccounting = isAccounting || isAdmin;
  const pipeline = Boolean(session?.user?.pipeline_access);
  const canSearchContracts = pipeline || isAccounting;
  const canCreateContract = isAdmin || isEventsTeam || session?.user?.role === 'sales' || session?.user?.role === 'sales_rep';
  const canGenerateReport = isAdmin || isEventsTeam || isAccounting;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_CONTRACTS_KEY);
      if (raw) setRecentIds(JSON.parse(raw) as string[]);
    } catch {
      setRecentIds([]);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedPaletteQuery(paletteQuery), 200);
    return () => window.clearTimeout(id);
  }, [paletteQuery]);

  useEffect(() => {
    if (!open) {
      setPaletteQuery('');
      setDebouncedPaletteQuery('');
      return;
    }
    setCmdkInstance((k) => k + 1);
    setPaletteQuery('');
    setDebouncedPaletteQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || !canSearchContracts) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/contracts');
      const body = await res.json().catch(() => ({}));
      if (!cancelled && res.ok && Array.isArray(body.contracts)) {
        setContracts(body.contracts as ContractWithTotals[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canSearchContracts]);

  useEffect(() => {
    if (!open || !canImpersonate) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/impersonation/candidates');
      const body = await res.json().catch(() => ({}));
      if (!cancelled && res.ok && body.segments) {
        const s = body.segments as ImpersonationSegments;
        const flat = [
          ...s.admins,
          ...s.events_team,
          ...s.accounting,
          ...s.sales_reps,
          ...s.assistants,
        ];
        setImpersonation(flat);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canImpersonate]);

  const flatImpersonation = impersonation ?? [];

  const contractHits = useMemo(() => {
    if (!contracts) return [];
    const t = debouncedPaletteQuery.trim().toLowerCase();
    if (!t) return contracts.slice(0, 5);
    return contracts
      .filter((c) => {
        const blob = [
          c.exhibitor_company_name,
          c.brands_poured,
          c.signer_1_name,
          c.signer_1_email,
          c.sales_rep_name,
          c.sales_rep_email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(t);
      })
      .slice(0, 5);
  }, [contracts, debouncedPaletteQuery]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function rememberContract(id: string) {
    const next = [id, ...recentIds.filter((v) => v !== id)].slice(0, 5);
    setRecentIds(next);
    localStorage.setItem(RECENT_CONTRACTS_KEY, JSON.stringify(next));
  }

  async function viewAs(email: string) {
    onOpenChange(false);
    await update({ impersonationTarget: email });
    router.push('/');
    router.refresh();
  }

  async function toggleThemeQuick() {
    const nextDark = !document.documentElement.classList.contains('dark');
    const pref = nextDark ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEYS.theme, pref);
    await update({ themePreference: pref });
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.setAttribute('data-theme', nextDark ? 'dark' : 'light');
    onOpenChange(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-bg-page/80 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[101] w-[calc(100%-1.5rem)] max-w-[680px] -translate-x-1/2 rounded-lg border border-border/60 bg-bg-surface p-0 shadow-wf-floating max-sm:inset-0 max-sm:top-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none"
    >
      <Command
        key={cmdkInstance}
        shouldFilter={false}
        className="flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-lg"
      >
        <div className="border-b border-border/50 px-4 py-3">
          <Command.Input
            placeholder="Search or jump to..."
            onValueChange={setPaletteQuery}
            className="w-full border-0 bg-transparent font-serif text-lg outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-[min(55vh,420px)] overflow-y-auto px-2 py-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>

          <Command.Group
            heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Actions</span>}
            className="mb-2"
          >
            {canCreateContract && (
              <Command.Item
                value="new contract create"
                onSelect={() => go('/contracts/new')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Plus className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Create New Contract</p>
                  <p className="text-xs text-muted-foreground">Create a participation contract</p>
                </div>
              </Command.Item>
            )}
            {showAccounting && (
              <Command.Item
                value="accounting ar dashboard quick"
                onSelect={() => go('/accounting')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Calculator className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">View Accounting</p>
                  <p className="text-xs text-muted-foreground">Accounts receivable</p>
                </div>
              </Command.Item>
            )}
            <Command.Item
              value="toggle dark mode theme"
              onSelect={() => void toggleThemeQuick()}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Sun className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Toggle Dark Mode</p>
                <p className="text-xs text-muted-foreground">Invert theme (full persistence in preferences)</p>
              </div>
            </Command.Item>
            {canGenerateReport && (
              <Command.Item
                value="generate report contracts export csv"
                onSelect={() => go('/api/contracts/export')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <FileText className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Generate report</p>
                  <p className="text-xs text-muted-foreground">Export contracts CSV</p>
                </div>
              </Command.Item>
            )}
            {isAccounting || isAdmin ? (
              <Command.Item
                value="export accounting report"
                onSelect={() => go('/accounting')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Calculator className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Export accounting report</p>
                  <p className="text-xs text-muted-foreground">Accounting dashboard export tools</p>
                </div>
              </Command.Item>
            ) : null}
            {contracts?.some((c) => requiresDiscountApproval(c)) ? (
              isAdmin ? (
                <Command.Item
                  value="approve discount contract"
                  onSelect={() => {
                    const target = contracts.find((c) => requiresDiscountApproval(c));
                    if (target) go(`/contracts/${target.id}`);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <FileText className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Approve discount on pending contract</p>
                    <p className="text-xs text-muted-foreground">Jump to contract requiring admin discount approval</p>
                  </div>
                </Command.Item>
              ) : null
            ) : (
              isAdmin && (
                <Command.Item
                  value="approve discount unavailable"
                  disabled
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm opacity-60"
                >
                  <FileText className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Approve discount</p>
                    <p className="text-xs text-muted-foreground">No contracts currently need discount approval</p>
                  </div>
                </Command.Item>
              )
            )}
            {contracts?.some((c) => c.status === 'pending_events_review') ? (
              isEventsTeam ? (
                <Command.Item
                  value="send back pending review"
                  onSelect={() => {
                    const target = contracts.find((c) => c.status === 'pending_events_review');
                    if (target) go(`/contracts/${target.id}`);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Home className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Send back pending review contract</p>
                    <p className="text-xs text-muted-foreground">Open a pending events review contract</p>
                  </div>
                </Command.Item>
              ) : null
            ) : null}
            {contracts?.some((c) => c.status === 'signed') ? (
              isAdmin || isEventsTeam ? (
                <Command.Item
                  value="release signed contract accounting"
                  onSelect={() => {
                    const target = contracts.find((c) => c.status === 'signed');
                    if (target) go(`/contracts/${target.id}`);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Calculator className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Release signed contract to accounting</p>
                    <p className="text-xs text-muted-foreground">Open a signed contract awaiting release</p>
                  </div>
                </Command.Item>
              ) : null
            ) : null}
            {contracts?.some((c) => c.status === 'executed') ? (
              isAdmin || isAccounting ? (
                <Command.Item
                  value="mark invoice sent executed"
                  onSelect={() => {
                    const target = contracts.find((c) => c.status === 'executed');
                    if (target) go(`/accounting/${target.id}`);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Calculator className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Mark invoice sent</p>
                    <p className="text-xs text-muted-foreground">Open executed contract in accounting view</p>
                  </div>
                </Command.Item>
              ) : null
            ) : null}
          </Command.Group>

          <Command.Group
            heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pages</span>}
            className="mb-2"
          >
            <Command.Item
              value="dashboard home pipeline"
              onSelect={() => go('/')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Dashboard</p>
                <p className="text-xs text-muted-foreground">Contract pipeline</p>
              </div>
            </Command.Item>
            {pipeline && (
            <Command.Item
              value="all contracts list"
              onSelect={() => go('/contracts')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <FileText className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Contracts</p>
                <p className="text-xs text-muted-foreground">Full directory</p>
              </div>
            </Command.Item>
            )}
            {!pipeline && showAccounting && (
              <Command.Item
                value="accounting ar home"
                onSelect={() => go('/accounting')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Calculator className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Accounting Dashboard</p>
                  <p className="text-xs text-muted-foreground">Accounts receivable</p>
                </div>
              </Command.Item>
            )}
            {pipeline && (
            <Command.Item
              value="sponsors directory"
              onSelect={() => go('/sponsors')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Building2 className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Sponsors</p>
                <p className="text-xs text-muted-foreground">Confirmed sponsor directory</p>
              </div>
            </Command.Item>
            )}
            {(isAdmin || isEventsTeam) && (
              <Command.Item
                value="floor plan"
                onSelect={() => go('/floor-plan')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Floor Plan</p>
                  <p className="text-xs text-muted-foreground">Event layout and booth mapping</p>
                </div>
              </Command.Item>
            )}
            {(isAdmin || isEventsTeam) && (
              <Command.Item
                value="event items"
                onSelect={() => go('/event-items')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Home className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">Event Items</p>
                  <p className="text-xs text-muted-foreground">Event checklist and logistics items</p>
                </div>
              </Command.Item>
            )}
            {isAdmin && (
              <>
                <Command.Item
                  value="users app"
                  onSelect={() => go('/admin/users')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Users className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Users</p>
                    <p className="text-xs text-muted-foreground">Admin only</p>
                  </div>
                </Command.Item>
                <Command.Item
                  value="audit log admin"
                  onSelect={() => go('/admin/audit-log')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <FileText className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Audit Log</p>
                    <p className="text-xs text-muted-foreground">Admin only</p>
                  </div>
                </Command.Item>
              </>
            )}
            <Command.Item
              value="settings"
              onSelect={() => go('/settings')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Users className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-xs text-muted-foreground">User and workspace preferences</p>
              </div>
            </Command.Item>
            <Command.Item
              value="help"
              onSelect={() => go('/help')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Home className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Help</p>
                <p className="text-xs text-muted-foreground">Dashboard quick-start and support</p>
              </div>
            </Command.Item>
          </Command.Group>

          {canSearchContracts && contractHits.length > 0 && (
            <Command.Group
              heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contracts</span>}
            >
              {contractHits.map((c) => {
                const signer = c.signer_1_name ?? c.signer_1_email ?? '';
                const rep = c.sales_rep_name ?? c.sales_rep_email ?? '';
                return (
                  <Command.Item
                    key={c.id}
                    value={`contract ${c.id} ${c.exhibitor_company_name} ${c.brands_poured ?? ''} ${signer} ${rep}`}
                    onSelect={() => {
                      rememberContract(c.id);
                      go(`/contracts/${c.id}`);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                  >
                    <FileText className="h-4 w-4 shrink-0 opacity-70" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{c.exhibitor_company_name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {signer ? `${signer}` : ''}
                        {signer && rep ? ' · ' : ''}
                        {rep ? rep : ''}
                      </p>
                    </div>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

          {contracts && recentIds.length > 0 && (
            <Command.Group
              heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent</span>}
            >
              {recentIds
                .map((id) => contracts.find((c) => c.id === id))
                .filter((c): c is ContractWithTotals => Boolean(c))
                .filter((c) => {
                  const t = debouncedPaletteQuery.trim().toLowerCase();
                  if (!t) return true;
                  return [c.exhibitor_company_name, c.brands_poured, c.signer_1_name, c.signer_1_email]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(t);
                })
                .slice(0, 5)
                .map((c) => (
                  <Command.Item
                    key={`recent-${c.id}`}
                    value={`recent ${c.exhibitor_company_name} ${c.id}`}
                    onSelect={() => go(`/contracts/${c.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                  >
                    <Clock3 className="h-4 w-4 shrink-0 opacity-70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.exhibitor_company_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatStatus(c.status)}</p>
                    </div>
                  </Command.Item>
                ))}
            </Command.Group>
          )}

          {canImpersonate && flatImpersonation.length > 0 && (
            <Command.Group
              heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Users</span>}
            >
              {flatImpersonation.map((u) => (
                <Command.Item
                  key={u.email}
                  value={`view as impersonate ${u.name ?? ''} ${u.email} ${u.role_description}`}
                  onSelect={() => void viewAs(u.email)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Eye className="h-4 w-4 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">View as {u.name ?? u.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.role_description}</p>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-border/50 px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span className="hidden sm:inline">Navigate · </span>↑↓ Enter · Esc to close
        </div>
      </Command>
    </Command.Dialog>
  );
}
