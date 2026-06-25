'use client';

import Link from 'next/link';

/** Shown on /contracts after a successful legacy import redirect. */
export function ImportSuccessBanner({
  contractId,
  exhibitorName,
  portalBasePath = '',
}: {
  contractId: string;
  exhibitorName: string | null;
  portalBasePath?: string;
}) {
  const detailHref = `${portalBasePath}/contracts/${contractId}`;
  const label = exhibitorName?.trim() || 'imported contract';

  return (
    <div
      className="rounded-lg border border-emerald-300/90 bg-emerald-50 px-4 py-4 text-emerald-950 shadow-sm"
      role="status"
    >
      <p className="font-semibold">Contract imported successfully</p>
      <p className="mt-1 text-sm leading-relaxed text-emerald-950/90">
        The legacy agreement is saved and queued for events review (same as a new deal).{' '}
        <a href={detailHref} className="font-semibold text-emerald-900 underline underline-offset-2">
          Open {label} →
        </a>{' '}
        or find it below under Pending Review.
      </p>
      <p className="mt-2 text-xs text-emerald-900/75">
        Events will approve, then release to accounting — no DocuSign send to the client.{' '}
        <Link href={`${portalBasePath}/contracts?status=pending_events_review`} className="underline underline-offset-2">
          Show pending review
        </Link>
      </p>
    </div>
  );
}
