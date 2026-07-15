import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const addSchema = z.object({
  assistant_email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .endsWith('@mshanken.com', { message: 'Assistant email must be @mshanken.com' }),
});

async function ensureAssistantAppUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('app_users')
    .select('role, is_active')
    .eq('email', email)
    .maybeSingle();

  if (!existing) {
    await supabase.from('app_users').insert({ email, role: 'sales', is_active: true });
    return;
  }

  const patch: { is_active: boolean; role?: string } = { is_active: true };
  if (existing.role === 'viewer') patch.role = 'sales';
  await supabase.from('app_users').update(patch).eq('email', email);
}

/** List assistants mapped to this sales rep. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rep_assistants')
    .select('id, assistant_email, rep_id, created_at')
    .eq('rep_id', params.id)
    .order('assistant_email', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assistants: data ?? [] });
}

/**
 * Add an assistant for this rep (same WhiskyFest / Big Smoke pipeline access model).
 * Ensures the assistant has an active app_users row so they can sign in.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Invalid input';
    return NextResponse.json({ error: firstErr }, { status: 400 });
  }

  const email = parsed.data.assistant_email;
  const supabase = getSupabaseAdmin();

  const { data: rep } = await supabase.from('sales_reps').select('id').eq('id', params.id).maybeSingle();
  if (!rep) return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('rep_assistants')
    .insert({ assistant_email: email, rep_id: params.id })
    .select('id, assistant_email, rep_id, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That assistant is already linked to this rep' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await ensureAssistantAppUser(email);
  return NextResponse.json({ assistant: data });
}

/** Remove an assistant mapping (body: { assistant_email }). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'assistant_email required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('rep_assistants')
    .delete()
    .eq('rep_id', params.id)
    .eq('assistant_email', parsed.data.assistant_email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
