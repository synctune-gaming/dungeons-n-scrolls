import { createRun } from './engine'
import { createSocialState } from '../social/types'
import { legacySavedGameSchema, NPC_ROOM_IDS, savedGameSchema, versionTwoSavedGameSchema } from './types'
import type { GameState, LegacySavedGame, SavedGame, VersionTwoSavedGame } from './types'

export const SAVE_KEY = 'dungeons-and-scrolls.save.v3'
export const VERSION_TWO_SAVE_KEY = 'dungeons-and-scrolls.save.v2'
export const LEGACY_SAVE_KEY = 'dungeons-and-scrolls.save.v1'

export function migrateSave(legacy: LegacySavedGame | VersionTwoSavedGame): SavedGame {
  const old = legacy.game
  const fresh = createRun(old.seed, old.player.classId, old.runNumber)
  const maxMana = 16 + old.player.wisdom * 2 + (old.player.level - 1) * 2
  const game: GameState = legacy.version === 1
    ? { ...fresh, ...legacy.game, player: { ...legacy.game.player, mana: maxMana, maxMana, aether: 1 }, discovered: old.deck.slice(0, old.roomIndex + 1) }
    : { ...fresh, ...legacy.game }
  const passed = old.deck.slice(0, old.status === 'won' ? old.deck.length : old.roomIndex)
  const start = Math.max(0, old.roomsCleared - passed.length)
  game.history = passed.map((roomId, index) => ({
    roomId, floor: old.floor, known: game.discovered.includes(roomId),
    outcome: 'passed', sequence: start + index,
  }))
  game.npcRewards = NPC_ROOM_IDS.filter((id) => passed.includes(id))
  return { ...legacy, version: 3, game, social: createSocialState() }
}

export function loadSave(storage?: Pick<Storage, 'getItem'>): { save: SavedGame | null; error: string | null } {
  let raw: string | null
  try {
    const target = storage ?? window.localStorage
    raw = target.getItem(SAVE_KEY) ?? target.getItem(VERSION_TWO_SAVE_KEY) ?? target.getItem(LEGACY_SAVE_KEY)
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
    const versionTwo = versionTwoSavedGameSchema.safeParse(data)
    const versionOne = legacySavedGameSchema.safeParse(data)
    const legacy = versionTwo.success ? versionTwo.data : versionOne.success ? versionOne.data : null
    if (legacy) {
      const migrated = savedGameSchema.safeParse(migrateSave(legacy))
      if (migrated.success) return { save: migrated.data, error: null }
      console.error('The legacy adventure could not migrate:', migrated.error.issues)
    }
    console.error('The saved adventure is incompatible:', result.error.issues)
    return { save: null, error: 'Your saved adventure is damaged or from an unsupported version. A new adventure has started.' }
  }
  return { save: result.data, error: null }
}

export function writeSave(save: SavedGame, storage?: Pick<Storage, 'setItem'>): string | null {
  const result = savedGameSchema.safeParse(save)
  if (!result.success) {
    console.error('The adventure cannot save inconsistent state:', result.error.issues)
    return 'Your adventure contains inconsistent progress and could not save. Keep this tab open and reload only after resolving the problem.'
  }
  try {
    (storage ?? window.localStorage).setItem(SAVE_KEY, JSON.stringify(save))
    return null
  } catch (error) {
    console.error('Cannot save the adventure:', error)
    return 'Your adventure could not save. Allow browser storage and keep this tab open to avoid losing progress.'
  }
}
