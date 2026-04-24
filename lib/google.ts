import { google } from 'googleapis';
import { insertContractLineItemsIntoOrderTable } from '@/lib/google-contract-order-table';
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
export async function renderContractPdfFromTemplate(
  templateDocId: string,
  mergeMap: Record<string, string>,
  tempDocLabel: string,
  lineItems?: ContractLineItem[],
): Promise<Buffer> {
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

    if (lineItems?.length) {
      await insertContractLineItemsIntoOrderTable(docs, tempDocId, lineItems);
    }

    // supportsAllDrives is required for Shared Drive files (REST); googleapis Params type omits it.
    const pdfResp = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf', supportsAllDrives: true } as never,
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(pdfResp.data as ArrayBuffer);
    await deleteTempDoc();
    return buffer;
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
): Promise<{ fileId: string; webViewLink: string }> {
  const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, outputFileName, lineItems);
  return uploadPdfBufferToFolder(pdfBytes, outputFileName, destinationFolderId);
}
