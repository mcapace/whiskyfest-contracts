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
        The agreement is saved with status <span className="font-medium">Imported</span>.{' '}
        <a href={detailHref} className="font-semibold text-emerald-900 underline underline-offset-2">
          Open {label} →
        </a>{' '}
        or find it below (filter by Imported).
      </p>
      <p className="mt-2 text-xs text-emerald-900/75">
        Prefer the list?{' '}
        <Link href={`${portalBasePath}/contracts?status=imported`} className="underline underline-offset-2">
          Show imported contracts only
        </Link>
      </p>
    </div>
  );
}
