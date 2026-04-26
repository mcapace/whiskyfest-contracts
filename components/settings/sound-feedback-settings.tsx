'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/input';

export function SoundFeedbackSettings() {
  const { data: session, status, update } = useSession();
  const enabled = Boolean(session?.user?.sound_enabled);
  const busy = status === 'loading';

  return (
    <Card className="shadow-wf-editorial-sm">
      <CardHeader>
        <CardTitle className="font-display text-xl">Success feedback</CardTitle>
        <CardDescription>
          Optional short sound and a light vibration (on supported phones) after successful contract actions. Off by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="wf-sound-enabled" className="text-sm font-medium text-foreground">
              Sound and haptics
            </Label>
            <p id="wf-sound-enabled-hint" className="text-xs text-muted-foreground">
              Respects your device mute switch for audio where applicable.
            </p>
          </div>
          <button
            id="wf-sound-enabled"
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-describedby="wf-sound-enabled-hint"
            disabled={busy}
            onClick={() => void update({ soundEnabled: !enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              enabled ? 'bg-amber-600' : 'bg-muted-foreground/35'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-parchment-50 shadow transition-transform ${
                enabled ? 'left-5' : 'left-0.5'
              }`}
            />
            <span className="sr-only">{enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
