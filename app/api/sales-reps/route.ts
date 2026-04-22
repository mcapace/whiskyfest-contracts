import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().endsWith('@mshanken.com', {
    message: 'Email must be @mshanken.com',
  }),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

/** Returns active sales reps by default. Use ?include_inactive=1 for admin screens. */
export async function GET(req: Request) {
  const gate = await requireAuth();
  if (!gate.ok) return gate.res;

  const includeInactive = new URL(req.url).searchParams.get('include_inactive') === '1';
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('sales_reps')
    .select('id, name, email, is_active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sales_reps: data ?? [] });
}

/** Admin-only create. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Invalid input';
    return NextResponse.json({ error: firstErr }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sales_reps')
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      sort_order: parsed.data.sort_order ?? 100,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A sales rep with that email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sales_rep: data });
}
