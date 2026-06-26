import Link from 'next/link';
import { List, Plus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ACCENTS = [
  'text-fest-700 bg-fest-100/80 ring-fest-300/40',
  'text-whisky-800 bg-whisky-100/80 ring-whisky-300/40',
  'text-amber-800 bg-amber-100/70 ring-amber-300/40',
] as const;

export function NyweQuickNav() {
  const links: { href: string; title: string; description: string; icon: LucideIcon }[] = [
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
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-medium text-foreground">Quick links</h2>
        <p className="mt-1 text-sm text-muted-foreground">Roster workflow and contract management</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {links.map(({ href, title, description, icon: Icon }, index) => (
          <Link key={href} href={href} className="group block h-full">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-fest-600/25 hover:shadow-wf-editorial-sm">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md ring-1',
                    ACCENTS[index % ACCENTS.length],
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NyweRosterPageHeader({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col gap-4 border-b border-fest-600/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="wf-label-caps text-[0.65rem] text-fest-800">Contract workflow</p>
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
