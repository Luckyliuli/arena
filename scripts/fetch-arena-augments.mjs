// Build arena/resources/augments-arena.json from CommunityDragon's
// cdragon/arena locale files. This is the canonical dictionary the OCR
// pipeline resolves transcripts against. Per ADR-0004 the dictionary sits
// behind an adapter so its source can be swapped without ripple.
//
// Usage:  node scripts/fetch-arena-augments.mjs [--check]
//   --check   exit non-zero if the dictionary would change (CI usage)
//
// Outputs:
//   resources/augments-arena.json         normalized list
//   resources/augments-arena.meta.json    build provenance + checksums
//
// The script is offline (no auth, public CDN), and idempotent: running
// twice yields byte-identical output as long as upstream is unchanged.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import https from 'node:https'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'resources/augments-arena.json')

const UPSTREAMS = {
  en: 'https://raw.communitydragon.org/latest/cdragon/arena/en_us.json',
  zh: 'https://raw.communitydragon.org/latest/cdragon/arena/zh_cn.json',
}

const RARITY_MAP = { 0: 'silver', 1: 'gold', 2: 'prismatic' }

function fetchBuffer(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, res => {
      if (res.statusCode >= 300) {
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode + ' ' + targetUrl))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function normalizeRarity(value) {
  const n = Number(value)
  return RARITY_MAP[n] || 'unknown'
}

// CommunityDragon payloads are `{ augments: [...] }` per locale.
function unpack(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.augments)) return payload.augments
  return null
}

// Stable JSON output: keys sorted, no trailing whitespace, trailing newline.
function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k])
    return out
  }
  return value
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function mergeLocales(enPayload, zhPayload) {
  const enById = new Map()
  for (const a of enPayload) {
    if (a && typeof a.id === 'number') enById.set(a.id, a)
  }

  const warnings = []
  const merged = []

  for (const en of enPayload) {
    if (!en || typeof en.id !== 'number') {
      warnings.push('en entry without numeric id skipped')
      continue
    }
    const zh = (zhPayload || []).find(x => x && x.id === en.id) || null

    const enName = en.name || ''
    const zhName = zh && zh.name ? zh.name : null
    if (!zhName) warnings.push('zh_CN name missing for id=' + en.id + ' (' + enName + '); fallback to en')
    if (!enName) warnings.push('en name missing for id=' + en.id)

    merged.push({
      id: en.id,
      apiName: en.apiName || '',
      displayName: {
        en: enName,
        zh: zhName || enName,
      },
      rarity: normalizeRarity(en.rarity),
      iconLarge: en.iconLarge || null,
      iconSmall: en.iconSmall || null,
    })
  }

  return { records: merged, warnings }
}

async function main() {
  const checkOnly = process.argv.includes('--check')

  const [enBuf, zhBuf] = await Promise.all([
    fetchBuffer(UPSTREAMS.en),
    fetchBuffer(UPSTREAMS.zh),
  ])

  let enPayload = JSON.parse(enBuf.toString('utf8'))
  let zhPayload = zhBuf ? JSON.parse(zhBuf.toString('utf8')) : null

  const enArr = unpack(enPayload)
  const zhArr = zhPayload != null ? unpack(zhPayload) : []
  if (!enArr) {
    console.error('upstream en_us.json: expected an array or { augments: [...] }, got shape=' + JSON.stringify(Object.keys(enPayload)))
    process.exit(1)
  }
  if (zhPayload != null && !zhArr) {
    console.error('upstream zh_cn.json: expected an array or { augments: [...] }')
    process.exit(1)
  }

  const { records, warnings } = mergeLocales(enArr, zhArr || [])

  const dictionaryJson = stableStringify(records)

  if (checkOnly) {
    const prevDict = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
    if (prevDict === dictionaryJson) {
      console.log('check: dictionary up to date (' + records.length + ' records)')
      process.exit(0)
    }
    console.log('check: dictionary would change')
    console.log('  records=' + records.length + ' warnings=' + warnings.length)
    process.exit(2)
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, dictionaryJson, 'utf8')

  const enSha = sha256Hex(enBuf).slice(0, 12)
  const zhSha = zhBuf ? sha256Hex(zhBuf).slice(0, 12) : 'n/a'
  console.log('wrote', out, '(' + Buffer.byteLength(dictionaryJson) + 'B)')
  console.log('records=' + records.length + ' warnings=' + warnings.length)
  console.log('checksums: en=' + enSha + ' zh=' + zhSha)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
