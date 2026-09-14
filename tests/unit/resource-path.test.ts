// Regression tests for resource lookup.
//
// The bug these pin: the dictionary loader used to derive its path from
// `import.meta.url` with a fixed number of up-elevations, which is correct in
// the source tree (`src/shared/`) but wrong once electron-vite bundles the
// module into `dist-electron/`. The app then failed at runtime with ENOENT
// while every unit test still passed, because vitest executes from the source
// tree. These tests assert the candidate list covers both layouts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  findResourceFile,
  requireResourceFile,
  resourceFileCandidates,
} from '../../src/shared/resource-path.ts'

// tests/unit/ -> project root
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DICTIONARY = path.join('resources', 'augments-arena.json')

describe('resource path resolution', () => {
  it('covers the source-tree layout (src/shared -> project root)', () => {
    const candidates = resourceFileCandidates(DICTIONARY)
    expect(candidates).toContain(path.join(PROJECT_ROOT, DICTIONARY))
  })

  it('covers the bundled layout (dist-electron -> project root)', () => {
    // The bundled module lives one level higher than its source, so the
    // candidate derived from going up a single level must also hit
    // <project>/resources/... — that is what the old code missed.
    const candidates = resourceFileCandidates(DICTIONARY)
    const bundledGuess = path.resolve(PROJECT_ROOT, 'dist-electron', '..', DICTIONARY)
    expect(candidates).toContain(bundledGuess)
    expect(bundledGuess).toBe(path.join(PROJECT_ROOT, DICTIONARY))
  })

  it('covers the cwd-relative layout', () => {
    const candidates = resourceFileCandidates(DICTIONARY)
    expect(candidates).toContain(path.join(process.cwd(), DICTIONARY))
  })

  it('never doubles the resources segment', () => {
    // The first fix attempt appended the project-root-relative path to a
    // directory that already ended in `resources`, producing
    // `.../resources/resources/augments-arena.json`.
    for (const candidate of resourceFileCandidates(DICTIONARY)) {
      expect(candidate).not.toMatch(/resources[\\/]resources/)
    }
  })

  it('resolves the real dictionary file that ships with the repo', () => {
    const found = findResourceFile(DICTIONARY)
    expect(found).not.toBeNull()
    expect(fs.existsSync(found as string)).toBe(true)
  })

  it('passes absolute paths through verbatim', () => {
    const absolute = path.join(PROJECT_ROOT, DICTIONARY)
    expect(findResourceFile(absolute)).toBe(absolute)
  })

  it('returns null for a missing file and lists candidates when required', () => {
    const missing = path.join('resources', 'definitely-not-here.json')
    expect(findResourceFile(missing)).toBeNull()
    expect(() => requireResourceFile(missing, 'demo')).toThrow(/definitely-not-here\.json/)
    // the error must name every place it looked, so a packaging miss is diagnosable
    try {
      requireResourceFile(missing, 'demo')
    } catch (error) {
      expect((error as Error).message).toContain('Looked in:')
      for (const candidate of resourceFileCandidates(missing)) {
        expect((error as Error).message).toContain(candidate)
      }
    }
  })

  it('resolves the champion map the same way', () => {
    const found = findResourceFile(path.join('resources', 'champions-arena.json'))
    expect(found).not.toBeNull()
  })

  it('resolves the Arena item dictionary the same way', () => {
    const found = findResourceFile(path.join('resources', 'items-arena.json'))
    expect(found).not.toBeNull()
    expect(fs.existsSync(found as string)).toBe(true)
  })

  it('resolves the Arena leaderboard snapshot the same way', () => {
    const found = findResourceFile(path.join('resources', 'arena-leaderboard-snapshot.json'))
    expect(found).not.toBeNull()
    expect(fs.existsSync(found as string)).toBe(true)
  })
})
