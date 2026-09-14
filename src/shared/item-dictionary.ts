import fs from 'node:fs'
import path from 'node:path'
import { requireResourceFile } from './resource-path.ts'

export type ArenaItemDictionaryRecord = {
  id: number
  displayName: { en: string; zh: string }
  iconUrl: string | null
}

const DEFAULT_RELATIVE = path.join('resources', 'items-arena.json')
let cached: readonly ArenaItemDictionaryRecord[] | null = null

export function loadArenaItemDictionary(filePath?: string): readonly ArenaItemDictionaryRecord[] {
  if (filePath) return Object.freeze(JSON.parse(fs.readFileSync(requireResourceFile(filePath, 'items-arena'), 'utf8')))
  if (cached) return cached
  const parsed = JSON.parse(fs.readFileSync(requireResourceFile(DEFAULT_RELATIVE, 'items-arena'), 'utf8'))
  if (!Array.isArray(parsed)) throw new Error('items-arena: expected an array')
  cached = Object.freeze(parsed)
  return cached
}

export function findArenaItemByName(name: string, locale: 'zh' | 'en' = 'zh'): ArenaItemDictionaryRecord | undefined {
  return loadArenaItemDictionary().find(record => record.displayName[locale] === name || record.displayName.en === name)
}

export function findArenaItemById(id: number): ArenaItemDictionaryRecord | undefined {
  return loadArenaItemDictionary().find(record => record.id === id)
}
