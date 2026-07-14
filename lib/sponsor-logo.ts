/** Resolve a company/brand logo URL for sponsor directory cards. */

const GENERIC_EMAIL_HOSTS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'msn.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'mshanken.com',
]);

/** Known exhibitor / spirits brands → public website domain for logo lookup. */
const BRAND_OR_COMPANY_DOMAINS: Record<string, string> = {
  'remy cointreau': 'remy-cointreau.com',
  remy: 'remy-cointreau.com',
  bruichladdich: 'bruichladdich.com',
  octomore: 'bruichladdich.com',
  diageo: 'diageo.com',
  'johnnie walker': 'johnniewalker.com',
  'don julio': 'donjulio.com',
  bulleit: 'bulleit.com',
  tanqueray: 'tanqueray.com',
  'crown royal': 'crownroyal.com',
  'jim beam': 'jimbeam.com',
  'beam suntory': 'beamsuntory.com',
  constellation: 'cbrands.com',
  'constellation brands': 'cbrands.com',
  proximo: 'proximospirits.com',
  'proximo spirits': 'proximospirits.com',
  bacardi: 'bacardi.com',
  pernod: 'pernod-ricard.com',
  'pernod ricard': 'pernod-ricard.com',
  brown: 'brown-forman.com',
  'brown-forman': 'brown-forman.com',
  'brown forman': 'brown-forman.com',
  sazerac: 'sazerac.com',
  Campari: 'campari.com',
  campari: 'campari.com',
  'william grant': 'williamgrant.com',
  heavenly: 'heavenhill.com',
  'heaven hill': 'heavenhill.com',
  kirin: 'kirinholdings.com',
  moët: 'moet-hennessy.com',
  moet: 'moet-hennessy.com',
  hennessy: 'hennessy.com',
  glenfiddich: 'glenfiddich.com',
  theglenlivet: 'theglenlivet.com',
  'glen livet': 'theglenlivet.com',
  macallan: 'themacallan.com',
  lagavulin: 'malts.com',
};

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s&'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function domainFromEmail(email: string | null | undefined): string | null {
  const host = (email ?? '').split('@')[1]?.trim().toLowerCase();
  if (!host || GENERIC_EMAIL_HOSTS.has(host)) return null;
  return host;
}

export function domainFromBrandOrCompany(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const key = normalizeKey(name ?? '');
    if (!key) continue;
    if (BRAND_OR_COMPANY_DOMAINS[key]) return BRAND_OR_COMPANY_DOMAINS[key];
    for (const [brand, domain] of Object.entries(BRAND_OR_COMPANY_DOMAINS)) {
      if (key.includes(brand) || brand.includes(key)) return domain;
    }
  }
  return null;
}

/** Prefer logo.dev when a publishable token is configured; else Hunter (no key). */
export function sponsorLogoUrlForDomain(domain: string | null | undefined): string | null {
  const d = domain?.trim().toLowerCase();
  if (!d) return null;
  const logoDevToken = process.env['NEXT_PUBLIC_LOGO_DEV_TOKEN']?.trim();
  if (logoDevToken) {
    return `https://img.logo.dev/${encodeURIComponent(d)}?token=${encodeURIComponent(logoDevToken)}&size=256&format=png`;
  }
  return `https://logos.hunter.io/${encodeURIComponent(d)}`;
}

export function resolveSponsorLogoUrl(input: {
  companyName: string;
  signerEmail?: string | null;
  brandNames?: string[];
}): string | null {
  const fromEmail = domainFromEmail(input.signerEmail);
  const fromNames = domainFromBrandOrCompany(input.companyName, ...(input.brandNames ?? []));
  return sponsorLogoUrlForDomain(fromEmail ?? fromNames);
}
