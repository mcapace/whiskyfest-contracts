'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfPreview({ fileUrl }: { fileUrl: string }) {
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pageNumbers = useMemo(() => Array.from({ length: pages }, (_, idx) => idx + 1), [pages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">Inline preview</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}>-</Button>
          <span className="text-xs tabular-nums text-ink-600">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}>+</Button>
          <Button variant="outline" size="sm" asChild><a href={fileUrl} target="_blank" rel="noreferrer">Download</a></Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-parchment-200 bg-white p-3">
        <Document file={fileUrl} onLoadSuccess={(doc) => setPages(doc.numPages)} loading={<p className="text-sm text-ink-500">Loading PDF…</p>}>
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
