import { cn } from '../../lib/cn'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  KNOWN_CATEGORIES,
  rgbaToHex,
} from '../../lib/colorMaps'
import type { CategoryKey } from '../../lib/types'

type CategoryLegendProps = {
  activeCategories: Set<CategoryKey>
  onToggle: (cat: CategoryKey) => void
}

export function CategoryLegend({ activeCategories, onToggle }: CategoryLegendProps) {
  const allActive =
    activeCategories.size === 0 || activeCategories.size === KNOWN_CATEGORIES.length

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)]',
        'bg-[var(--color-surface)]/90 backdrop-blur-sm',
        'p-3',
      )}
    >
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)] mb-2 px-1">
        Categories
      </p>

      <div className="flex flex-col gap-1">
        {KNOWN_CATEGORIES.map((cat) => {
          const color = rgbaToHex(CATEGORY_COLORS[cat])
          const isActive = allActive || activeCategories.has(cat)

          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded-lg text-left',
                'transition-all duration-100 hover:bg-white/5',
                isActive ? 'opacity-100' : 'opacity-35 hover:opacity-60',
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-[var(--color-text)]">{cat}</span>
              <span className="text-[10px] text-[var(--color-muted)] ml-auto">
                {CATEGORY_LABELS[cat]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
