import { z } from 'zod'

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const pointSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  title: z.string(),
  date: z.string(),
  categories: z.array(z.string()),
})

export const documentSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  title: z.string(),
  abstract: z.string(),
  categories: z.array(z.string()),
  date: z.string(),
  url: z.string().url(),
})

export const searchHitSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  title: z.string(),
  date: z.string(),
  score: z.number(),
})

export const searchResponseSchema = z.object({
  results: z.array(searchHitSchema),
  query: z.string(),
  latency_ms: z.number().int(),
})

// ── Base URL ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? ''

// ── Fetch Wrapper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }

  const json: unknown = await res.json()
  return schema.parse(json)
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchPoints() {
  return apiFetch('/api/points', z.array(pointSchema))
}

export async function fetchDocument(arxivId: string) {
  return apiFetch(`/api/document/${encodeURIComponent(arxivId)}`, documentSchema)
}

export async function postSearch(query: string, k = 10) {
  return apiFetch('/api/search', searchResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ query, k }),
  })
}
