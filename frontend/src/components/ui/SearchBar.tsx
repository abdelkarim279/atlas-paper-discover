import { Search, Loader2, X } from 'lucide-react'
import { cn } from '../../lib/cn'

type SearchBarProps = {
  value: string
  onChange: (v: string) => void
  isLoading?: boolean
  latencyMs?: number
  resultCount?: number
}

export function SearchBar({
  value,
  onChange,
  isLoading = false,
  latencyMs,
  resultCount,
}: SearchBarProps) {
  return (
    <div className="relative w-full max-w-xl">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'focus-within:border-[var(--color-accent)]',
          'focus-within:shadow-[0_0_0_3px_var(--color-accent-dim)]',
          'transition-all duration-150',
        )}
      >
        <Search
          className="w-4 h-4 flex-shrink-0 text-[var(--color-muted)]"
          strokeWidth={2}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search papers by concept, method, or keyword…"
          className={cn(
            'flex-1 bg-transparent outline-none',
            'text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]',
            'font-sans',
          )}
          spellCheck={false}
          autoComplete="off"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
          )}
          {!isLoading && latencyMs !== undefined && (
            <span className="text-xs font-mono text-[var(--color-muted)]">
              {latencyMs}ms
            </span>
          )}
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {resultCount !== undefined && resultCount > 0 && (
        <div className="absolute -bottom-7 left-0 text-xs text-[var(--color-muted)]">
          <span className="text-[var(--color-accent)] font-medium">{resultCount}</span>{' '}
          results
        </div>
      )}
    </div>
  )
}
