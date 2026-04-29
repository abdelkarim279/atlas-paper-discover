import { useState, useCallback, useMemo, useEffect } from 'react'
import { AtlasMap } from './components/features/AtlasMap'
import { DetailPanel } from './components/features/DetailPanel'
import { ResultsList } from './components/features/ResultsList'
import { CategoryLegend } from './components/features/CategoryLegend'
import { SearchBar } from './components/ui/SearchBar'
import { useAtlas } from './hooks/useAtlas'
import { useDocument } from './hooks/useDocument'
import { useSearch } from './hooks/useSearch'
import { cn } from './lib/cn'
import type { Point, SearchHit, CategoryKey } from './lib/types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

type TooltipState = {
  point: Point | null
  x: number
  y: number
}

export default function App() {
  const { data: points = [], isLoading: isLoadingPoints } = useAtlas()

  const [rawQuery, setRawQuery] = useState('')
  const query = useDebounce(rawQuery, 300)
  const { data: searchData, isFetching: isSearching } = useSearch(query)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: document, isLoading: isLoadingDoc } = useDocument(selectedId)

  const [activeCategories, setActiveCategories] = useState<Set<CategoryKey>>(new Set())

  // focusTarget triggers the Three.js fly-to animation
  const [focusTarget, setFocusTarget] = useState<{ x: number; y: number } | null>(null)

  const [tooltip, setTooltip] = useState<TooltipState>({ point: null, x: 0, y: 0 })

  const handlePointClick = useCallback((point: Point) => {
    setSelectedId(point.id)
    setFocusTarget({ x: point.x, y: point.y })
  }, [])

  const handleResultSelect = useCallback((hit: SearchHit) => {
    setSelectedId(hit.id)
    setFocusTarget({ x: hit.x, y: hit.y })
  }, [])

  const handleCategoryToggle = useCallback((cat: CategoryKey) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const handleCloseDetail = useCallback(() => setSelectedId(null), [])

  const handleHover = useCallback((point: Point | null) => {
    setTooltip((prev) => ({
      point,
      // keep previous x/y if point is null so tooltip doesn't jump on exit
      x: prev.x,
      y: prev.y,
    }))
  }, [])

  // Tooltip position tracks raw mouse position on the canvas wrapper
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }))
  }, [])

  const handleQueryChange = useCallback((v: string) => {
    setRawQuery(v)
    if (!v.trim()) setSelectedId(null)
  }, [])

  const searchHits = useMemo(() => searchData?.results ?? [], [searchData])
  const detailOpen = selectedId !== null

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--color-bg)]">
      {/* Full-bleed Three.js canvas */}
      <div className="absolute inset-0" onMouseMove={handleMouseMove}>
        {!isLoadingPoints && (
          <AtlasMap
            points={points}
            searchHits={searchHits}
            selectedId={selectedId}
            focusTarget={focusTarget}
            activeCategories={activeCategories}
            onHover={handleHover}
            onPointClick={handlePointClick}
          />
        )}
      </div>

      {/* Loading overlay */}
      {isLoadingPoints && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--color-muted)]">Loading atlas…</p>
        </div>
      )}

      {/* Search bar — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full px-4 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-xl">
          <SearchBar
            value={rawQuery}
            onChange={handleQueryChange}
            isLoading={isSearching}
            latencyMs={searchData?.latency_ms}
            resultCount={searchHits.length}
          />
        </div>
      </div>

      {/* Results list — left sidebar */}
      {searchHits.length > 0 && (
        <div className={cn('absolute top-20 left-4 w-72 z-10 animate-fade-in pointer-events-auto')}>
          <ResultsList
            hits={searchHits}
            selectedId={selectedId}
            onSelect={handleResultSelect}
            query={searchData?.query ?? ''}
          />
        </div>
      )}

      {/* Category legend — bottom left */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
        <CategoryLegend
          activeCategories={activeCategories}
          onToggle={handleCategoryToggle}
        />
      </div>

      {/* Detail panel — right drawer */}
      {detailOpen && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-10 pointer-events-auto">
          <DetailPanel
            document={document}
            isLoading={isLoadingDoc}
            onClose={handleCloseDetail}
          />
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip.point && tooltip.point.id !== selectedId && (
        <div
          className={cn(
            'absolute z-20 pointer-events-none',
            'px-2.5 py-1.5 rounded-lg',
            'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
            'shadow-lg',
          )}
          style={{ left: tooltip.x + 14, top: tooltip.y - 8, maxWidth: 260 }}
        >
          <p className="text-xs text-[var(--color-text)] leading-snug line-clamp-2">
            {tooltip.point.title}
          </p>
          <p className="text-[10px] font-mono text-[var(--color-muted)] mt-0.5">
            {tooltip.point.categories[0]} · {tooltip.point.date}
          </p>
        </div>
      )}
    </div>
  )
}
