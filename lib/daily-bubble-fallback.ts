import type { DailyBubblePublic } from '@/types/db';

/** Curated tips when no `daily_bubbles` row exists for Eastern today (cron/key/migration gaps). */
const CURATED_FACTS: readonly string[] = [
  'Single malt Scotch is distilled at one distillery from malted barley; blended Scotch combines malts and grains.',
  'Bourbon must be made in the U.S. with at least 51% corn and aged in new charred oak containers.',
  'Irish whiskey is typically triple-distilled for a lighter, smoother character than many Scotch malts.',
  'Rye whiskey in the U.S. must contain at least 51% rye in its mash bill.',
  'The “angel’s share” is the portion of whisky lost to evaporation each year in the cask.',
  'A whisky’s age statement reflects the youngest spirit in the bottle.',
  'Speyside is home to more than half of Scotland’s malt distilleries.',
  'Japanese whisky often reflects Scotch traditions while developing its own delicate house styles.',
  'Cask strength whisky is bottled near barrel proof—add water to taste and open up aromas.',
  'Terroir in whisky shows up in barley, water, yeast, and especially the influence of wood and time.',
];

function pickIndexForDate(contentDate: string): number {
  let h = 0;
  for (let i = 0; i < contentDate.length; i++) h = (h + contentDate.charCodeAt(i)!) * 31;
  return Math.abs(h) % CURATED_FACTS.length;
}

/** Deterministic per Eastern calendar day; not stored in DB. */
export function staticFallbackBubble(contentDate: string): DailyBubblePublic {
  const content = CURATED_FACTS[pickIndexForDate(contentDate)]!;
  return {
    id: `static-${contentDate}`,
    content_date: contentDate,
    content_type: 'fact',
    content,
    attribution: 'WhiskyFest',
    generated_at: new Date().toISOString(),
    generated_by: 'static',
    removed_at: null,
    removed_by: null,
    removed_reason: null,
  };
}
