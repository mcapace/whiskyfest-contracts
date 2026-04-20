import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals, Event } from '@/types/db';

export const dynamic = 'force-dynamic';

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase.from('contracts_with_totals').select('*').order('updated_at', { ascending: false }).limit(500),
    supabase.from('events').select('*'),
  ]);

  const contracts = (rows ?? []) as ContractWithTotals[];
  const eventMap = new Map((events ?? []).map((e: Event) => [e.id, e]));

  const header = [
    'id',
    'status',
    'exhibitor_company',
    'exhibitor_legal',
    'event',
    'event_date',
    'grand_total_usd',
    'signer_email',
    'updated_at',
  ];

  const lines = [header.join(',')];
  for (const c of contracts) {
    const ev = eventMap.get(c.event_id);
    const totalUsd = (c.grand_total_cents / 100).toFixed(2);
    lines.push(
      [
        csvEscape(c.id),
        csvEscape(c.status),
        csvEscape(c.exhibitor_company_name),
        csvEscape(c.exhibitor_legal_name),
        csvEscape(ev?.name ?? ''),
        csvEscape(ev?.event_date ?? ''),
        csvEscape(totalUsd),
        csvEscape(c.signer_1_email),
        csvEscape(c.updated_at),
      ].join(',')
    );
  }

  const body = lines.join('\r\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="whiskyfest-contracts.csv"',
    },
  });
}
