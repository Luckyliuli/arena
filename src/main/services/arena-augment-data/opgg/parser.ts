// OP.GG Arena HTML parser.
//
// OP.GG renders arena augments client-side. The SSR HTML we can save
// today doesn't have the data; we cannot extract records from the real
// page without a headless browser. To keep the adapter seam useful now,
// the parser understands one well-known HTML pattern: a JSON data island
// shaped like:
//   <script type="application/json" id="__OPGG_ARENA_AUGMENTS__">{"augments":[...]}</script>
//
// This is the form we use in tests/fixtures/opgg/arena-leona-augments-mock.html.
// We do NOT assume OP.GG ships that exact id/wrapper today; we only assume
// a future Playwright injector (or human contributor) will produce a
// fixture in that shape, given the page has to be serialized into HTML
// for offline use anyway.
//
// If the body has no island the parser returns []. That matches the
// current real-OP.GG case and never throws.

export type OpggArenaRarity = 'silver' | 'gold' | 'prismatic'

export type OpggArenaRecord = {
  /** OP.GG-side identifier (slug, hash, or numeric — depends on API rev). */
  readonly id: string
  /** Display name in OP.GG's locale (en_US or zh_CN). */
  readonly name: string
  /** 1 = strongest in tier, larger = weaker. */
  readonly tierRank: number
  readonly rarityTier: OpggArenaRarity
  /** Proportion of arena drafts that pick this augment, 0..1. */
  readonly pickRate: number
  /** OP.GG Arena's "go top-4" rate.  Octolith adapter drops this for now
   *  since averagePlacement isn't directly observed by OP.GG; we keep
   *  rawRate so M2 can chart it later if needed. */
  readonly top4Rate: number | null
  /** Raw count of games reported by OP.GG (becomes sampleSize). */
  readonly playCount: number | null
  /** OP.GG sometimes reports an explicit winRate; kept for debug. */
  readonly winRate: number | null
}

const ISLAND_RE = /<script[^>]*id=["']__OPGG_ARENA_AUGMENTS__["'][^>]*>([\s\S]*?)<\/script>/i
const COMMENT_RE = /<!--[\s\S]*?-->/g

export function parseOpggAugmentsHtml(html: string): OpggArenaRecord[] {
  // Strip HTML comments first — they may contain literal `<script ... id="..."`
  // strings used as illustrative examples (and our test fixture does exactly
  // that). Without this the regex would lock onto the first match inside a
  // comment and return [] on an otherwise valid page.
  const stripped = html.replace(COMMENT_RE, '')
  const m = stripped.match(ISLAND_RE)
  if (!m) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(m[1])
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const arr = (parsed as { augments?: unknown[] }).augments
  if (!Array.isArray(arr)) return []
  const out: OpggArenaRecord[] = []
  for (const raw of arr) {
    const r = normaliseRecord(raw)
    if (r) out.push(r)
  }
  return out
}

function normaliseRecord(raw: unknown): OpggArenaRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string') return null
  const rarity = normaliseRarity(o.rarity)
  if (rarity === null) return null
  return {
    id: String(o.id ?? o.name),
    name: o.name,
    tierRank: finiteNumber(o.tierRank, 0) ?? 0,
    rarityTier: rarity,
    pickRate: finiteNumber(o.pickRate, 0) ?? 0,
    top4Rate: finiteNumber(o.top4Rate, null),
    playCount: finiteNumber(o.playCount, null),
    winRate: finiteNumber(o.winRate, null),
  }
}

function normaliseRarity(v: unknown): OpggArenaRarity | null {
  if (v === 'silver' || v === 'gold' || v === 'prismatic') return v
  return null
}

function finiteNumber(v: unknown, fallback: number | null): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}
