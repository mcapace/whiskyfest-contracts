import type { docs_v1 } from 'googleapis';
import { formatCurrency } from '@/lib/utils';
import type { ContractLineItem } from '@/types/db';

type DocsClient = docs_v1.Docs;

function paragraphPlainText(p: docs_v1.Schema$Paragraph | null | undefined): string {
  if (!p?.elements) return '';
  return p.elements
    .map((el) => (el.textRun?.content ?? '').replace(/\n/g, ''))
    .join('')
    .trim();
}

function tableCellPlainText(cell: docs_v1.Schema$TableCell | null | undefined): string {
  if (!cell?.content) return '';
  const parts: string[] = [];
  for (const block of cell.content) {
    if (block.paragraph) parts.push(paragraphPlainText(block.paragraph));
  }
  return parts.join('\n').trim();
}

/** First valid insert index inside a paragraph (Docs requires insertText inside paragraph bounds). */
function paragraphInsertIndex(p: docs_v1.Schema$Paragraph | null | undefined): number | null {
  if (!p?.elements?.length) return null;
  const first = p.elements[0];
  if (first.startIndex == null) return null;
  return first.startIndex;
}

function cellInsertIndex(cell: docs_v1.Schema$TableCell | null | undefined): number | null {
  if (!cell?.content) return null;
  for (const block of cell.content) {
    if (block.paragraph) {
      const idx = paragraphInsertIndex(block.paragraph);
      if (idx != null) return idx;
    }
  }
  return null;
}

function rowCellInsertIndices(row: docs_v1.Schema$TableRow | null | undefined): (number | null)[] {
  if (!row?.tableCells?.length) return [];
  return row.tableCells.map((c) => cellInsertIndex(c));
}

export type ContractOrderTableLocation = {
  tableStartIndex: number;
  grandTotalRowIndex: number;
};

/**
 * Finds the CONTRACT ORDER-style table by locating a row whose first cell contains "GRAND TOTAL".
 */
export function locateContractOrderTable(
  document: docs_v1.Schema$Document | null | undefined,
): ContractOrderTableLocation | null {
  const content = document?.body?.content;
  if (!content) return null;

  for (const el of content) {
    if (el.startIndex == null || !el.table) continue;
    const rows = el.table.tableRows ?? [];
    for (let ri = 0; ri < rows.length; ri++) {
      const t0 = tableCellPlainText(rows[ri]?.tableCells?.[0]);
      if (/grand\s*total/i.test(t0)) {
        return { tableStartIndex: el.startIndex, grandTotalRowIndex: ri };
      }
    }
  }
  return null;
}

function tableAtStartIndex(
  document: docs_v1.Schema$Document | null | undefined,
  tableStartIndex: number,
): docs_v1.Schema$Table | null {
  const content = document?.body?.content;
  if (!content) return null;
  for (const el of content) {
    if (el.startIndex === tableStartIndex && el.table) return el.table;
  }
  return null;
}

/**
 * Inserts one table row per line item above the GRAND TOTAL row, then fills Description / Qty / Amount.
 */
export async function insertContractLineItemsIntoOrderTable(
  docs: DocsClient,
  documentId: string,
  lineItems: ContractLineItem[],
): Promise<void> {
  if (!lineItems.length) return;

  const { data: docAfterMerge } = await docs.documents.get({ documentId });
  const loc0 = locateContractOrderTable(docAfterMerge);
  if (!loc0) {
    console.warn('[contract PDF] No CONTRACT ORDER table with GRAND TOTAL row — skipping line item rows');
    return;
  }

  const { tableStartIndex, grandTotalRowIndex } = loc0;

  const rowInserts: docs_v1.Schema$Request[] = lineItems.map((_, i) => ({
    insertTableRow: {
      tableCellLocation: {
        tableStartLocation: { index: tableStartIndex },
        rowIndex: grandTotalRowIndex + i,
        columnIndex: 0,
      },
      insertBelow: false,
    },
  }));

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: rowInserts },
  });

  const { data: doc2 } = await docs.documents.get({ documentId });
  const loc1 = locateContractOrderTable(doc2);
  if (!loc1) {
    console.warn('[contract PDF] Could not re-locate table after row inserts');
    return;
  }

  const gtRow = loc1.grandTotalRowIndex;
  const firstDataRow = gtRow - lineItems.length;
  const table = tableAtStartIndex(doc2, loc1.tableStartIndex);
  if (!table?.tableRows) {
    console.warn('[contract PDF] Table body missing after inserts');
    return;
  }

  type TextOp = { index: number; text: string };
  const ops: TextOp[] = [];

  for (let i = 0; i < lineItems.length; i++) {
    const row = table.tableRows[firstDataRow + i];
    const idxs = rowCellInsertIndices(row);
    const descIdx = idxs[0];
    const qtyIdx = idxs[1] ?? idxs[0];
    const amtIdx = idxs[2] ?? idxs[idxs.length - 1];

    const item = lineItems[i]!;
    const amountDisplay = formatCurrency(item.amount_cents, { showCents: true });

    if (descIdx != null) ops.push({ index: descIdx, text: item.description });
    if (qtyIdx != null) ops.push({ index: qtyIdx, text: '1' });
    if (amtIdx != null) ops.push({ index: amtIdx, text: amountDisplay });
  }

  ops.sort((a, b) => b.index - a.index);

  const textRequests: docs_v1.Schema$Request[] = ops.map((op) => ({
    insertText: {
      location: { index: op.index },
      text: op.text,
    },
  }));

  if (textRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: textRequests },
    });
  }
}
