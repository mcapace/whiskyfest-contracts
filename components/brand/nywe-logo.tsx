import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/images/nywe-logo.png';

export function NyweLogo({
  href,
  className,
  imageClassName,
  priority = false,
  subtitle,
  /** Hero / photo backgrounds — transparent PNG with a soft shadow for legibility. */
  onDark = false,
}: {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  subtitle?: string;
  onDark?: boolean;
}) {
  const content = (
    <div className={cn('block', className)}>
      <Image
        src={LOGO_SRC}
        alt="Wine Spectator New York Wine Experience"
        width={514}
        height={174}
        priority={priority}
        className={cn(
          'h-auto w-full object-contain',
          onDark && 'drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
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
