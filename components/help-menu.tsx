'use client';

import { useState } from 'react';
import { CircleHelp, Command, Info, LifeBuoy, PlayCircle } from 'lucide-react';
import { useCommandPalette } from '@/components/command-palette/command-palette';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ADMIN_MAILTO =
  'mailto:mcapace@mshanken.com?subject=' +
  encodeURIComponent('WhiskyFest Contracts app — question');

export function HelpMenu() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { setOpen } = useCommandPalette();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Help menu">
            <CircleHelp className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              window.dispatchEvent(new Event('wf:launch-tour'));
            }}
          >
            <PlayCircle className="mr-2 h-4 w-4" /> Take the tour
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <Command className="mr-2 h-4 w-4" /> Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              window.location.href = ADMIN_MAILTO;
            }}
          >
            <LifeBuoy className="mr-2 h-4 w-4" /> Contact admin
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAboutOpen(true);
            }}
          >
            <Info className="mr-2 h-4 w-4" /> About
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhiskyFest Contracts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Internal contract management for M. Shanken Communications.</p>
            <p>Version: {'{APP_VERSION}'}</p>
            <p>Last deployed: {'{DEPLOYMENT_DATE}'}</p>
            <p>Built with Next.js, Supabase, DocuSign, and a lot of coffee.</p>
            <p>
              Questions or issues? Contact{' '}
              <a className="underline underline-offset-2" href="mailto:mcapace@mshanken.com">
                Mike Capace
              </a>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
