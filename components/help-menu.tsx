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
          <DropdownMenuItem asChild>
            <a href="mailto:mcapace@mshanken.com">
              <LifeBuoy className="mr-2 h-4 w-4" /> Contact admin
            </a>
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
            <p>Version: 0.1.0</p>
            <p>Support: mcapace@mshanken.com</p>
            <p>Use Help → Take the tour anytime to replay onboarding.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
