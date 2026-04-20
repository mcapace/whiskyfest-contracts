import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    tagline: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    venue: z.string().optional().nullable(),
    year: z.number().int().min(2000).max(2100).optional(),
    booth_rate_cents: z.number().int().min(0).optional(),
    shanken_signatory_name: z.string().optional().nullable(),
    shanken_signatory_title: z.string().optional().nullable(),
    shanken_signatory_email: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .update(parsed.data)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
