// Repair the Electron binary when `npm install`'s postinstall step did
// not complete.
//
// Why this exists: on some Windows setups npm's postinstall for the
// `electron` package dies part-way (EPERM / antivirus locking the target
// directory), leaving `node_modules/electron` with its JS files but no
// `dist/` and no `path.txt`. `electron-vite dev` then fails with
// "Electron failed to install correctly, please delete node_modules/electron
// and try installing again" — and reinstalling hits the same wall.
//
// This script does exactly what electron's own install.js does, without
// npm in the loop:
//
//   1. downloadArtifact() from @electron/get -> path to the win32-x64 zip
//      (cached, so re-runs are free)
//   2. extract-zip it into node_modules/electron/dist
//   3. write node_modules/electron/path.txt
//
// Usage:  node scripts/install-electron-dist.mjs
//
// Idempotent: exits early when dist/electron.exe already matches the
// version in electron/package.json.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import os from 'node:os'
import { createRequire } from 'node:module'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const electronDir = path.join(root, 'node_modules', 'electron')
const require = createRequire(import.meta.url)

function fail(msg) {
  console.error('[install-electron-dist] ' + msg)
  process.exit(1)
}

if (!fs.existsSync(path.join(electronDir, 'package.json'))) {
  fail('node_modules/electron is missing. Run `npm install` first (it is fine if the postinstall fails).')
}

const version = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8')).version
const platform = process.env.ELECTRON_INSTALL_PLATFORM || process.platform
const arch = process.env.ELECTRON_INSTALL_ARCH || process.arch

const platformPath = platform === 'win32' ? 'electron.exe' : platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'
const exePath = path.join(electronDir, 'dist', platformPath)

// Already good?
if (fs.existsSync(exePath)) {
  let installedVersion = ''
  try {
    installedVersion = fs.readFileSync(path.join(electronDir, 'dist', 'version'), 'utf8').replace(/^v/, '').trim()
  } catch {
    /* missing version file means a partial extract; fall through and redo it */
  }
  if (installedVersion === version) {
    console.log('[install-electron-dist] already installed: electron ' + version + ' at ' + exePath)
    process.exit(0)
  }
  console.log('[install-electron-dist] dist exists but version mismatch (' + (installedVersion || 'unknown') + ' != ' + version + '); reinstalling')
}

// Cache inside the project so the download is never blocked by permissions
// on a machine-wide cache directory.
const cacheRoot = process.env.electron_config_cache || path.join(root, 'node_modules', '.cache', 'electron')

console.log('[install-electron-dist] electron ' + version + ' ' + platform + '-' + arch)
console.log('[install-electron-dist] cache: ' + cacheRoot)

let extract
try {
  extract = require('extract-zip')
} catch {
  fail('extract-zip is not installed. Run `npm install` first.')
}

let downloadArtifact
try {
  ;({ downloadArtifact } = await import('@electron/get'))
} catch (err) {
  fail('cannot load @electron/get: ' + err.message)
}

let zipPath
try {
  zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    cacheRoot,
  })
  console.log('[install-electron-dist] artifact: ' + zipPath)
} catch (err) {
  fail('download failed: ' + (err && err.stack ? err.stack : err))
}

const distDir = path.join(electronDir, 'dist')
fs.mkdirSync(distDir, { recursive: true })

try {
  await extract(zipPath, { dir: distDir })
  console.log('[install-electron-dist] extracted to ' + distDir)
} catch (err) {
  fail('extract failed: ' + (err && err.stack ? err.stack : err))
}

fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath)
console.log('[install-electron-dist] wrote path.txt = ' + platformPath)

if (!fs.existsSync(exePath)) {
  fail('extraction finished but ' + exePath + ' is still missing')
}

const size = fs.statSync(exePath).size
console.log('[install-electron-dist] OK: ' + exePath + ' (' + Math.round(size / 1024 / 1024) + 'MB)')
