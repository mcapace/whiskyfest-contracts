import { handleExhibitorDocuSignSignRedirect } from '@/lib/exhibitor-docusign-sign-redirect';

export const runtime = 'nodejs';

/** Legacy/direct signing redirect — prefer /sign/continue from the landing page. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('t');
  return handleExhibitorDocuSignSignRedirect(params.id, token);
}
