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
}: {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  subtitle?: string;
}) {
  const content = (
    <div className={cn('block', className)}>
      <div className="rounded-lg bg-black px-3 py-2.5">
        <Image
          src={LOGO_SRC}
          alt="Wine Spectator New York Wine Experience"
          width={514}
          height={174}
          priority={priority}
          className={cn('h-auto w-full object-contain', imageClassName)}
        />
      </div>
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
