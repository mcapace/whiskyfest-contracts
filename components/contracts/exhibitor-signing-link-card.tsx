'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  signerName: string | null;
  signerEmail: string | null;
  signingLandingUrl: string;
  signingApiUrl: string;
};

/** Staff-only helper — exhibitors sign via DocuSign, not the PDF preview on this page. */
export function ExhibitorSigningLinkCard({
  signerName,
  signerEmail,
  signingLandingUrl,
  signingApiUrl,
}: Props) {
  const [copied, setCopied] = useState<'landing' | 'api' | null>(null);

  async function copy(url: string, which: 'landing' | 'api') {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this exhibitor signing link:', url);
    }
  }

  const label = signerName?.trim() || signerEmail?.trim() || 'the exhibitor';

  return (
    <div className="rounded-lg border border-amber-300/80 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
      <p className="font-semibold">Exhibitor signing (not this page)</p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        The PDF preview below is <strong>staff view only</strong> — {label} cannot sign here. Send a personal
        note or share the signing link below. Test in a <strong>private/incognito</strong> window (not while
        logged into this portal).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="border-amber-400/80 bg-white" asChild>
          <a href={signingLandingUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open signing page
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-400/80 bg-white"
          onClick={() => copy(signingLandingUrl, 'landing')}
        >
          {copied === 'landing' ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          Copy signing link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-amber-900/80"
          onClick={() => copy(signingApiUrl, 'api')}
        >
          {copied === 'api' ? 'Copied direct link' : 'Copy direct DocuSign link'}
        </Button>
      </div>
    </div>
  );
}
