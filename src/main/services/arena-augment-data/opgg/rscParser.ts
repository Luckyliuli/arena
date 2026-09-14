// Real OP.GG Arena augment extractor.
//
// As of 2026-09-13, the OP.GG zh-cn augments page is a Next.js App-
// Router SPA. The augment data ships inside an RSC payload:
//
//   self.__next_f.push([1,"59:[\"$\",\"$L5a\",null,{\"data\":{...}}]"])
//
// That is: a push chunk whose string body is `<hexChunkId>:<json>`.
// The JSON is an RSC element array; index 3 is the props object, whose
// `data` key maps tier ids ("1" | "4" | "8") to arrays of augment
// records:
//
//   { id, name, rareity, image_url, pick_rate, win_rate, play, desc }
//
// OP.GG's `id` is the same numeric id CommunityDragon uses (verified:
// 41/41 records on the Annie page agree by both id and zh name), so
// downstream joins do not need name matching.
//
// This module does not depend on the chunk id (OP.GG rotates it per
// build). It scans every push chunk, decodes it, and returns the first
// one whose payload carries an augment tier map. Pages without it
// (offline fetcher, a future SPA rewrite) yield [].

export type OpggRarity = 'silver' | 'gold' | 'prismatic'

export interface OpggAugmentRecord {
  /** Matches the CommunityDragon augment id. */
  readonly id: number
  /** Chinese display name, as printed on the OP.GG card. */
  readonly name: string
  /** Rarity, derived from OP.GG's tier bucket. */
  readonly rarity: OpggRarity
  /** Pick rate as a fraction in [0, 1] (OP.GG prints percent), or null
   *  when the field is missing. */
  readonly pickRate: number | null
  /** Win rate as a fraction in [0, 1], or null when absent. */
  readonly winRate: number | null
  /** Sample count, integer; OP.GG prints a formatted "1,920". */
  readonly playCount: number | null
  /** Description, with OP.GG's literal `?` placeholders left intact. */
  readonly description: string
  /** Absolute icon URL. */
  readonly imageUrl: string | null
}

// A push chunk looks like: self.__next_f.push([1,"<id>:<escaped>"])
// The first arg is the RSC chunk kind (0/1/...); the second is a JS
// string literal holding the chunk id and payload separated by a colon.
const RSC_PUSH_RE =
  /__next_f\.push\(\[(\d+),\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\]\)/g

const CHUNK_PREFIX_RE = /^[0-9a-f]+:/

/**
 * Scan an OP.GG augments page and return every record found.
 * Returns [] when the page carries no augment payload.
 */
export function extractOpggAugments(html: string): OpggAugmentRecord[] {
  const tierMap = findAugmentTierMap(html)
  if (!tierMap) return []
  return flattenTierMap(tierMap)
}

/**
 * Locate the `{ <tier>: [ ...records ] }` map inside the page's RSC
 * payloads. Exposed for tests and for callers that want the raw map.
 */
export function findAugmentTierMap(html: string): Record<string, unknown> | null {
  for (const parsed of extractRscJsonPayloads(html)) {
    const data = locateAugmentTierMap(parsed)
    if (data) return data
  }
  return null
}

/** Decode every JSON-bearing RSC push in the page, ignoring non-JSON chunks. */
export function extractRscJsonPayloads(html: string): unknown[] {
  const payloads: unknown[] = []
  const re = new RegExp(RSC_PUSH_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const body = unescapeStringLiteral(m[2])
    const parsed = parseChunkPayload(body)
    if (parsed !== null) payloads.push(parsed)
  }
  return payloads
}

/**
 * Decode a chunk body (`<hexId>:<json>`) and return the parsed value.
 * Returns null when the body is not a JSON array/object.
 */
function parseChunkPayload(body: string): unknown {
  const payload = body.replace(CHUNK_PREFIX_RE, '')
  const first = payload[0]
  if (first !== '[' && first !== '{') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/**
 * Recursively look for the tier map: an object whose every value is an
 * array of augment records. Returns the tier map itself (not the
 * `{ data: <tierMap> }` wrapper around it).
 */
function locateAugmentTierMap(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || node === null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const el of node) {
      const found = locateAugmentTierMap(el, depth + 1)
      if (found) return found
    }
    return null
  }
  const obj = node as Record<string, unknown>
  if (isAugmentTierMap(obj.data)) return obj.data as Record<string, unknown>
  for (const value of Object.values(obj)) {
    const found = locateAugmentTierMap(value, depth + 1)
    if (found) return found
  }
  return null
}

function isAugmentTierMap(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  for (const arr of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(arr) || arr.length === 0) continue
    const first = arr[0]
    if (first && typeof first === 'object' && 'id' in first && 'name' in first) {
      return true
    }
  }
  return false
}

function flattenTierMap(data: Record<string, unknown>): OpggAugmentRecord[] {
  const out: OpggAugmentRecord[] = []
  for (const [tierKey, tierArr] of Object.entries(data)) {
    if (!Array.isArray(tierArr)) continue
    const rarity = tierKeyToRarity(tierKey)
    for (const raw of tierArr) {
      const rec = normaliseRecord(raw, rarity)
      if (rec) out.push(rec)
    }
  }
  return out
}

/**
 * OP.GG encodes rarity as a numeric bucket on the tier key and on each
 * record's `rareity` field (OP.GG's own spelling). Observed values on
 * the zh-cn page: 1 -> silver, 4 -> gold, 8 -> prismatic. Anything else
 * falls back to silver so the record is not dropped.
 */
function tierKeyToRarity(key: string): OpggRarity {
  switch (key.trim()) {
    case '4':
      return 'gold'
    case '8':
      return 'prismatic'
    case '1':
    default:
      return 'silver'
  }
}

function normaliseRecord(raw: unknown, fallbackRarity: OpggRarity): OpggAugmentRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'number' || typeof o.name !== 'string') return null
  return {
    id: o.id,
    name: o.name,
    rarity: rarityFromNumber(o.rareity) ?? fallbackRarity,
    pickRate: percentToFraction(o.pick_rate),
    winRate: percentToFraction(o.win_rate),
    playCount: parsePlayCount(o.play),
    description: typeof o.desc === 'string' ? o.desc : '',
    imageUrl: typeof o.image_url === 'string' ? o.image_url : null,
  }
}

function rarityFromNumber(v: unknown): OpggRarity | null {
  if (typeof v !== 'number') return null
  switch (v) {
    case 4:
      return 'gold'
    case 8:
      return 'prismatic'
    case 1:
      return 'silver'
    default:
      return null
  }
}

/**
 * JS string-literal escape decoder. OP.GG emits the common escapes
 * (\", \\, \/, \n, \r, \t, \uXXXX); unknown escapes are preserved so
 * downstream JSON.parse still sees a valid sequence.
 */
function unescapeStringLiteral(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) {
      out += c
      continue
    }
    const n = s[i + 1]
    switch (n) {
      case 'n':
        out += '\n'
        i++
        break
      case 'r':
        out += '\r'
        i++
        break
      case 't':
        out += '\t'
        i++
        break
      case '"':
        out += '"'
        i++
        break
      case '\\':
        out += '\\'
        i++
        break
      case '/':
        out += '/'
        i++
        break
      case 'u': {
        const hex = s.substring(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16))
          i += 5
        } else {
          out += '\\' + n
        }
        break
      }
      default:
        out += c
        break
    }
  }
  return out
}

function percentToFraction(v: unknown): number | null {
  const n = numericValue(v)
  if (n == null) return null
  // OP.GG prints a percentage (16.38). Clip before normalising in case a
  // future build ever returns [0, 1].
  if (n > 1) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

function parsePlayCount(v: unknown): number | null {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v !== 'string') return null
  const cleaned = v.replace(/,/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

function numericValue(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
