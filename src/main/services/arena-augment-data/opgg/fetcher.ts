// OP.GG Arena HTML fetcher implementations.
//
// Two flavours:
//
//  - offlineOpggHtmlFetcher(rootDir): async (championKey: string) =>
//      reads `tests/fixtures/<rootDir>/arena-${lc}-augments.html`. Used by
//      tests and by anyone running the source against a captured page.
//
//  - onlineOpggHtmlFetcher(opts?): async (championKey: string) =>
//      issues HTTPS to https://op.gg/zh-cn/lol/modes/arena/<Champion>/augments
//      with a normal UA. This is a *placeholder*; CloudFront anti-bot
//      currently blocks the SSR HTML for any client that isn't a real
//      browser, so this fetcher returns the SSR skeleton (no records).
//      Replace with Playwright when ready; the rest of the seam doesn't
//      change. ADR-0005 describes the path.

import { promises as fs } from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'

export type ArenaAugmentHtmlFetcher = (championKey: string) => Promise<string>

export interface OnlineOpggFetcherOptions {
  signal?: AbortSignal
  locale?: string
  userAgent?: string
}

export function offlineOpggHtmlFetcher(rootDir: string): ArenaAugmentHtmlFetcher {
  return async (championKey: string) => {
    const fp = path.join(rootDir, `arena-${championKey.toLowerCase()}-augments.html`)
    return fs.readFile(fp, 'utf8')
  }
}

export function onlineOpggHtmlFetcher(opts: OnlineOpggFetcherOptions = {}): ArenaAugmentHtmlFetcher {
  const locale = opts.locale ?? 'zh-cn'
  const userAgent = opts.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
  return async (championKey: string) => {
    const url = `https://op.gg/${locale}/lol/modes/arena/${capitalise(championKey)}/augments`
    return new Promise<string>((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': userAgent }, signal: opts.signal }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      req.on('error', reject)
    })
  }
}

function capitalise(k: string): string {
  if (!k) return k
  return k[0].toUpperCase() + k.slice(1).toLowerCase()
}
