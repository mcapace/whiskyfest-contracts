import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().optional().nullable(),
  year: z.number().int().min(2000).max(2100),
  booth_rate_cents: z.number().int().min(0),
  shanken_signatory_name: z.string().optional().nullable(),
  shanken_signatory_title: z.string().optional().nullable(),
  shanken_signatory_email: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .insert({
      ...parsed.data,
      is_active: parsed.data.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
