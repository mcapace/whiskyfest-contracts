/** Official Wine Spectator & Whisky Advocate wordmarks (light + dark background variants). */

export type BrandLogoVariant = 'default' | 'onDark';

export const WINE_SPECTATOR_LOGO = {
  default: {
    src: '/images/wine-spectator-logo.png',
    width: 1024,
    height: 277,
    alt: 'Wine Spectator',
  },
  onDark: {
    src: '/images/wine-spectator-logo-white.png',
    width: 1024,
    height: 278,
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

export function brandLogoAsset(
  brand: 'wineSpectator' | 'whiskyAdvocate',
  variant: BrandLogoVariant = 'default',
) {
  const set = brand === 'wineSpectator' ? WINE_SPECTATOR_LOGO : WHISKY_ADVOCATE_LOGO;
  return set[variant];
}
