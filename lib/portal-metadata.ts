import type { Metadata } from 'next';
import { BIG_SMOKE_LOGIN_TAGLINE, BIG_SMOKE_PORTAL_TITLE } from '@/lib/big-smoke-copy';
import { NYWE_LOGIN_TAGLINE, NYWE_PORTAL_TITLE } from '@/lib/nywe-copy';
import { portalKindFromHost, type PortalKind } from '@/lib/portal-host';

const WHISKYFEST_TITLE = 'WhiskyFest Contracts';
const WHISKYFEST_DESCRIPTION = 'Participation contract management — M. Shanken Communications';

export function portalFaviconPath(kind: PortalKind): string {
  if (kind === 'nywe') return '/images/favicon-nywe.png';
  if (kind === 'big_smoke') return '/images/big-smoke-logo.png';
  return '/images/favicon-whiskyfest.png';
}

export function portalMetadataForHost(host: string | null | undefined): Metadata {
  return portalMetadata(portalKindFromHost(host));
}

export function portalMetadata(kind: PortalKind): Metadata {
  const icon = portalFaviconPath(kind);
  const icons: Metadata['icons'] = {
    icon: [{ url: icon, type: 'image/png' }],
    apple: [{ url: icon, type: 'image/png' }],
    shortcut: icon,
  };

  if (kind === 'nywe') {
    return {
      title: NYWE_PORTAL_TITLE,
      description: NYWE_LOGIN_TAGLINE,
      icons,
    };
  }

  if (kind === 'big_smoke') {
    return {
      title: BIG_SMOKE_PORTAL_TITLE,
      description: BIG_SMOKE_LOGIN_TAGLINE,
      icons,
    };
  }

  return {
    title: WHISKYFEST_TITLE,
    description: WHISKYFEST_DESCRIPTION,
    icons,
  };
}
