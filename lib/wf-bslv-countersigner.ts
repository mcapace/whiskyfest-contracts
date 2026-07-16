/**
 * Shanken DocuSign countersigners for WhiskyFest and Big Smoke.
 * NYWE is separate — Susannah Nolan only (`nywe-countersigner.ts`).
 */
export const WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS = [
  'lmott@mshanken.com', // Liz Mott
  'nmazza@mshanken.com', // Nicole Mazza
  'talper@mshanken.com', // Tobi Alper
] as const;

export const WF_BS_COUNTERSIGN_GROUP_LABEL = 'Liz Mott, Nicole Mazza, or Tobi Alper';

const WF_BS_COUNTERSIGNERS = new Set<string>(WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS);

export function isWhiskyfestBigSmokeCountersignerEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && WF_BS_COUNTERSIGNERS.has(normalized));
}

/** Primary DocuSign routing-2 recipient on event records (default Nicole). */
export function primaryWhiskyfestBigSmokeCountersignerEmail(
  eventSignatoryEmail: string | null | undefined,
): string {
  const fromEvent = eventSignatoryEmail?.trim().toLowerCase();
  if (fromEvent && WF_BS_COUNTERSIGNERS.has(fromEvent)) return fromEvent;
  return 'nmazza@mshanken.com';
}
