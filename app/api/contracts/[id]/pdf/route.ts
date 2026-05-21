import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractPdfAccess } from '@/lib/auth-contract';
import {
  contractDraftPdfPath,
  contractSignedPdfPath,
  createContractPdfSignedUrl,
} from '@/lib/contract-pdf-storage';
import { contractPrefersSignedPdf } from '@/lib/contract-pdf-preview';
import type { ContractStatus } from '@/types/db';

export const runtime = 'nodejs';

function redirectNoCache(url: string) {
  const res = NextResponse.redirect(url);
  res.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  return res;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractPdfAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const contract = gate.contract;
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get('variant') ?? 'auto';

  async function redirectForPath(path: string): Promise<NextResponse | null> {
    try {
      const signed = await createContractPdfSignedUrl(path);
      return redirectNoCache(signed);
    } catch {
      return null;
    }
  }

  const id = contract.id;
  const status = contract.status as ContractStatus;

  if (variant === 'draft') {
    let r = await redirectForPath(contractDraftPdfPath(id));
    if (r) return r;
    if (contract.pdf_storage_path?.endsWith('draft.pdf')) {
      r = await redirectForPath(contract.pdf_storage_path);
      if (r) return r;
    }
    if (contract.draft_pdf_url) return redirectNoCache(contract.draft_pdf_url);
    return NextResponse.json({ error: 'Draft PDF not available' }, { status: 404 });
  }

  if (variant === 'signed') {
    let r = await redirectForPath(contractSignedPdfPath(id));
    if (r) return r;
    if (contract.pdf_storage_path?.endsWith('signed.pdf')) {
      r = await redirectForPath(contract.pdf_storage_path);
      if (r) return r;
    }
    if (contract.signed_pdf_url && !/^https?:\/\//i.test(contract.signed_pdf_url)) {
      r = await redirectForPath(contract.signed_pdf_url);
      if (r) return r;
    }
    if (contract.signed_pdf_url) return redirectNoCache(contract.signed_pdf_url);
    return NextResponse.json({ error: 'Signed PDF not available' }, { status: 404 });
  }

  // auto / latest: pick by lifecycle, always prefer canonical storage paths (upserted in place)
  const preferSigned = contractPrefersSignedPdf(status);

  if (preferSigned) {
    let r = await redirectForPath(contractSignedPdfPath(id));
    if (r) return r;
    if (contract.pdf_storage_path?.endsWith('signed.pdf')) {
      r = await redirectForPath(contract.pdf_storage_path);
      if (r) return r;
    }
    if (contract.signed_pdf_url && !/^https?:\/\//i.test(contract.signed_pdf_url)) {
      r = await redirectForPath(contract.signed_pdf_url);
      if (r) return r;
    }
    if (contract.signed_pdf_url) return redirectNoCache(contract.signed_pdf_url);
  }

  let r = await redirectForPath(contractDraftPdfPath(id));
  if (r) return r;
  if (contract.pdf_storage_path?.endsWith('draft.pdf')) {
    r = await redirectForPath(contract.pdf_storage_path);
    if (r) return r;
  }
  if (contract.draft_pdf_url) return redirectNoCache(contract.draft_pdf_url);

  if (preferSigned) {
    r = await redirectForPath(contractSignedPdfPath(id));
    if (r) return r;
  }

  return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
}
