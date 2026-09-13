// Coldstart gate that proves the post-M0 OCR + dictionary pipeline can
// resolve arena screenshots to canonical augment ids. Anything in the
// spikes/ folders is fair game: ARAM fixtures and the four user-supplied
// arena screenshots (斗魂竞技场1/2/3.png, 斗魂竞技场图片3.jpg).
//
// Run from arena/:
//   node scripts/ocr-coldstart.mjs                                # default spikes
//   node scripts/ocr-coldstart.mjs --image <path>                # one image
//   node scripts/ocr-coldstart.mjs --out <path>                  # write JSON report
//   node scripts/ocr-coldstart.mjs --write-sample                # also rank top-10 by placement / firstplace / picks
//
// Output structure (also echoed to stdout):
//   {
//     summary: { images: N, cardSlots: M, exactMatches: K, fuzzyMatches: F, unmatched: U },
//     perImage: [{ file, cardSlots: [{ index, transcript, matched: { id, name, distance, confidence } }] }]
//     sample?: { source, mock, topBy: { placement, firstplace, picks } }
//   }
//
// Decision criterion (issues/04):
//   - aggregate >= 8/9 canonical matches observed during the original spike
//   - the 1-char-off '裁' vs '戮' recovery becomes a canonical match
//   - decision written to docs/m1-readiness.md (this script does not write that file)

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { spawnSync } from 'node:child_process'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const arenaRoot = path.resolve(here, '..')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
function hasFlag(flag) {
  return process.argv.includes(flag)
}

const MODEL_DIR = process.env.ARAMGG_PADDLEOCR_MODEL_DIR
  || path.join(arenaRoot, 'resources/paddleocr')

const DEFAULT_INPUTS = [
  path.join(arenaRoot, 'tests/fixtures/augment-ocr/full-three-cards.png'),
  // User-supplied arena screenshots live at the project root (../).
  path.resolve(arenaRoot, '..', '斗魂竞技场1.png'),
  path.resolve(arenaRoot, '..', '斗魂竞技场2.png'),
  path.resolve(arenaRoot, '..', '斗魂竞技场3.png'),
  path.resolve(arenaRoot, '..', '斗魂竞技场图片3.jpg'),
]

function resolveInputs() {
  const oneImage = arg('--image', null)
  if (oneImage) return [path.resolve(oneImage)]
  return DEFAULT_INPUTS.filter(p => fs.existsSync(p))
}

function ocrProbe(imagePath) {
  const probePath = path.resolve(arenaRoot, '..', 'spike-env', 'ocr-probe.mjs')
  if (!fs.existsSync(probePath)) {
    throw new Error('OCR probe script not found at ' + probePath + ' — make sure spike-env is checked out')
  }
  const out = { ...process.env, ARAMGG_PADDLEOCR_MODEL_DIR: MODEL_DIR }
  const tmpJson = process.env.COLDSTART_KEEP_TMP ? path.join(arenaRoot, '.workbuddy-coldstart-tmp.json') : path.join(arenaRoot, '.workbuddy-coldstart-tmp.json')
  const r = spawnSync(process.execPath, [probePath, imagePath, '--out', tmpJson], {
    cwd: path.dirname(probePath),
    encoding: 'utf8',
    env: out,
    shell: false,
  })
  if (r.status !== 0 || !fs.existsSync(tmpJson)) {
    throw new Error('ocr-probe failed for ' + imagePath + ': ' + (r.stderr || r.stdout || '').slice(0, 400))
  }
  const obj = JSON.parse(fs.readFileSync(tmpJson, 'utf8'))
  fs.rmSync(tmpJson, { force: true })
  return obj
}

import {
  loadAugmentArenaDictionary,
  findAugmentByName,
} from '../src/shared/augment-dictionary.ts'

import {
  selectAugmentSource,
  rankAugmentStats,
  describeAugment,
} from '../src/main/services/arena-augment-data/index.ts'

function normalizeOcrTitleText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s"'“”‘’`.,，。:：;；!！?？、|｜/\\()[\]{}<>《》【】「」『』\-_=+~·•]/g, '')
}

// A loose card-zone heuristic: text box in the screen's middle vertical
// band, width between 40 and 220 px. Cards on a 1920x1080 arena
// screenshot sit between y ~= 300..540 and span roughly x = 540..1410
// with three adjacent columns. We deliberately take *every* text box
// above some size that the OCR surfaced; the dictionary lookup is
// tolerant of false positives.
function looksLikeCardTitle(box, size) {
  if (!box) return false
  const w = box.width || 0
  const h = box.height || 0
  if (w < 32 || h < 14) return false
  if (w > 360) return false
  const inArenaBand = box.y >= 240 && box.y <= 310
  const inAramBand = box.y >= 380 && box.y <= 480
  return inArenaBand || inAramBand
}

function pickCardSlots(ocr) {
  return (ocr.texts || [])
    .filter(t => looksLikeCardTitle(t.box))
    .map((t, idx) => ({
      index: idx,
      transcript: normalizeOcrTitleText(t.text),
      confidence: t.confidence,
      box: t.box,
    }))
    .filter(s => s.transcript.length > 0)
}

function resolveSlots(slots, dictionary) {
  const slim = dictionary.map(r => ({
    id: r.id,
    name: r.displayName.zh,
    rarity: r.rarity,
    iconPath: r.iconLarge || undefined,
    _en: r.displayName.en,
  }))
  function dist(a, b) {
    const m = a.length, n = b.length
    const rows = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        rows[i][j] = a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : 1 + Math.min(rows[i - 1][j], rows[i][j - 1], rows[i - 1][j - 1])
      }
    }
    return rows[m][n]
  }
  function findMatch(transcript, maxDist) {
    const buckets = ['zh', 'en']
    let best = null
    for (const locale of buckets) {
      for (const r of slim) {
        const name = locale === 'zh' ? r.name : r._en
        if (!name) continue
        const d = dist(transcript, name)
        if (d <= maxDist && (!best || d < best.distance)) {
          best = { id: r.id, name, locale, distance: d }
        }
      }
    }
    return best
  }

  return slots.map(slot => {
    if (slot.transcript.length < 2) return { ...slot, matched: null }
    const maxDist = slot.transcript.length === 3 ? 1 : Math.floor(slot.transcript.length / 3)
    const m = findMatch(slot.transcript, Math.max(1, maxDist))
    if (!m) return { ...slot, matched: null }
    return { ...slot, matched: { id: m.id, name: m.name, distance: m.distance, confidence: slot.confidence } }
  })
}

function buildSample(source, topN = 10) {
  return {
    source: source.id,
    mock: true,
    note: 'placeholder stats from the M1 adapter (deterministic mock). Real numbers from a future source swap in identical shape -- see docs/adr/0004.',
    topBy: {
      placement: rankAugmentStats(source, 'placement').slice(0, topN).map(s => decorate(s)),
      firstplace: rankAugmentStats(source, 'firstplace').slice(0, topN).map(s => decorate(s)),
      picks: rankAugmentStats(source, 'picks').slice(0, topN).map(s => decorate(s)),
    },
  }
  function decorate(stat) {
    const meta = describeAugment(stat.augmentId)
    return {
      augmentId: stat.augmentId,
      name: meta ? meta.displayName.zh || meta.displayName.en : null,
      rarity: meta ? meta.rarity : null,
      averagePlacement: stat.averagePlacement,
      firstPlaceRate: stat.firstPlaceRate,
      pickRate: stat.pickRate,
      sampleSize: stat.sampleSize,
    }
  }
}

async function main() {
  const inputs = resolveInputs()
  if (!inputs.length) {
    console.error('no inputs found — supply --image <path>')
    process.exit(2)
  }
  const dictionary = loadAugmentArenaDictionary()
  if (!dictionary.length) {
    console.error('arena augment dictionary is empty — run scripts/fetch-arena-augments.mjs')
    process.exit(2)
  }

  const perImage = []
  for (const file of inputs) {
    const ocr = ocrProbe(file)
    const slots = pickCardSlots(ocr)
    const resolved = resolveSlots(slots, dictionary)
    perImage.push({ file: path.relative(arenaRoot, file), size: ocr.imageSize, cardSlots: resolved })
  }

  const allSlots = perImage.flatMap(p => p.cardSlots)
  const totalCards = allSlots.length
  let exact = 0
  let fuzzy = 0
  let unmatched = 0
  for (const s of allSlots) {
    if (!s.matched) unmatched++
    else if (s.matched.distance === 0) exact++
    else fuzzy++
  }

  const report = {
    summary: {
      images: perImage.length,
      cardSlots: totalCards,
      exactMatches: exact,
      fuzzyMatches: fuzzy,
      unmatched,
    },
    perImage,
  }

  // Optional T06 sample: rank by placement / firstplace / picks using the
  // M1 adapter seam. Writes a file under arena/.scratch/m0-tail/ so it
  // doesn't pollute version control or the data dir.
  if (hasFlag('--write-sample')) {
    const src = selectAugmentSource()
    const bundle = await src.getStatsForChampion(0)
    report.sample = buildSample(bundle.records, 10)
  }

  console.log('coldstart images=' + perImage.length + ' cardSlots=' + totalCards
    + ' exact=' + exact + ' fuzzy=' + fuzzy + ' unmatched=' + unmatched)
  for (const p of perImage) {
    console.log('--- ' + p.file)
    for (const s of p.cardSlots) {
      const m = s.matched
      const mdesc = m ? ('-> id=' + m.id + ' ' + m.name + ' (d=' + m.distance + ' conf=' + (s.confidence || 0).toFixed(3) + ')') : '-> UNMATCHED'
      console.log('  slot ' + s.index + ': "' + s.transcript + '" ' + mdesc)
    }
  }

  if (report.sample) {
    console.log('--- sample top-10 (mock data via M1 adapter)')
    for (const [order, rows] of Object.entries(report.sample.topBy)) {
      console.log('  by ' + order + ':')
      for (const r of rows) {
        console.log('    id=' + r.augmentId + ' ' + (r.name || '<unknown>')
          + ' placement=' + r.averagePlacement
          + ' firstplace=' + (r.firstPlaceRate ?? 0).toFixed(3)
          + ' picks=' + (r.pickRate ?? 0).toFixed(3)
          + ' sampleSize=' + r.sampleSize)
      }
    }
  }

  const outFile = arg('--out', null)
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8')
    console.log('wrote ' + outFile)
  }
}

main()
