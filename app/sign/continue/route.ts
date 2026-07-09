import { handleExhibitorDocuSignSignRedirect } from '@/lib/exhibitor-docusign-sign-redirect';

export const runtime = 'nodejs';

/** Exhibitor signing redirect — not under /api/ so corporate proxies are less likely to strip tokens. */
async function handle(req: Request): Promise<Response> {
  let contractId = '';
  let token = '';

  if (req.method === 'POST') {
    const form = await req.formData();
    contractId = String(form.get('c') ?? '').trim();
    token = String(form.get('t') ?? '').trim();
  } else {
    const url = new URL(req.url);
    contractId = url.searchParams.get('c')?.trim() ?? '';
    token = url.searchParams.get('t')?.trim() ?? '';
  }

  return handleExhibitorDocuSignSignRedirect(contractId, token);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
