import { google, type docs_v1 } from 'googleapis';
import {
  applyContractOrderTableDataRowFormatting,
  insertContractLineItemsIntoOrderTable,
} from '@/lib/google-contract-order-table';
import { buildAmendmentSectionRequests } from '@/lib/google-doc-amendment-sections';
import { buildParagraphEditRequests, unmatchedReplaceAllText } from '@/lib/google-doc-paragraph-edits';
import { buildRevisionDocRequests } from '@/lib/google-doc-revision-requests';
import type { ContractRevisionPlan } from '@/lib/contract-revision-plan';
import type { ContractLineItem } from '@/types/db';

/**
 * Google API client using a service account.
 *
 * Setup:
 * 1. Create a Google Cloud project
 * 2. Enable Google Drive API + Google Docs API
 * 3. Create a service account, download the JSON key
 * 4. Base64-encode the entire JSON and set as GOOGLE_SERVICE_ACCOUNT_KEY env var
 * 5. Add the service account as a member of the Shared Drive containing the
 *    template Doc and Drafts/Signed folders (role: Content manager)
 *    - Service accounts have no personal Drive quota, so files MUST live in a Shared Drive
 *    - Service account email is in the JSON's `client_email` field
 *
 * IMPORTANT: All Drive API calls below pass `supportsAllDrives: true` because
 * service accounts cannot see Shared Drive files without this flag (the API
 * defaults to searching only personal "My Drive" otherwise).
 */

function getAuth() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');

  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });
}

/** Shared Drive API client (service account). */
export function getGoogleDrive() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Merge template tokens and return PDF bytes (no Drive upload).
 * Used for DocuSign: same merge as draft, but merge map uses anchor strings instead of blank lines.
 */
export type RenderContractPdfOptions = {
  /** Sponsorship-only Google Doc has no booth row in CONTRACT ORDER table. */
  includeBoothRow?: boolean;
  /** Legacy: raw Docs requests applied after merge tokens. Prefer `revisionPlan`. */
  postMergeRevisionRequests?: docs_v1.Schema$Request[];
  /** Structured inline edits (phrase replacements + clause edits) applied after the merge. */
  revisionPlan?: ContractRevisionPlan | null;
  /**
   * When true, an edit whose find/anchor matches nothing fails the render instead of being
   * reported — use for real sends so nothing is silently dropped from a signed document.
   */
  strictRevision?: boolean;
  /** Skip the amendments-section finishing pass (heading cleanup / numbering). */
  skipAmendmentSectionFormatting?: boolean;
};

export type RenderRevisionReport = {
  /** Phrase finds that matched nothing in the merged document. */
  unmatchedText: string[];
  /** Clause edits whose anchor matched zero or several paragraphs. */
  unmatchedParagraphs: Array<{ op: string; anchor: string; reason: string }>;
  appliedParagraphEdits: number;
  appliedTextEdits: number;
};

export class RevisionEditsNotAppliedError extends Error {
  constructor(public readonly report: RenderRevisionReport) {
    super(describeUnappliedRevision(report));
    this.name = 'RevisionEditsNotAppliedError';
  }
}

export function describeUnappliedRevision(report: RenderRevisionReport): string {
  const parts: string[] = [];
  for (const find of report.unmatchedText) parts.push(`“${find.slice(0, 80)}” was not found in the contract`);
  for (const p of report.unmatchedParagraphs) {
    parts.push(`${p.op} “${p.anchor.slice(0, 60)}”: ${p.reason}`);
  }
  return `Some inline edits could not be applied — ${parts.join('; ')}. Adjust the wording or move the change to Additional Terms.`;
}

export async function renderContractPdfFromTemplate(
  templateDocId: string,
  mergeMap: Record<string, string>,
  tempDocLabel: string,
  lineItems?: ContractLineItem[],
  options?: RenderContractPdfOptions,
): Promise<Buffer> {
  const { pdf } = await renderContractPdfWithReport(templateDocId, mergeMap, tempDocLabel, lineItems, options);
  return pdf;
}

/** Same as renderContractPdfFromTemplate but also reports which revision edits did / did not apply. */
export async function renderContractPdfWithReport(
  templateDocId: string,
  mergeMap: Record<string, string>,
  tempDocLabel: string,
  lineItems?: ContractLineItem[],
  options?: RenderContractPdfOptions,
): Promise<{ pdf: Buffer; report: RenderRevisionReport }> {
  const includeBoothRow = options?.includeBoothRow !== false;
  const report: RenderRevisionReport = {
    unmatchedText: [],
    unmatchedParagraphs: [],
    appliedParagraphEdits: 0,
    appliedTextEdits: 0,
  };
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  const copy = await drive.files.copy({
    fileId: templateDocId,
    requestBody: { name: `TEMP_${tempDocLabel}` },
    supportsAllDrives: true,
  });
  const rawId = copy.data.id;
  if (!rawId) {
    throw new Error('Google Drive copy did not return a file id');
  }
  const tempDocId = rawId;

  async function deleteTempDoc(): Promise<void> {
    try {
      await drive.files.delete({
        fileId: tempDocId,
        supportsAllDrives: true,
      });
    } catch (err) {
      console.error('Failed to delete temp Doc', { tempDocId, err });
      // Do not throw — PDF generation may already have succeeded; this is cleanup only.
    }
  }

  try {
    // Merge values may include `\u000b` (vertical tab) for soft line breaks inside cells (see merge-map).
    const requests = Object.entries(mergeMap).map(([token, value]) => ({
      replaceAllText: {
        containsText: { text: token, matchCase: true },
        replaceText: value ?? '',
      },
    }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      });
    }

    const legacyRequests = options?.postMergeRevisionRequests ?? [];
    if (legacyRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests: legacyRequests },
      });
    }

    const plan = options?.revisionPlan ?? null;
    if (plan) {
      // 1. Phrase-level replacements — verified through occurrencesChanged.
      const textRequests = buildRevisionDocRequests(plan);
      if (textRequests.length > 0) {
        const res = await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: { requests: textRequests },
        });
        report.unmatchedText = unmatchedReplaceAllText(textRequests, res.data.replies ?? undefined);
        report.appliedTextEdits = textRequests.length - report.unmatchedText.length;
      }

      // 2. Clause-level edits against the merged document structure.
      if (plan.paragraph_edits.length > 0) {
        const { data: merged } = await docs.documents.get({ documentId: tempDocId });
        const edits = buildParagraphEditRequests(merged, plan.paragraph_edits);
        report.unmatchedParagraphs = edits.unmatched;
        report.appliedParagraphEdits = edits.applied.length;
        if (edits.requests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: tempDocId,
            requestBody: { requests: edits.requests },
          });
        }
      }

      if (
        options?.strictRevision &&
        (report.unmatchedText.length > 0 || report.unmatchedParagraphs.length > 0)
      ) {
        throw new RevisionEditsNotAppliedError(report);
      }
    }

    // 3. Amendments / notes sections: number the items, or remove the block when empty.
    if (!options?.skipAmendmentSectionFormatting) {
      const { data: current } = await docs.documents.get({ documentId: tempDocId });
      const sectionRequests = buildAmendmentSectionRequests(current, {
        hasAmendments: Boolean((mergeMap['{{revision_amendments}}'] ?? '').trim()),
        hasExhibitorNotes: Boolean((mergeMap['{{exhibitor_notes}}'] ?? '').trim()),
      });
      if (sectionRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: { requests: sectionRequests },
        });
      }
    }

    if (lineItems?.length) {
      await insertContractLineItemsIntoOrderTable(docs, tempDocId, lineItems);
    }

    await applyContractOrderTableDataRowFormatting(
      docs,
      tempDocId,
      lineItems?.length ?? 0,
      includeBoothRow,
    );

    // supportsAllDrives is required for Shared Drive files (REST); googleapis Params type omits it.
    const pdfResp = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf', supportsAllDrives: true } as never,
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(pdfResp.data as ArrayBuffer);
    await deleteTempDoc();
    return { pdf: buffer, report };
  } catch (e) {
    await deleteTempDoc();
    throw e;
  }
}

/** Upload an existing PDF buffer to Drive (e.g. signed file from DocuSign). */
export async function uploadPdfBufferToFolder(
  pdfBytes: Buffer,
  outputFileName: string,
  destinationFolderId: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const uploaded = await drive.files.create({
    requestBody: {
      name: `${outputFileName}.pdf`,
      parents: [destinationFolderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: require('stream').Readable.from(pdfBytes),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  return {
    fileId: uploaded.data.id!,
    webViewLink: uploaded.data.webViewLink!,
  };
}

export async function mergeAndExportPdf(
  templateDocId: string,
  mergeMap: Record<string, string>,
  outputFileName: string,
  destinationFolderId: string,
  lineItems?: ContractLineItem[],
  options?: RenderContractPdfOptions,
): Promise<{ fileId: string; webViewLink: string }> {
  const pdfBytes = await renderContractPdfFromTemplate(
    templateDocId,
    mergeMap,
    outputFileName,
    lineItems,
    options,
  );
  return uploadPdfBufferToFolder(pdfBytes, outputFileName, destinationFolderId);
}
