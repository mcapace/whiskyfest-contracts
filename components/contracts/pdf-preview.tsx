'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Browser-native PDF embed — avoids react-pdf/pdfjs (needs URL.parse, unavailable on older Edge/Chrome). */
export function PdfPreview({
  fileUrl,
  caption,
}: {
  fileUrl: string;
  caption?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">{caption ?? 'Inline preview'}</p>
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            Open / download PDF
          </a>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-parchment-200 bg-white shadow-sm">
        <iframe
          title="Contract PDF preview"
          src={fileUrl}
          className="h-[min(80vh,1100px)] w-full min-h-[480px] border-0"
        />
      </div>
    </div>
  );
}
