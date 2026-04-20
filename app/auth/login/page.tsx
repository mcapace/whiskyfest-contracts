import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brass-50/90 via-background to-background px-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-6 h-28 w-full max-w-sm">
            <Image
              src="/images/whiskyfest-ny25-logo.png"
              alt="WhiskyFest New York"
              fill
              className="object-contain"
              sizes="(max-width: 448px) 100vw, 448px"
              priority
            />
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brass-700">
            M. Shanken Communications
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            Participation contracts
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your @mshanken.com Google account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border/60 bg-card p-8 shadow-sm">
          <form action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}>
            <Button type="submit" size="lg" className="w-full">
              <GoogleIcon /> Continue with Google
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Access restricted to @mshanken.com workspace accounts.
            <br />
            If you need access, contact Michael Capace.
          </p>
        </div>

        {/* Footer mark */}
        <p className="mt-10 text-center font-serif text-xs italic text-muted-foreground">
          Whisky Advocate · Wine Spectator · Cigar Aficionado
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
