import { X, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge } from '../ui/Badge'
import { CATEGORY_COLORS, rgbaToHex } from '../../lib/colorMaps'
import type { Document, CategoryKey } from '../../lib/types'

type DetailPanelProps = {
  document: Document | undefined
  isLoading: boolean
  onClose: () => void
}

export function DetailPanel({ document, isLoading, onClose }: DetailPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'rounded-xl border border-[var(--color-border)]',
        'bg-[var(--color-surface)]/95 backdrop-blur-sm',
        'animate-slide-in-right overflow-hidden',
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
          Paper Detail
        </span>
        <button
          onClick={onClose}
          className={cn(
            'p-1 rounded-lg text-[var(--color-muted)]',
            'hover:text-[var(--color-text)] hover:bg-white/10',
            'transition-colors',
          )}
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
            <span className="text-xs text-[var(--color-muted)]">Loading paper…</span>
          </div>
        </div>
      )}

      {!isLoading && document && (
        <div className="flex-1 overflow-y-auto styled-scroll px-4 py-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold leading-relaxed text-[var(--color-text)]">
            {document.title}
          </h2>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono text-[var(--color-muted)]">
              {document.date}
            </span>
            <span className="text-[var(--color-border)]">·</span>
            <span className="text-xs font-mono text-[var(--color-muted)]">
              {document.id}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {document.categories.map((cat) => {
              const color = CATEGORY_COLORS[cat as CategoryKey]
              return (
                <Badge
                  key={cat}
                  label={cat}
                  color={color ? rgbaToHex(color) : undefined}
                />
              )
            })}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2">
              Abstract
            </p>
            <p className="text-xs leading-relaxed text-[var(--color-text)]/80">
              {document.abstract}
            </p>
          </div>

          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-auto flex items-center justify-center gap-2',
              'px-4 py-2.5 rounded-lg',
              'text-xs font-medium text-white',
              'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90',
              'transition-colors duration-150',
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open on arXiv
          </a>
        </div>
      )}
    </div>
  )
}
