// Build arena/resources/champions-arena.json from Data Dragon.
//
// The OP.GG Arena URL is keyed by champion slug, not numeric id
// (e.g. /zh-cn/lol/modes/arena/Annie/augments works, /arena/1/augments
// returns HTTP 500). We need a numeric-id -> slug map, plus the zh name
// so error messages and diagnostics read naturally.
//
// Usage:  node scripts/fetch-arena-champions.mjs [--check]
//   --check   exit non-zero if the output would change (CI usage)
//
// Output: resources/champions-arena.json
//
// Offline (no auth, public CDN), idempotent: running twice yields
// byte-identical output as long as upstream is unchanged.

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'resources/champions-arena.json')

const DDRAGON_VERSIONS = 'https://ddragon.leagueoflegends.com/api/versions.json'

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

function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 2) + '\n'
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const o = {}
    for (const k of Object.keys(value).sort()) o[k] = sortKeys(value[k])
    return o
  }
  return value
}

async function main() {
  const checkOnly = process.argv.includes('--check')

  const versions = JSON.parse((await fetchBuffer(DDRAGON_VERSIONS)).toString('utf8'))
  if (!Array.isArray(versions) || versions.length === 0) {
    console.error('Data Dragon versions.json: unexpected shape')
    process.exit(1)
  }
  const patch = versions[0]

  const [enBuf, zhBuf] = await Promise.all([
    fetchBuffer('https://ddragon.leagueoflegends.com/cdn/' + patch + '/data/en_US/champion.json'),
    fetchBuffer('https://ddragon.leagueoflegends.com/cdn/' + patch + '/data/zh_CN/champion.json'),
  ])

  const en = JSON.parse(enBuf.toString('utf8'))
  const zh = JSON.parse(zhBuf.toString('utf8'))
  if (!en.data || !zh.data) {
    console.error('Data Dragon champion.json: missing `data` map')
    process.exit(1)
  }

  const warnings = []
  const records = []
  for (const slug of Object.keys(en.data)) {
    const e = en.data[slug]
    const z = zh.data[slug]
    const id = Number(e.key)
    if (!Number.isFinite(id)) {
      warnings.push('non-numeric key for slug=' + slug + ' (' + e.key + ')')
      continue
    }
    if (!z || !z.name) warnings.push('zh name missing for slug=' + slug)
    records.push({
      id,
      slug,
      nameEn: e.name || slug,
      nameZh: (z && z.name) || e.name || slug,
    })
  }
  records.sort((a, b) => a.id - b.id)

  const payload = { patch, champions: records }
  const json = stableStringify(payload)

  if (checkOnly) {
    const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
    if (prev === json) {
      console.log('check: champion map up to date (' + records.length + ' champions, patch ' + patch + ')')
      process.exit(0)
    }
    console.log('check: champion map would change')
    console.log('  champions=' + records.length + ' warnings=' + warnings.length)
    process.exit(2)
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, json, 'utf8')
  console.log('wrote', out, '(' + Buffer.byteLength(json) + 'B)')
  console.log('patch=' + patch + ' champions=' + records.length + ' warnings=' + warnings.length)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
