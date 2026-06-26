import Link from 'next/link';
import { ArrowRight, List, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NyweQuickNav() {
  const links = [
    {
      href: '/wine-spectator/roster',
      title: 'Exhibitor roster',
      description: 'Google Sheet lists, bulk create & send',
      icon: Users,
    },
    {
      href: '/wine-spectator/contracts',
      title: 'All contracts',
      description: 'Search, filter, and open any exhibitor contract',
      icon: List,
    },
    {
      href: '/wine-spectator/contracts/new',
      title: 'New contract',
      description: 'Add a one-off exhibitor outside the roster',
      icon: Plus,
    },
  ] as const;

  return (
    <section className="grid gap-5 md:grid-cols-3 lg:gap-6">
      {links.map(({ href, title, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-start gap-4 rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-800 ring-1 ring-rose-100">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground group-hover:text-rose-900">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-rose-700" />
        </Link>
      ))}
    </section>
  );
}

export function NyweRosterPageHeader({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-800/70">Contract workflow</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">Exhibitor roster</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {eventName} — create contracts from Google Sheets, send via DocuSign, and write status back automatically.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/wine-spectator">Back to dashboard</Link>
      </Button>
    </div>
  );
}
