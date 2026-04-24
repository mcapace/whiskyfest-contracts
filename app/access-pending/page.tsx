import Link from 'next/link';

export default function AccessPendingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const email = typeof searchParams?.email === 'string' ? searchParams.email : '';
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6">
      <div className="w-full rounded-xl border border-border/60 bg-card p-8 shadow-sm">
        <h1 className="wf-display-serif text-3xl">Access request submitted</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your access request has been submitted. An admin will review it shortly. You&apos;ll receive an email once
          your access is approved or denied.
        </p>
        {email ? (
          <p className="mt-4 rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">{email}</p>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Contact Mike Capace at{' '}
          <a href="mailto:mcapace@mshanken.com" className="underline underline-offset-2">
            mcapace@mshanken.com
          </a>{' '}
          if you need urgent access.
        </p>
        <div className="mt-6">
          <Link href="/auth/login" className="text-sm text-accent-brand underline underline-offset-2">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
