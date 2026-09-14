// OP.GG Arena HTML fetcher implementations.
//
// Two flavours:
//
//  - offlineOpggHtmlFetcher(rootDir): async (slug) => reads a captured
//      page from `<rootDir>/arena-<slug>-augments.html`. Used by tests
//      and by anyone replaying a saved page. Case-insensitive on the
//      slug so `Annie` and `annie` resolve to the same file.
//
//  - onlineOpggHtmlFetcher(opts?): async (slug) => HTTPS GET against
//      https://op.gg/<locale>/lol/modes/arena/<slug>/augments.
//
// The slug must be passed exactly as OP.GG spells it (`MissFortune`,
// `XinZhao`, `DrMundo`); use shared/champion-map.ts to map a numeric
// champion id to the right slug. Do NOT re-case the slug here — OP.GG
// is case-sensitive and a wrong casing 404s.
//
// The online fetcher relies on the page's RSC payload being present in
// the initial HTML (verified 2026-09-13: the zh-cn augments page ships
// ~590KB of SSR HTML including the augment data chunk). If OP.GG ever
// moves the data behind client-side hydration this fetcher will start
// returning pages with no records; the parser degrades to [] rather
// than throwing, and the caller surfaces "no data".

import { promises as fs } from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'

export type ArenaAugmentHtmlFetcher = (championSlug: string) => Promise<string>

export interface OnlineOpggFetcherOptions {
  signal?: AbortSignal
  locale?: string
  userAgent?: string
  /** Per-request timeout in ms. Default 20000. */
  timeoutMs?: number
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

export function offlineOpggHtmlFetcher(rootDir: string): ArenaAugmentHtmlFetcher {
  return async (championSlug: string) => {
    const lowered = championSlug.toLowerCase()
    const candidates = [
      `arena-${championSlug}-augments.html`,
      `arena-${lowered}-augments.html`,
    ]
    let lastErr: unknown = null
    for (const name of candidates) {
      try {
        return await fs.readFile(path.join(rootDir, name), 'utf8')
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('offline fixture not found: ' + championSlug)
  }
}

export function onlineOpggHtmlFetcher(opts: OnlineOpggFetcherOptions = {}): ArenaAugmentHtmlFetcher {
  const locale = opts.locale ?? 'zh-cn'
  const userAgent = opts.userAgent ?? DEFAULT_UA
  const timeoutMs = opts.timeoutMs ?? 20000
  return async (championSlug: string) => {
    const url = `https://op.gg/${locale}/lol/modes/arena/${championSlug}/augments`
    return new Promise<string>((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': userAgent,
            'Accept-Language': 'zh-CN,zh;q=0.9',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Encoding': 'identity',
          },
          signal: opts.signal,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error('OP.GG HTTP ' + res.statusCode + ' for ' + url))
            return
          }
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        }
      )
      req.on('error', reject)
      req.setTimeout(timeoutMs, () => req.destroy(new Error('OP.GG request timed out after ' + timeoutMs + 'ms')))
    })
  }
}


export function offlineOpggItemsHtmlFetcher(rootDir: string): ArenaAugmentHtmlFetcher {
  return offlineOpggHtmlFetcher(rootDir)
}

export function onlineOpggItemsHtmlFetcher(opts: OnlineOpggFetcherOptions = {}): ArenaAugmentHtmlFetcher {
  const locale = opts.locale ?? 'zh-cn'
  const userAgent = opts.userAgent ?? DEFAULT_UA
  const timeoutMs = opts.timeoutMs ?? 20000
  return async (championSlug: string) => {
    const url = `https://op.gg/${locale}/lol/modes/arena/${championSlug}/items`
    return new Promise<string>((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': userAgent,
            'Accept-Language': 'zh-CN,zh;q=0.9',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Encoding': 'identity',
          },
          signal: opts.signal,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error('OP.GG HTTP ' + res.statusCode + ' for ' + url))
            return
          }
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        }
      )
      req.on('error', reject)
      req.setTimeout(timeoutMs, () => req.destroy(new Error('OP.GG request timed out after ' + timeoutMs + 'ms')))
    })
  }
}
