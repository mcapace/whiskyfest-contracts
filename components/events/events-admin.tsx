'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { Pencil, Loader2, Plus } from 'lucide-react';
import { formatCurrency, formatLongDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@/types/db';

interface Props {
  initialEvents: Event[];
  /** Wine Spectator admins may edit NYWE events only — no create. */
  wineSpectatorOnly?: boolean;
}

function emptyForm(wineSpectatorOnly = false) {
  return {
    name: '',
    tagline: '',
    location: '',
    event_date: '',
    venue: '',
    year: new Date().getFullYear(),
    booth_rate_dollars: wineSpectatorOnly ? 14000 : 15000,
    shanken_signatory_name: 'Nicole Mazza',
    shanken_signatory_title: 'Vice President, Events',
    shanken_signatory_email: 'nmazza@mshanken.com',
    is_active: true,
    product_key: 'whiskyfest',
    contract_template_profile: 'whiskyfest' as 'whiskyfest' | 'nywe_vendor',
    workflow_profile: 'sales_rep' as 'sales_rep' | 'events_managed',
    google_template_doc_id: '',
    contract_document_label: 'Contract',
  };
}

export function EventsAdmin({ initialEvents, wineSpectatorOnly = false }: Props) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm(wineSpectatorOnly));

  function loadEvent(ev: Event) {
    setEditingId(ev.id);
    setErr(null);
    setForm({
      name: ev.name,
      tagline: ev.tagline ?? '',
      location: ev.location ?? '',
      event_date: ev.event_date.slice(0, 10),
      venue: ev.venue ?? '',
      year: ev.year,
      booth_rate_dollars: ev.booth_rate_cents / 100,
      shanken_signatory_name: ev.shanken_signatory_name,
      shanken_signatory_title: ev.shanken_signatory_title,
      shanken_signatory_email: ev.shanken_signatory_email,
      is_active: ev.is_active,
      product_key: ev.product_key ?? 'whiskyfest',
      contract_template_profile: (ev.contract_template_profile === 'nywe_vendor' ? 'nywe_vendor' : 'whiskyfest'),
      workflow_profile: (ev.workflow_profile === 'events_managed' ? 'events_managed' : 'sales_rep'),
      google_template_doc_id: ev.google_template_doc_id ?? '',
      contract_document_label: ev.contract_document_label ?? 'Contract',
    });
  }

  function newEvent() {
    setEditingId(null);
    setErr(null);
    setForm(emptyForm(wineSpectatorOnly));
  }

  function set<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (readOnly) return;

    if (!form.name.trim()) {
      setErr('Event name is required');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.event_date)) {
      setErr('Event date must be YYYY-MM-DD');
      return;
    }

    const booth_rate_cents = Math.round(form.booth_rate_dollars * 100);
    if (!Number.isFinite(booth_rate_cents) || booth_rate_cents < 0) {
      setErr('Booth rate must be a valid amount');
      return;
    }

    const payload = {
      name: form.name.trim(),
      tagline: form.tagline || null,
      location: form.location || null,
      event_date: form.event_date,
      venue: form.venue || null,
      year: form.year,
      booth_rate_cents,
      shanken_signatory_name: form.shanken_signatory_name || null,
      shanken_signatory_title: form.shanken_signatory_title || null,
      shanken_signatory_email: form.shanken_signatory_email || null,
      is_active: form.is_active,
      product_key: form.product_key.trim() || 'whiskyfest',
      contract_template_profile: form.contract_template_profile,
      workflow_profile: form.workflow_profile,
      google_template_doc_id: form.google_template_doc_id.trim() || null,
      contract_document_label: form.contract_document_label.trim() || 'Contract',
    };

    startTransition(async () => {
      const url = editingId ? `/api/events/${editingId}` : '/api/events';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Save failed (${res.status})`);
        return;
      }
      newEvent();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{editingId ? 'Edit event' : wineSpectatorOnly ? 'Event settings' : 'Add event'}</CardTitle>
          <CardDescription>
            {editingId
              ? 'Update details below, then save.'
              : wineSpectatorOnly
                ? 'Select a New York Wine Experience event from the list to edit.'
                : 'Create a new WhiskyFest event for the intake form.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wineSpectatorOnly && !editingId ? (
            <p className="text-sm text-muted-foreground">Choose an event on the right to update NYWE settings.</p>
          ) : (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name">
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="WhiskyFest New York" required />
            </Field>
            <Field label="Tagline">
              <Input value={form.tagline} onChange={e => set('tagline', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location">
                <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="NEW YORK" />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  value={form.year}
                  onChange={e => set('year', Math.max(2000, parseInt(e.target.value, 10) || form.year))}
                />
              </Field>
            </div>
            <Field label="Event date">
              <Input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required />
            </Field>
            <Field label="Venue">
              <Input value={form.venue} onChange={e => set('venue', e.target.value)} />
            </Field>
            <Field label={form.contract_template_profile === 'nywe_vendor' ? 'License fee (USD)' : 'Booth rate (USD per booth)'}>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.booth_rate_dollars}
                onChange={e => set('booth_rate_dollars', parseFloat(e.target.value) || 0)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product key">
                <Input value={form.product_key} onChange={e => set('product_key', e.target.value)} placeholder="whiskyfest" />
              </Field>
              <Field label="Document label">
                <Input
                  value={form.contract_document_label}
                  onChange={e => set('contract_document_label', e.target.value)}
                  placeholder="Contract"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Template profile">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.contract_template_profile}
                  onChange={e => set('contract_template_profile', e.target.value as 'whiskyfest' | 'nywe_vendor')}
                >
                  <option value="whiskyfest">WhiskyFest contract</option>
                  <option value="nywe_vendor">NYWE vendor license</option>
                </select>
              </Field>
              <Field label="Workflow">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.workflow_profile}
                  onChange={e => set('workflow_profile', e.target.value as 'sales_rep' | 'events_managed')}
                >
                  <option value="sales_rep">Sales rep</option>
                  <option value="events_managed">Events team only</option>
                </select>
              </Field>
            </div>
            <Field label="Google template doc ID">
              <Input
                value={form.google_template_doc_id}
                onChange={e => set('google_template_doc_id', e.target.value)}
                placeholder="1rZ7ssXQV3cXnxvwnn4SmRMUljCWcC7XEV7mzQwbNJFw"
              />
              <p className="text-xs text-muted-foreground">
                Per-event booth/vendor Google Doc. Falls back to env when empty.
              </p>
            </Field>
            <div className="border-t border-border/50 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Shanken signatory</p>
              <div className="space-y-3">
                <Field label="Name">
                  <Input value={form.shanken_signatory_name} onChange={e => set('shanken_signatory_name', e.target.value)} />
                </Field>
                <Field label="Title">
                  <Input value={form.shanken_signatory_title} onChange={e => set('shanken_signatory_title', e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.shanken_signatory_email} onChange={e => set('shanken_signatory_email', e.target.value)} />
                </Field>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="rounded border-input"
              />
              Active (shown in new contract form)
            </label>
            {err && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy} title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Create event'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={newEvent}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Events</CardTitle>
            <CardDescription>{initialEvents.length} configured</CardDescription>
          </div>
          {!wineSpectatorOnly ? (
            <Button variant="outline" size="sm" onClick={newEvent}>
              <Plus className="h-4 w-4" /> New
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {initialEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Add one on the left.</p>
          ) : (
            <ul className="divide-y divide-border/50 rounded-md border border-border/50">
              {initialEvents.map(ev => (
                <li key={ev.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ev.name}</span>
                      {!ev.is_active && (
                        <Badge className="border-border bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLongDate(ev.event_date)} · {ev.location ?? '—'} ·{' '}
                      {ev.contract_template_profile === 'nywe_vendor'
                        ? `${formatCurrency(ev.booth_rate_cents)} license`
                        : `${formatCurrency(ev.booth_rate_cents)} / booth`}
                      {ev.product_key ? ` · ${ev.product_key}` : ''}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => loadEvent(ev)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
