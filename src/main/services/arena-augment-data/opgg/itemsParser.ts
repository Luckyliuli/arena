import type { ArenaItemCategories, ArenaItemPerfStat, ArenaItemRef } from '../itemTypes.ts'

const SECTION_HEADING_RE = /<div class="px-3 py-2 text-sm font-bold[^>]*">([^<]+)<\/div>/g
const ITEM_ROW_RE = /<tr class="text-xs">([\s\S]*?)<\/tr>/g
const ITEM_IMAGE_RE = /<img alt="([^"]+)"[^>]+src="([^"]*\/item\/(\d+)\.png[^"]*)"/g

const SECTION_KEYS: Record<string, keyof ArenaItemCategories> = {
  '棱彩装备': 'prismatic',
  'prismatic items': 'prismatic',
  '棱彩裝備': 'prismatic',
  '核心装备': 'core',
  'core items': 'core',
  '核心裝備': 'core',
  '鞋子': 'boots',
  'boots': 'boots',
  '出门装': 'starting',
  'starting items': 'starting',
  '出門裝': 'starting',
  '最终装备': 'final',
  'final items': 'final',
  '最終裝備': 'final',
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseRate(value: string | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value.replace('%', '').trim())
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(1, parsed / 100))
}

function parseItems(row: string): ArenaItemRef[] {
  const items: ArenaItemRef[] = []
  const seen = new Set<number>()
  for (const match of row.matchAll(ITEM_IMAGE_RE)) {
    const itemId = Number(match[3])
    if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId)) continue
    seen.add(itemId)
    items.push({
      itemId,
      name: decodeHtml(match[1]),
      iconUrl: decodeHtml(match[2]),
    })
  }
  return items
}

function parseRow(row: string): ArenaItemPerfStat | null {
  const items = parseItems(row)
  if (items.length === 0) return null

  const averagePlacement = parseNumber(row.match(/<span class="text-gray-600">([0-9.]+)<\/span>/)?.[1])
  const firstPlaceRate = parseRate(row.match(/<span class="tabular-nums text-gray-600">([0-9.]+)%<\/span>/)?.[1])
  const pickRate = parseRate(row.match(/<span class="font-bold tabular-nums">([0-9.]+)%<\/span>/)?.[1])
  const sampleSize = parseNumber(row.match(/<span class="text-gray-500">([0-9,]+)/)?.[1])
  const winRate = parseRate(row.match(/<strong class="[^"]*">([0-9.]+)%<\/strong>/)?.[1])

  return { items, averagePlacement, firstPlaceRate, pickRate, winRate, sampleSize }
}

export function parseOpggItems(html: string): ArenaItemCategories {
  const result: ArenaItemCategories = {
    prismatic: [],
    core: [],
    boots: [],
    starting: [],
    final: [],
  }

  const marks = [...html.matchAll(SECTION_HEADING_RE)]
  for (let index = 0; index < marks.length; index += 1) {
    const heading = decodeHtml(marks[index][1]).trim().toLowerCase()
    const category = SECTION_KEYS[heading]
    if (!category) continue

    const start = marks[index].index ?? 0
    const end = marks[index + 1]?.index ?? html.length
    const section = html.slice(start, end)
    for (const match of section.matchAll(ITEM_ROW_RE)) {
      const row = parseRow(match[1])
      if (row) result[category].push(row)
    }
  }

  return result
}
