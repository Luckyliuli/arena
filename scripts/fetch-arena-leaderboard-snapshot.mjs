// Build arena/resources/arena-leaderboard-snapshot.json from OP.GG's
// public Arena pages. The resource is the immediate-render fallback; the
// desktop app refreshes a mutable copy in the background once per day.
//
// Usage: node scripts/fetch-arena-leaderboard-snapshot.mjs [--check]

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { fetchLiveArenaLeaderboardSnapshot } from '../src/main/services/arena-augment-data/opgg/leaderboardBuilder.ts'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'resources/arena-leaderboard-snapshot.json')

const result = await fetchLiveArenaLeaderboardSnapshot({
  concurrency: Number(process.env.ARAMGG_LEADERBOARD_CONCURRENCY || 6),
})
const text = JSON.stringify(result.snapshot, null, 2) + '\n'

if (process.argv.includes('--check')) {
  const previous = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
  if (previous !== text) {
    console.error('check: arena-leaderboard-snapshot.json would change')
    process.exit(2)
  }
  console.log('check: arena leaderboard snapshot up to date')
  process.exit(0)
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, text, 'utf8')
const championCount = result.snapshot.champions.length
const trioCount = result.snapshot.combinations.trio.length
const duoCount = result.snapshot.combinations.duo.length
console.log(`wrote ${out} (${championCount} champions, ${trioCount} trios, ${duoCount} duos, ${Buffer.byteLength(text)}B)`)
for (const warning of result.warnings) console.warn('warning:', warning)
