import { cn } from '@/lib/utils';

type Estado =
  | 'borrador'
  | 'firmado'
  | 'cancelado'
  | 'activa'
  | 'pausada'
  | 'cerrada'
  | 'finalizada'
  | 'archivada'
  | string;

/**
 * Pill-shaped status badge with a colored dot indicator.
 * Variants are mapped from the `estado` string semantically; unknown values
 * fall back to a neutral slate look.
 */
export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  const v = variant(estado);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-none',
        v.bg,
        v.border,
        v.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', v.dot)} aria-hidden />
      <span className="capitalize">{estado}</span>
    </span>
  );
}

function variant(estado: string) {
  switch (estado) {
    case 'borrador':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        dot: 'bg-amber-500',
      };
    case 'firmado':
    case 'activa':
    case 'finalizada':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        dot: 'bg-emerald-500',
      };
    case 'cancelado':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        dot: 'bg-rose-500',
      };
    case 'pausada':
      return {
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        text: 'text-sky-800',
        dot: 'bg-sky-500',
      };
    case 'archivada':
    case 'cerrada':
      return {
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        text: 'text-slate-700',
        dot: 'bg-slate-400',
      };
    default:
      return {
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        text: 'text-slate-700',
        dot: 'bg-slate-400',
      };
  }
}
