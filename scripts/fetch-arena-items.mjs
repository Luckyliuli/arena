// Build arena/resources/items-arena.json from Riot Data Dragon item data.
// This dictionary is used for OCR recognition of item-anvil choices. Item
// performance stats still come from OP.GG behind the Arena adapter.
//
// Usage: node scripts/fetch-arena-items.mjs [--check]

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const version = process.env.ARAMGG_ITEM_DATA_VERSION || '16.18.1'
const out = path.join(root, 'resources/items-arena.json')

function fetchBuffer(target) {
  return new Promise((resolve, reject) => {
    https.get(target, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error('HTTP ' + res.statusCode + ' ' + target))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

async function main() {
  const [zhBuffer, enBuffer] = await Promise.all([
    fetchBuffer('https://ddragon.leagueoflegends.com/cdn/' + version + '/data/zh_CN/item.json'),
    fetchBuffer('https://ddragon.leagueoflegends.com/cdn/' + version + '/data/en_US/item.json'),
  ])
  const zh = JSON.parse(zhBuffer.toString('utf8')).data
  const en = JSON.parse(enBuffer.toString('utf8')).data
  const rows = Object.entries(zh)
    .map(([id, item]) => ({
      id: Number(id),
      displayName: { en: en[id]?.name || item.name, zh: item.name },
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/' + version + '/img/item/' + id + '.png',
    }))
    .filter(item => Number.isInteger(item.id) && item.id > 0 && item.displayName.zh && item.displayName.en)
    .sort((a, b) => a.id - b.id)
  const text = JSON.stringify(rows, null, 2) + '\n'

  if (process.argv.includes('--check')) {
    const previous = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
    if (previous !== text) {
      console.error('check: items-arena.json would change')
      process.exit(2)
    }
    console.log('check: items-arena.json up to date (' + rows.length + ' records)')
    return
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, text, 'utf8')
  console.log('wrote ' + out + ' (' + rows.length + ' records, ' + Buffer.byteLength(text) + 'B)')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
