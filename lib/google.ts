import { google } from 'googleapis';

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

/**
 * Merge template tokens and return PDF bytes (no Drive upload).
 * Used for DocuSign: same merge as draft, but merge map uses anchor strings instead of blank lines.
 */
export async function renderContractPdfFromTemplate(
  templateDocId: string,
  mergeMap: Record<string, string>,
  tempDocLabel: string,
): Promise<Buffer> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  const copy = await drive.files.copy({
    fileId: templateDocId,
    requestBody: { name: `TEMP_${tempDocLabel}` },
    supportsAllDrives: true,
  });
  const tempDocId = copy.data.id!;

  try {
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

    const pdfResp = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(pdfResp.data as ArrayBuffer);
  } finally {
    await drive.files
      .delete({
        fileId: tempDocId,
        supportsAllDrives: true,
      })
      .catch((err: Error) => {
        console.warn('Failed to clean up temp doc:', err.message);
      });
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
): Promise<{ fileId: string; webViewLink: string }> {
  const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, outputFileName);
  return uploadPdfBufferToFolder(pdfBytes, outputFileName, destinationFolderId);
}
