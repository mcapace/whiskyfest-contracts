import { getGoogleDrive } from '@/lib/google';

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const HOUR_MS = 60 * 60 * 1000;

export type DriveTempCleanupDetail = {
  id: string;
  name: string | null;
  action: 'deleted' | 'would_delete' | 'failed';
  error?: string;
};

export type DriveTempCleanupResult = {
  dryRun: boolean;
  rootFolderId: string;
  deleted: number;
  failed: number;
  /** Set only when dryRun — number of Google Docs that would be removed. */
  wouldDelete?: number;
  details: DriveTempCleanupDetail[];
};

function tooRecent(isoTime: string | null | undefined): boolean {
  if (!isoTime) return true;
  return new Date(isoTime).getTime() > Date.now() - HOUR_MS;
}

async function resolveContractsRootFolderId(
  drive: ReturnType<typeof getGoogleDrive>,
): Promise<string> {
  const explicit = process.env['GOOGLE_DRIVE_ROOT_FOLDER_ID']?.trim();
  if (explicit) return explicit;

  const templateId = process.env['GOOGLE_TEMPLATE_DOC_ID']?.trim();
  if (!templateId) {
    throw new Error('GOOGLE_TEMPLATE_DOC_ID is not set (needed to resolve root folder)');
  }

  const meta = await drive.files.get({
    fileId: templateId,
    fields: 'parents',
    supportsAllDrives: true,
  });
  const parents = meta.data.parents;
  if (!parents?.length) {
    throw new Error(
      'Template document has no parent folder. Set GOOGLE_DRIVE_ROOT_FOLDER_ID to the Shared Drive folder that contains the template (and Drafts/Signed subfolders).',
    );
  }
  return parents[0]!;
}

/**
 * Lists direct children of the contracts root folder and removes orphan Google Docs
 * (not the template; not PDFs; not folders). Only touches files older than 1h by both
 * created and modified time.
 */
export async function cleanupOrphanTempGoogleDocs(opts: {
  dryRun: boolean;
}): Promise<DriveTempCleanupResult> {
  const drive = getGoogleDrive();
  const rootFolderId = await resolveContractsRootFolderId(drive);
  const templateId = process.env['GOOGLE_TEMPLATE_DOC_ID']?.trim() ?? '';

  /** Scope list/delete to the correct corpus (Shared Drive vs My Drive). */
  let sharedDriveId: string | undefined;
  try {
    const rootMeta = await drive.files.get({
      fileId: rootFolderId,
      fields: 'driveId',
      supportsAllDrives: true,
    });
    sharedDriveId = rootMeta.data.driveId ?? undefined;
  } catch {
    sharedDriveId = undefined;
  }

  const listBase = {
    q: `'${rootFolderId}' in parents and trashed = false`,
    fields: 'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime)',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(sharedDriveId
      ? { corpora: 'drive' as const, driveId: sharedDriveId }
      : { corpora: 'allDrives' as const }),
  };

  const details: DriveTempCleanupDetail[] = [];
  let deleted = 0;
  let failed = 0;

  type ListedFile = {
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
    createdTime?: string | null;
    modifiedTime?: string | null;
  };

  const all: ListedFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      ...listBase,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      all.push(f as ListedFile);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  for (const f of all) {
    const id = f.id;
    if (!id) continue;

    const mime = f.mimeType ?? '';
    const name = f.name ?? null;

    if (mime === 'application/vnd.google-apps.folder') {
      continue;
    }
    if (mime !== GOOGLE_DOC_MIME) {
      continue;
    }
    if (id === templateId) {
      continue;
    }
    if (tooRecent(f.createdTime) || tooRecent(f.modifiedTime)) {
      continue;
    }

    if (opts.dryRun) {
      details.push({ id, name, action: 'would_delete' });
      continue;
    }

    try {
      await drive.files.delete({ fileId: id, supportsAllDrives: true });
      details.push({ id, name, action: 'deleted' });
      deleted++;
    } catch (err) {
      failed++;
      details.push({
        id,
        name,
        action: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const result: DriveTempCleanupResult = {
    dryRun: opts.dryRun,
    rootFolderId,
    deleted,
    failed,
    details,
  };

  if (opts.dryRun) {
    result.wouldDelete = details.filter((d) => d.action === 'would_delete').length;
  }

  return result;
}
