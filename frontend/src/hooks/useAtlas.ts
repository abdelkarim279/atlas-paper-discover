import { useQuery } from '@tanstack/react-query'
import { fetchPoints } from '../lib/api'
import type { Point } from '../lib/types'

export function useAtlas() {
  return useQuery<Point[]>({
    queryKey: ['atlas-points'],
    queryFn: fetchPoints,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  })
}
