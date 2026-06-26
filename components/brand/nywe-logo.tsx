import Image from 'next/image';
import Link from 'next/link';
import { brandLogoAsset, NYWE_EVENT_LOGO, type BrandLogoVariant } from '@/lib/brand-assets';
import { cn } from '@/lib/utils';

export type NyweLogoMark = 'event' | 'wineSpectator';

/** NYWE portal logos — event mark (sidebar) or Wine Spectator wordmark (hero, login). */
export function NyweLogo({
  href,
  className,
  imageClassName,
  priority = false,
  subtitle,
  mark = 'wineSpectator',
  variant = 'default',
  centered = false,
  /** @deprecated Use `variant="onDark"` instead. */
  onDark = false,
}: {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  subtitle?: string;
  /** `event` = NYWE logo file; `wineSpectator` = Wine Spectator wordmark. */
  mark?: NyweLogoMark;
  variant?: BrandLogoVariant;
  centered?: boolean;
  onDark?: boolean;
}) {
  const resolvedVariant = onDark ? 'onDark' : variant;
  const asset = mark === 'event' ? NYWE_EVENT_LOGO : brandLogoAsset('wineSpectator', resolvedVariant);

  const content = (
    <div className={cn('block', centered && 'mx-auto text-center', className)}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={cn(
          'h-auto w-full max-w-full object-contain',
          centered ? 'mx-auto object-center' : 'object-left',
          mark === 'wineSpectator' && resolvedVariant === 'onDark' && 'drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
          imageClassName,
        )}
      />
      {subtitle ? (
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
