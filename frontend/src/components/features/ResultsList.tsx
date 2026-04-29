import { cn } from '../../lib/cn'
import type { SearchHit } from '../../lib/types'

type ResultsListProps = {
  hits: SearchHit[]
  selectedId: string | null
  onSelect: (hit: SearchHit) => void
  query: string
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--color-muted)] w-7 text-right">
        {pct}%
      </span>
    </div>
  )
}

export function ResultsList({ hits, selectedId, onSelect, query }: ResultsListProps) {
  if (hits.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-[var(--color-border)]',
        'bg-[var(--color-surface)]/90 backdrop-blur-sm',
        'overflow-hidden',
      )}
    >
      <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          Results for{' '}
          <span className="text-[var(--color-accent)] font-medium">"{query}"</span>
        </p>
      </div>

      <div className="overflow-y-auto styled-scroll max-h-[calc(100vh-280px)]">
        {hits.map((hit, i) => {
          const isSelected = hit.id === selectedId

          return (
            <button
              key={hit.id}
              onClick={() => onSelect(hit)}
              className={cn(
                'w-full text-left px-3 py-2.5 border-b border-[var(--color-border)] last:border-0',
                'transition-colors duration-100',
                isSelected ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-white/5',
              )}
            >
              <div className="flex items-start gap-2 mb-1.5">
                <span className="text-[10px] font-mono text-[var(--color-muted)] w-4 flex-shrink-0 pt-0.5">
                  {i + 1}
                </span>
                <p
                  className={cn(
                    'text-xs leading-snug line-clamp-2',
                    isSelected
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text)]/80',
                  )}
                >
                  {hit.title}
                </p>
              </div>

              <div className="pl-6 flex flex-col gap-1">
                <ScoreBar score={hit.score} />
                <span className="text-[10px] font-mono text-[var(--color-muted)]">
                  {hit.date}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
