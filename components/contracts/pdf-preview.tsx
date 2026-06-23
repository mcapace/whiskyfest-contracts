'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export function PdfPreview({
  fileUrl,
  caption,
}: {
  fileUrl: string;
  caption?: string;
}) {
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pageNumbers = useMemo(() => Array.from({ length: pages }, (_, idx) => idx + 1), [pages]);

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Inline PDF preview is unavailable right now. You can still open or download the contract PDF.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">{caption ?? 'Inline preview'}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}>
            -
          </Button>
          <span className="text-xs tabular-nums text-ink-600">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}>
            +
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={fileUrl} target="_blank" rel="noreferrer">
              Download
            </a>
          </Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-parchment-200 bg-white p-3">
        <Document
          key={fileUrl}
          file={fileUrl}
          onLoadSuccess={(doc) => {
            setLoadError(null);
            setPages(doc.numPages);
          }}
          onLoadError={(err) => {
            console.error('[PdfPreview] load failed', err);
            setLoadError(err?.message ?? 'Failed to load PDF');
          }}
          loading={<p className="text-sm text-ink-500">Loading PDF…</p>}
          error={
            <p className="text-sm text-muted-foreground">
              Could not render this PDF inline.{' '}
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-accent-brand underline">
                Open PDF
              </a>
            </p>
          }
        >
          <div className="space-y-4">
            {pageNumbers.map((num) => (
              <Page key={num} pageNumber={num} scale={zoom} renderTextLayer renderAnnotationLayer />
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
