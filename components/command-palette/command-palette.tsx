'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Command } from 'cmdk';
import {
  Building2,
  Calculator,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Plus,
  Search,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/status-display';
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
  const [impersonation, setImpersonation] = useState<ImpersonationCand[] | null>(null);

  const isAdmin = session?.user?.role === 'admin';
  const canImpersonate = Boolean(session?.user?.can_impersonate);
  const showAccounting = Boolean(session?.user?.is_accounting) || isAdmin;
  const pipeline = Boolean(session?.user?.pipeline_access);
  const canSearchContracts = pipeline || Boolean(session?.user?.is_accounting);

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

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  async function viewAs(email: string) {
    onOpenChange(false);
    await update({ impersonationTarget: email });
    router.push('/');
    router.refresh();
  }

  function toggleThemeQuick() {
    const el = document.documentElement;
    el.classList.toggle('dark');
    onOpenChange(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-bg-page/80 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[101] w-[calc(100%-1.5rem)] max-w-[640px] -translate-x-1/2 rounded-lg border border-border/60 bg-bg-surface p-0 shadow-wf-floating"
    >
      <Command className="flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-lg">
        <div className="border-b border-border/50 px-4 py-3">
          <Command.Input
            placeholder="Search contracts, actions, users..."
            className="w-full border-0 bg-transparent font-serif text-lg outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-[min(55vh,420px)] overflow-y-auto px-2 py-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No results.</Command.Empty>

          <Command.Group
            heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Actions</span>}
            className="mb-2"
          >
            {pipeline && (
              <Command.Item
                value="new contract create"
                onSelect={() => go('/contracts/new')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <Plus className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">New Contract</p>
                  <p className="text-xs text-muted-foreground">Create a participation contract</p>
                </div>
              </Command.Item>
            )}
            {pipeline && showAccounting && (
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
              onSelect={toggleThemeQuick}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Sun className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Toggle Dark Mode</p>
                <p className="text-xs text-muted-foreground">Invert theme (full persistence in preferences)</p>
              </div>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pages</span>}
            className="mb-2"
          >
            {pipeline && (
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
              value="events review queue"
              onSelect={() => go('/?filter=events_review')}
              className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
            >
              <Home className="h-4 w-4 shrink-0 opacity-70" />
              <div>
                <p className="font-medium">Events Review</p>
                <p className="text-xs text-muted-foreground">Dashboard filter · pending events</p>
              </div>
            </Command.Item>
            )}
            {pipeline && (
              <Command.Item
                value="all contracts list"
                onSelect={() => go('/contracts')}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
              >
                <FileText className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-medium">All Contracts</p>
                  <p className="text-xs text-muted-foreground">Full directory</p>
                </div>
              </Command.Item>
            )}
            {isAdmin && (
              <>
                <Command.Item
                  value="sales reps"
                  onSelect={() => go('/sales-reps')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <UserRound className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Sales Reps</p>
                    <p className="text-xs text-muted-foreground">Admin</p>
                  </div>
                </Command.Item>
                <Command.Item
                  value="users app"
                  onSelect={() => go('/users')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Users className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Users</p>
                    <p className="text-xs text-muted-foreground">Admin</p>
                  </div>
                </Command.Item>
                <Command.Item
                  value="events admin"
                  onSelect={() => go('/events')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                >
                  <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                  <div>
                    <p className="font-medium">Events</p>
                    <p className="text-xs text-muted-foreground">Admin · event catalog</p>
                  </div>
                </Command.Item>
              </>
            )}
          </Command.Group>

          {contracts && contracts.length > 0 && (
            <Command.Group
              heading={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contracts</span>}
            >
              {contracts.map((c) => {
                const signer = c.signer_1_name ?? c.signer_1_email ?? '';
                const rep = c.sales_rep_name ?? c.sales_rep_email ?? '';
                const keywords = [c.exhibitor_company_name, signer, rep, c.signer_1_email ?? '', formatStatus(c.status)].join(
                  ' ',
                );
                return (
                  <Command.Item
                    key={c.id}
                    value={`${c.exhibitor_company_name} ${keywords}`}
                    keywords={[signer, rep, c.signer_1_email].filter((x): x is string => Boolean(x))}
                    onSelect={() => go(`/contracts/${c.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm data-[selected=true]:border-l-2 data-[selected=true]:border-accent-brand data-[selected=true]:bg-accent/40"
                  >
                    <FileText className="h-4 w-4 shrink-0 opacity-70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.exhibitor_company_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatStatus(c.status)}
                        {signer ? ` · ${signer}` : ''}
                        {rep ? ` · ${rep}` : ''}
                      </p>
                    </div>
                  </Command.Item>
                );
              })}
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
