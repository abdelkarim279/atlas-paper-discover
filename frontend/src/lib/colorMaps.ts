export type RGBAColor = [number, number, number, number]

export type CategoryKey =
  | 'cs.LG'
  | 'cs.AI'
  | 'cs.CL'
  | 'cs.CV'
  | 'cs.RO'
  | 'cs.NE'
  | 'cs.IR'
  | 'other'

export const CATEGORY_COLORS: Record<CategoryKey, RGBAColor> = {
  'cs.LG': [124, 58, 237, 255],
  'cs.AI': [59, 130, 246, 255],
  'cs.CL': [16, 185, 129, 255],
  'cs.CV': [245, 158, 11, 255],
  'cs.RO': [239, 68, 68, 255],
  'cs.NE': [236, 72, 153, 255],
  'cs.IR': [6, 182, 212, 255],
  'other': [71, 85, 105, 255],
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  'cs.LG': 'Machine Learning',
  'cs.AI': 'Artificial Intelligence',
  'cs.CL': 'Computation & Language',
  'cs.CV': 'Computer Vision',
  'cs.RO': 'Robotics',
  'cs.NE': 'Neural & Evolutionary',
  'cs.IR': 'Information Retrieval',
  'other': 'Other',
}

export const KNOWN_CATEGORIES = Object.keys(CATEGORY_COLORS) as CategoryKey[]

export const COLOR_SELECTED: RGBAColor = [251, 191, 36, 255]
export const COLOR_SEARCH_HIT: RGBAColor = [124, 58, 237, 255]

export function getCategoryColor(categories: string[]): RGBAColor {
  const first = categories[0] as CategoryKey
  return CATEGORY_COLORS[first] ?? CATEGORY_COLORS['other']
}

export function dimColor(color: RGBAColor, alpha = 60): RGBAColor {
  return [color[0], color[1], color[2], alpha]
}

export function rgbaToHex([r, g, b]: RGBAColor): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
