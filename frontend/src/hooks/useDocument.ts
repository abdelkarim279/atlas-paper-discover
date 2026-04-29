import { useQuery } from '@tanstack/react-query'
import { fetchDocument } from '../lib/api'
import type { Document } from '../lib/types'

export function useDocument(arxivId: string | null) {
  return useQuery<Document>({
    queryKey: ['document', arxivId],
    queryFn: () => fetchDocument(arxivId!),
    enabled: arxivId !== null,
    staleTime: 1000 * 60 * 30,
  })
}
