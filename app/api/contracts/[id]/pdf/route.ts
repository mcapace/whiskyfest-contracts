import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractPdfAccess } from '@/lib/auth-contract';
import {
  contractDraftPdfPath,
  contractSignedPdfPath,
  createContractPdfSignedUrl,
} from '@/lib/contract-pdf-storage';

export const runtime = 'nodejs';

function tryRedirect(url: string) {
  return NextResponse.redirect(url);
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
      return tryRedirect(signed);
    } catch {
      return null;
    }
  }

  const id = contract.id;

  if (variant === 'draft') {
    let r = await redirectForPath(contractDraftPdfPath(id));
    if (r) return r;
    if (contract.pdf_storage_path?.endsWith('draft.pdf')) {
      r = await redirectForPath(contract.pdf_storage_path);
      if (r) return r;
    }
    if (contract.draft_pdf_url) return tryRedirect(contract.draft_pdf_url);
    return NextResponse.json({ error: 'Draft PDF not available' }, { status: 404 });
  }

  if (variant === 'signed') {
    let r = await redirectForPath(contractSignedPdfPath(id));
    if (r) return r;
    if (contract.pdf_storage_path?.endsWith('signed.pdf')) {
      r = await redirectForPath(contract.pdf_storage_path);
      if (r) return r;
    }
    if (contract.signed_pdf_url) return tryRedirect(contract.signed_pdf_url);
    return NextResponse.json({ error: 'Signed PDF not available' }, { status: 404 });
  }

  if (contract.pdf_storage_path) {
    const r = await redirectForPath(contract.pdf_storage_path);
    if (r) return r;
  }

  const legacy = contract.signed_pdf_url ?? contract.draft_pdf_url;
  if (legacy) return tryRedirect(legacy);

  return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
}
