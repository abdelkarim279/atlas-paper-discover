import { useQuery } from '@tanstack/react-query'
import { postSearch } from '../lib/api'
import type { SearchResponse } from '../lib/types'

export function useSearch(query: string, k = 10) {
  return useQuery<SearchResponse>({
    queryKey: ['search', query, k],
    queryFn: () => postSearch(query, k),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  })
}
