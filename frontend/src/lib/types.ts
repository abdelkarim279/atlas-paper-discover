import type { z } from 'zod'
import type {
  pointSchema,
  documentSchema,
  searchHitSchema,
  searchResponseSchema,
} from './api'
import type { RGBAColor, CategoryKey } from './colorMaps'

export type Point = z.infer<typeof pointSchema>
export type Document = z.infer<typeof documentSchema>
export type SearchHit = z.infer<typeof searchHitSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>

export type { RGBAColor, CategoryKey }
