/** Official Wine Spectator & Whisky Advocate wordmarks (light + dark background variants). */

export type BrandLogoVariant = 'default' | 'onDark';

export const NYWE_EVENT_LOGO = {
  src: '/images/nywe-logo.png',
  width: 514,
  height: 174,
  alt: 'New York Wine Experience',
} as const;

export const WINE_SPECTATOR_LOGO = {
  default: {
    src: '/images/wine-spectator-logo.png?v=5',
    width: 1035,
    height: 289,
    alt: 'Wine Spectator',
  },
  onDark: {
    src: '/images/wine-spectator-logo-white.png?v=5',
    width: 1035,
    height: 289,
    alt: 'Wine Spectator',
  },
} as const;

export const WHISKY_ADVOCATE_LOGO = {
  default: {
    src: '/images/whisky-advocate-logo.png',
    width: 227,
    height: 81,
    alt: 'Whisky Advocate',
  },
  onDark: {
    src: '/images/whisky-advocate-logo-white.png',
    width: 374,
    height: 135,
    alt: 'Whisky Advocate',
  },
} as const;

export const BIG_SMOKE_EVENT_LOGO = {
  src: '/images/big-smoke-logo.png',
  width: 1200,
  height: 675,
  alt: "Cigar Aficionado's Big Smoke Las Vegas 30th Anniversary",
} as const;

export const BIG_SMOKE_HERO_IMAGE = {
  src: '/images/big-smoke-hero.jpg',
  width: 1024,
  height: 576,
  alt: 'Big Smoke Las Vegas floor — exhibitors and guests',
} as const;

export const CIGAR_AFICIONADO_LOGO = {
  default: {
    src: '/images/cigar-aficionado-logo.png',
    width: 1024,
    height: 203,
    alt: 'Cigar Aficionado',
  },
  onDark: {
    src: '/images/cigar-aficionado-logo-white.png',
    width: 413,
    height: 83,
    alt: 'Cigar Aficionado',
  },
} as const;

export function brandLogoAsset(
  brand: 'wineSpectator' | 'whiskyAdvocate' | 'cigarAficionado',
  variant: BrandLogoVariant = 'default',
) {
  const set =
    brand === 'wineSpectator'
      ? WINE_SPECTATOR_LOGO
      : brand === 'whiskyAdvocate'
        ? WHISKY_ADVOCATE_LOGO
        : CIGAR_AFICIONADO_LOGO;
  return set[variant];
}
