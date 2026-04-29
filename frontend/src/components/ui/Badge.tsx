import { cn } from '../../lib/cn'

type BadgeProps = {
  label: string
  color?: string
  className?: string
}

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'text-xs font-mono font-medium',
        'bg-white/5 text-[var(--color-muted)]',
        'border border-white/10',
        className,
      )}
    >
      {color && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  )
}
