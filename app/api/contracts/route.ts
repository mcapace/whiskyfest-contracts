import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Contract } from '@/types/db';

const schema = z.object({
  event_id:               z.string().uuid(),
  exhibitor_legal_name:   z.string().min(1),
  exhibitor_company_name: z.string().min(1),
  exhibitor_address_line1: z.string().optional().nullable(),
  exhibitor_address_line2: z.string().optional().nullable(),
  exhibitor_city:          z.string().optional().nullable(),
  exhibitor_state:         z.string().max(120).optional().nullable(),
  exhibitor_zip:           z.string().max(24).optional().nullable(),
  exhibitor_country:       z.string().min(2).max(120),
  exhibitor_telephone:    z.string().optional().nullable(),
  brands_poured:          z.string().optional().nullable(),
  booth_count:            z.number().int().min(1),
  booth_rate_cents:       z.number().int().min(0),
  additional_brand_count: z.number().int().min(0).optional(),
  signer_1_name:          z.string().optional().nullable(),
  signer_1_title:         z.string().optional().nullable(),
  signer_1_email:         z.string().email().optional().or(z.literal('')).nullable(),
  sales_rep_id:           z.string().uuid({ message: 'Sales Rep is required' }),
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

  const p = parsed.data;
  const addrSlice: Pick<
    Contract,
    | 'exhibitor_address_line1'
    | 'exhibitor_address_line2'
    | 'exhibitor_city'
    | 'exhibitor_state'
    | 'exhibitor_zip'
    | 'exhibitor_country'
  > = {
    exhibitor_address_line1: p.exhibitor_address_line1 ?? null,
    exhibitor_address_line2: p.exhibitor_address_line2 ?? null,
    exhibitor_city:          p.exhibitor_city ?? null,
    exhibitor_state:         p.exhibitor_state ?? null,
    exhibitor_zip:           p.exhibitor_zip ?? null,
    exhibitor_country:       p.exhibitor_country ?? null,
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      event_id:               p.event_id,
      exhibitor_legal_name:   p.exhibitor_legal_name,
      exhibitor_company_name: p.exhibitor_company_name,
      exhibitor_address_line1: addrSlice.exhibitor_address_line1,
      exhibitor_address_line2: addrSlice.exhibitor_address_line2,
      exhibitor_city:          addrSlice.exhibitor_city,
      exhibitor_state:         addrSlice.exhibitor_state,
      exhibitor_zip:           addrSlice.exhibitor_zip,
      exhibitor_country:       addrSlice.exhibitor_country,
      exhibitor_telephone:     p.exhibitor_telephone ?? null,
      brands_poured:           p.brands_poured ?? null,
      booth_count:             p.booth_count,
      booth_rate_cents:        p.booth_rate_cents,
      signer_1_name:           p.signer_1_name ?? null,
      signer_1_title:          p.signer_1_title ?? null,
      signer_1_email:          p.signer_1_email ?? null,
      sales_rep_id:            p.sales_rep_id,
      notes:                   p.notes ?? null,
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
