import { cn } from '@/lib/utils';

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header with an optional uppercase "kicker" label above the
 * title, an optional description below, and right-aligned action slot.
 *
 * Pattern matches the editorial-tier polish chosen in template B.
 */
export function PageHeader({ kicker, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-7 flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85 mb-1.5">
            {kicker}
          </p>
        )}
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[13.5px] text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
