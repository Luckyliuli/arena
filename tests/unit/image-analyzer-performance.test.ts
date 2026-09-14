import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('augment OCR latency pipeline', () => {
  it('performs one PaddleOCR pass per augment frame', async () => {
    const source = await readFile(new URL('../../src/main/image-analyzer.ts', import.meta.url), 'utf8')
    expect(source).toContain('const items = await performPaddleOCR(prepared)')
    expect(source).not.toContain('preparedLevels')
    expect(source).not.toContain('levelItems')
    expect(source).not.toContain('createPaddleOcrLevelRegions')
  })
})
