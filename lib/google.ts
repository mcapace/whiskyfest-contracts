import { google } from 'googleapis';

/**
 * Google API client using a service account.
 *
 * Setup:
 * 1. Create a Google Cloud project
 * 2. Enable Google Drive API + Google Docs API
 * 3. Create a service account, download the JSON key
 * 4. Base64-encode the entire JSON and set as GOOGLE_SERVICE_ACCOUNT_KEY env var
 * 5. Share the template Doc + Drafts folder + Signed folder with the service account's email
 *    (the service account email is in the JSON's client_email field)
 */

function getAuth() {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
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

export async function mergeAndExportPdf(
  templateDocId: string,
  mergeMap: Record<string, string>,
  outputFileName: string,
  destinationFolderId: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const docs  = google.docs({ version: 'v1', auth });

  // 1. Copy the template
  const copy = await drive.files.copy({
    fileId: templateDocId,
    requestBody: { name: `TEMP_${outputFileName}` },
  });
  const tempDocId = copy.data.id!;

  try {
    // 2. Build batch replace requests
    const requests = Object.entries(mergeMap).map(([token, value]) => ({
      replaceAllText: {
        containsText: { text: token, matchCase: true },
        replaceText:  value ?? '',
      },
    }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      });
    }

    // 3. Export as PDF
    const pdfResp = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );

    const pdfBytes = Buffer.from(pdfResp.data as ArrayBuffer);

    // 4. Upload the PDF to the destination folder
    const uploaded = await drive.files.create({
      requestBody: {
        name:     `${outputFileName}.pdf`,
        parents:  [destinationFolderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body:     require('stream').Readable.from(pdfBytes),
      },
      fields: 'id, webViewLink',
    });

    return {
      fileId:      uploaded.data.id!,
      webViewLink: uploaded.data.webViewLink!,
    };
  } finally {
    // 5. Clean up the temporary doc copy
    await drive.files.delete({ fileId: tempDocId }).catch(err => {
      console.warn('Failed to clean up temp doc:', err.message);
    });
  }
}
