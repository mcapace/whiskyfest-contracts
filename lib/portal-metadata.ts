import type { Metadata } from 'next';
import { NYWE_LOGIN_TAGLINE, NYWE_PORTAL_TITLE } from '@/lib/nywe-copy';
import { portalKindFromHost, type PortalKind } from '@/lib/portal-host';

const WHISKYFEST_TITLE = 'WhiskyFest Contracts';
const WHISKYFEST_DESCRIPTION = 'Participation contract management — M. Shanken Communications';

export function portalFaviconPath(kind: PortalKind): string {
  return kind === 'nywe' ? '/images/favicon-nywe.png' : '/images/favicon-whiskyfest.png';
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

  return {
    title: WHISKYFEST_TITLE,
    description: WHISKYFEST_DESCRIPTION,
    icons,
  };
}
