import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const schema = z.object({
  event_id:               z.string().uuid(),
  exhibitor_legal_name:   z.string().min(1),
  exhibitor_company_name: z.string().min(1),
  exhibitor_address:      z.string().optional().nullable(),
  exhibitor_telephone:    z.string().optional().nullable(),
  brands_poured:          z.string().optional().nullable(),
  booth_count:            z.number().int().min(1),
  booth_rate_cents:       z.number().int().min(0),
  additional_brand_count: z.number().int().min(0),
  signer_1_name:          z.string().optional().nullable(),
  signer_1_title:         z.string().optional().nullable(),
  signer_1_email:         z.string().email().optional().or(z.literal('')).nullable(),
  notes:                  z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      ...parsed.data,
      created_by: session.user.email,
      status:     'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
