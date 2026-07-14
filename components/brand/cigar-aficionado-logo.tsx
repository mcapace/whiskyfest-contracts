import Image from 'next/image';
import Link from 'next/link';
import { brandLogoAsset, type BrandLogoVariant } from '@/lib/brand-assets';
import { cn } from '@/lib/utils';

/** Cigar Aficionado wordmark — Big Smoke contracts portal. */
export function CigarAficionadoLogo({
  href,
  className,
  imageClassName,
  priority = false,
  variant = 'default',
}: {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  variant?: BrandLogoVariant;
}) {
  const asset = brandLogoAsset('cigarAficionado', variant);

  const content = (
    <div className={cn('block', className)}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={cn(
          'h-auto w-full object-contain',
          variant === 'onDark' && 'drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
          imageClassName,
        )}
        sizes="(max-width: 768px) 240px, 360px"
      />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
