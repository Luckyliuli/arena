// Locate a file that ships inside the project's `resources/` directory.
//
// Paths passed here are **relative to the project root** and keep the
// `resources/` segment (e.g. `resources/augments-arena.json`), matching what
// the callers already had. That single spelling then has to be translated into
// several real locations, because the same module sits at a different depth
// before and after bundling, and packaging moves the file:
//
//   source tree   arena/src/shared/augment-dictionary.ts  -> arena/resources/<file>
//   bundled       arena/dist-electron/<chunk>.js          -> arena/resources/<file>
//   packaged      <install>/resources/<file>              (extraResources, flattened)
//
// electron-builder flattens `extraResources`, so `resources/x.json` declared
// in package.json ships as `<resourcesPath>/x.json` — the `resources/` segment
// is dropped on the way in.
//
// Probing the known layouts is the same convention already used by
// `src/main/image-analyzer.ts` and `src/main/data-loader.ts` for their bundled
// data directories.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

/**
 * Candidate absolute locations for a project-root-relative path, best guess
 * first. Exposed so callers and tests can report exactly where they looked.
 */
export function resourceFileCandidates(relativePath: string): string[] {
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const roots = [
    // bundled by electron-vite: dist-electron/ -> project root
    path.resolve(here, '..'),
    // running from the source tree: src/shared/ -> project root
    path.resolve(here, '..', '..'),
    // launched with the project root as cwd
    process.cwd(),
  ]
  const candidates = roots.map(root => path.join(root, relativePath))
  if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, relativePath.replace(/^resources[\\/]/, '')))
  }
  return [...new Set(candidates)]
}

/** First existing candidate, or null. Absolute paths are used verbatim. */
export function findResourceFile(relativePath: string): string | null {
  if (path.isAbsolute(relativePath)) {
    return fs.existsSync(relativePath) ? relativePath : null
  }
  for (const candidate of resourceFileCandidates(relativePath)) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Like {@link findResourceFile} but throws with the full candidate list, so a
 * bundling or packaging mistake surfaces as an actionable message instead of a
 * bare ENOENT pointing at one arbitrary guess.
 */
export function requireResourceFile(relativePath: string, label: string): string {
  const found = findResourceFile(relativePath)
  if (found) return found
  throw new Error(
    `${label}: ${relativePath} not found. Looked in:\n  ` +
    resourceFileCandidates(relativePath).join('\n  '),
  )
}
