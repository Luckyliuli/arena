import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { messages } from '../../src/renderer/i18n/messages.ts'

const repoFile = (relative: string) => new URL(`../../${relative}`, import.meta.url)

describe('Arena project contract', () => {
  it('keeps the current product entry and package metadata Arena-only', async () => {
    const [readme, packageJson] = await Promise.all([
      readFile(repoFile('README.md'), 'utf8'),
      readFile(repoFile('package.json'), 'utf8').then(JSON.parse),
    ])

    expect(readme.split('## 文档入口')[0]).toContain('斗魂竞技场')
    expect(readme.split('## 文档入口')[0]).not.toMatch(/极地大乱斗|\bARAM\b/)
    expect(packageJson.description).toContain('League of Legends Arena')
    expect(packageJson.description).not.toContain('ARAM')
  })

  it('keeps domain decisions inside the repository', async () => {
    const [context, adrIndex] = await Promise.all([
      readFile(repoFile('CONTEXT.md'), 'utf8'),
      readFile(repoFile('docs/adr/README.md'), 'utf8'),
    ])

    expect(context).toContain('本项目唯一面向的游戏模式')
    expect(context).toContain('**推荐度（Recommendation Score）**')
    expect(adrIndex.match(/ADR-\d{4}/g)).toHaveLength(5)
  })

  it('does not expose the retired right recommendation panel', async () => {
    const files = await Promise.all([
      'src/renderer/main.js',
      'src/renderer/components/OverlayPreferences.vue',
      'src/preload/preload.ts',
      'src/shared/ipc-contract.ts',
      'src/main/modules/window-manager.ts',
      'src/main/modules/ipc-handlers.ts',
      'src/main/modules/user-preferences.ts',
      'src/main/diagnostics/release-smoke.ts',
      'scripts/test-packaged-windows.mjs',
      'docs/USER_GUIDE_AUTO_AUGMENT.md',
      'docs/GAMEFLOW_DETECTION_GUIDE.md',
      'docs/RELEASE_WINDOW_SMOKE.md',
      'docs/client-api-strategy.md',
    ].map(file => readFile(repoFile(file), 'utf8')))

    expect(files.join('\n')).not.toMatch(/augment-side-panel|showAugmentSidePanel|hideAugmentSidePanel|右侧推荐列表|right recommendation panel/)
  })

  it('labels the third-party Arena metric with its inferred meaning', () => {
    expect(JSON.stringify(messages['zh-CN'].arenaLeaderboard)).not.toContain('胜率')
    expect(JSON.stringify(messages['zh-TW'].arenaLeaderboard)).not.toContain('勝率')
    expect(JSON.stringify(messages['en-US'].arenaLeaderboard)).not.toContain('win rate')
    expect(messages['zh-CN'].arenaLeaderboard.metricWinrate).toContain('口径未验证')
    expect(messages['en-US'].arenaLeaderboard.metricWinrate).toContain('unverified definition')
  })

  it('packages and releases only resources that exist in the Arena repository', async () => {
    const [packageJson, packScript, releaseWorkflow] = await Promise.all([
      readFile(repoFile('package.json'), 'utf8'),
      readFile(repoFile('scripts/pack-electron.mjs'), 'utf8'),
      readFile(repoFile('.github/workflows/release-windows.yml'), 'utf8'),
    ])

    const releaseContract = [packageJson, packScript, releaseWorkflow].join('\n')
    expect(releaseContract).not.toContain('fetch-client-data.mjs')
    expect(releaseContract).not.toContain('resources/client-data')
    expect(releaseContract).not.toContain('resources\\client-data')
  })
})
