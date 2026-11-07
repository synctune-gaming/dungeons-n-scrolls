import { createRun } from './engine'
import { legacySavedGameSchema, savedGameSchema } from './types'
import type { LegacySavedGame, SavedGame } from './types'

export const SAVE_KEY = 'dungeons-and-scrolls.save.v2'
export const LEGACY_SAVE_KEY = 'dungeons-and-scrolls.save.v1'

export function migrateSave(legacy: LegacySavedGame): SavedGame {
  const old = legacy.game
  const fresh = createRun(old.seed, old.player.classId, old.runNumber)
  const maxMana = 16 + old.player.wisdom * 2 + (old.player.level - 1) * 2
  return {
    ...legacy, version: 2,
    game: {
      ...fresh, ...old,
      player: { ...old.player, mana: maxMana, maxMana, aether: 1 },
      discovered: old.deck.slice(0, old.roomIndex + 1),
    },
  }
}

export function loadSave(storage?: Pick<Storage, 'getItem'>): { save: SavedGame | null; error: string | null } {
  let raw: string | null
  try {
    const target = storage ?? window.localStorage
    raw = target.getItem(SAVE_KEY) ?? target.getItem(LEGACY_SAVE_KEY)
  } catch (error) {
    console.error('Cannot read the saved adventure:', error)
    return { save: null, error: 'Your saved adventure cannot be read. Allow browser storage to keep your progress.' }
  }
  if (raw === null) return { save: null, error: null }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (error) {
    console.error('The saved adventure is not valid JSON:', error)
    return { save: null, error: 'Your saved adventure is damaged. A new adventure has started.' }
  }
  const result = savedGameSchema.safeParse(data)
  if (!result.success) {
    const legacy = legacySavedGameSchema.safeParse(data)
    if (legacy.success) {
      const migrated = savedGameSchema.safeParse(migrateSave(legacy.data))
      if (migrated.success) return { save: migrated.data, error: null }
      console.error('The legacy adventure could not migrate:', migrated.error.issues)
    }
    console.error('The saved adventure is incompatible:', result.error.issues)
    return { save: null, error: 'Your saved adventure is damaged or from an unsupported version. A new adventure has started.' }
  }
  return { save: result.data, error: null }
}

export function writeSave(save: SavedGame, storage?: Pick<Storage, 'setItem'>): string | null {
  try {
    (storage ?? window.localStorage).setItem(SAVE_KEY, JSON.stringify(save))
    return null
  } catch (error) {
    console.error('Cannot save the adventure:', error)
    return 'Your adventure could not save. Allow browser storage and keep this tab open to avoid losing progress.'
  }
}
