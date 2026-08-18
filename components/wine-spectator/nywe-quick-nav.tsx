import Link from 'next/link';
import { QrCode, List, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NyweQuickNav() {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="NYWE shortcuts">
      <Button asChild size="sm" className="h-9">
        <Link href="/wine-spectator/roster">
          <Users className="h-3.5 w-3.5" />
          Exhibitor roster
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-9">
        <Link href="/wine-spectator/qr">
          <QrCode className="h-3.5 w-3.5" />
          Booth QR
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-9">
        <Link href="/wine-spectator/contracts">
          <List className="h-3.5 w-3.5" />
          All contracts
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-9">
        <Link href="/wine-spectator/contracts/new">
          <Plus className="h-3.5 w-3.5" />
          New license
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-9">
        <Link href="/wine-spectator/contracts/new?deal=sponsorship_only">
          <Plus className="h-3.5 w-3.5" />
          New sponsorship
        </Link>
      </Button>
    </nav>
  );
}

export function NyweRosterPageHeader({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col gap-4 border-b border-fest-600/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="wf-label-caps text-[0.65rem] text-fest-800">Exhibitor workbench</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">Roster</h1>
        <p className="mt-2 nywe-subhead text-sm text-muted-foreground">
          {eventName} — returning, new, and champagne lists. Open any row to work the&nbsp;contract.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/wine-spectator">Back to dashboard</Link>
      </Button>
    </div>
  );
}
