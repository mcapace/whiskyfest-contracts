import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SearchParams = { c?: string; t?: string };

/** Public signing landing — button click opens DocuSign (email scanners cannot consume the session). */
export default function ExhibitorSignLandingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const contractId = searchParams.c?.trim() ?? '';
  const token = searchParams.t?.trim() ?? '';

  if (!contractId || !token) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
        <h1 className="text-xl font-semibold">Signing link invalid</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          This link is incomplete. Open the email from your event coordinator and use the &quot;Review and sign
          agreement&quot; button, or reply to that email for help.
        </p>
      </main>
    );
  }

  const signingApiUrl = `/api/contracts/${encodeURIComponent(contractId)}/docusign-sign?t=${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 font-sans text-foreground">
      <h1 className="text-xl font-semibold">Review and sign your agreement</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        When you are ready, continue below to open the secure DocuSign signing page. No Shanken login is required.
      </p>
      <p className="mt-6">
        <Link
          href={signingApiUrl}
          className="inline-flex items-center justify-center rounded-md bg-[#6b3822] px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-[#5a2f1c]"
        >
          Continue to sign
        </Link>
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        If you have questions, reply to the email from your event coordinator.
      </p>
    </main>
  );
}
