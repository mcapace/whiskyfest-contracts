import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LoginHero } from '@/components/auth/login-hero';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (session?.user) redirect('/');
  const err =
    typeof searchParams?.error === 'string' && searchParams.error === 'account_deactivated'
      ? 'Account deactivated. Contact Michael Capace for access.'
      : null;

  return (
    <div className="min-h-screen bg-parchment-50">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-5">
        <div className="relative h-[min(40vh,300px)] min-h-[200px] overflow-hidden lg:col-span-3 lg:h-screen">
          <LoginHero />
          <div className="absolute inset-0 bg-gradient-to-br from-oak-900/75 via-oak-900/40 to-oak-900/85" />
          <div className="relative flex h-full animate-login-mount flex-col justify-center px-6 py-8 text-parchment-50 sm:px-10 lg:px-12">
            <p className="font-sans text-xs uppercase tracking-[0.25em] text-amber-500">WhiskyFest 2026</p>
            <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl">
              Welcome back
            </h1>
            <p className="mt-4 font-display text-lg italic text-parchment-100 sm:text-2xl">
              WhiskyFest New York · November 20, 2026
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center bg-parchment-50 px-6 py-10 sm:px-10 lg:col-span-2 lg:p-12">
          <div className="w-full max-w-md animate-login-mount">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink-500">Sign in</p>
            <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-oak-800 sm:text-5xl">
              M. Shanken Operations
            </h2>
            <p className="mt-4 text-sm text-ink-700">Use your @mshanken.com Google account</p>

            <div className="mt-8 rounded-xl border border-parchment-200/90 bg-parchment-50/90 p-7 shadow-[0_18px_40px_-24px_rgba(42,31,15,0.55)] backdrop-blur-sm">
              {err ? <p className="mb-4 text-sm text-danger-base">{err}</p> : null}
              <form
                action={async () => {
                  'use server';
                  await signIn('google', { redirectTo: '/' });
                }}
              >
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full border border-oak-700/90 bg-oak-800 font-sans text-base font-medium tracking-tight text-parchment-50 shadow-sm transition hover:bg-oak-900 hover:text-parchment-50"
                >
                  <GoogleIcon /> Continue with Google
                </Button>
              </form>
              <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">
                Access restricted to @mshanken.com workspace accounts.
                <br />
                If you need access, contact Michael Capace.
              </p>
            </div>

            <p className="mt-10 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
              WhiskyFest 2026 · Marriott Marquis · New York
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
