import { PRODUCT_BIG_SMOKE, productKeyFromEvent, type ProductKey } from '@/lib/product-portal';
import type { Event } from '@/types/db';

/**
 * Per-product Google Drive Drafts / Signed folders.
 * WhiskyFest + NYWE share the default env folders; Big Smoke uses its own Shared Drive folders.
 */
export function draftsFolderIdForProduct(productKey: ProductKey | null | undefined): string {
  if (productKey === PRODUCT_BIG_SMOKE) {
    const id =
      process.env['BIG_SMOKE_DRAFTS_FOLDER_ID']?.trim() ||
      process.env['GOOGLE_DRAFTS_FOLDER_ID']?.trim();
    if (!id) throw new Error('BIG_SMOKE_DRAFTS_FOLDER_ID (or GOOGLE_DRAFTS_FOLDER_ID) is not set');
    return id;
  }
  const id = process.env['GOOGLE_DRAFTS_FOLDER_ID']?.trim();
  if (!id) throw new Error('GOOGLE_DRAFTS_FOLDER_ID is not set');
  return id;
}

export function signedFolderIdForProduct(productKey: ProductKey | null | undefined): string {
  if (productKey === PRODUCT_BIG_SMOKE) {
    const id =
      process.env['BIG_SMOKE_SIGNED_FOLDER_ID']?.trim() ||
      process.env['GOOGLE_SIGNED_FOLDER_ID']?.trim();
    if (!id) throw new Error('BIG_SMOKE_SIGNED_FOLDER_ID (or GOOGLE_SIGNED_FOLDER_ID) is not set');
    return id;
  }
  const id = process.env['GOOGLE_SIGNED_FOLDER_ID']?.trim();
  if (!id) throw new Error('GOOGLE_SIGNED_FOLDER_ID is not set');
  return id;
}

export function draftsFolderIdForEvent(event: Pick<Event, 'product_key'> | null | undefined): string {
  return draftsFolderIdForProduct(productKeyFromEvent(event));
}

export function signedFolderIdForEvent(event: Pick<Event, 'product_key'> | null | undefined): string {
  return signedFolderIdForProduct(productKeyFromEvent(event));
}
