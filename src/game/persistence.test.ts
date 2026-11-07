import { describe, expect, it } from 'vitest'
import { createSocialState } from '../social/types'
import { createRun, gameReducer } from './engine'
import { loadSave, SAVE_KEY, VERSION_TWO_SAVE_KEY, writeSave } from './persistence'
import { savedGameSchema, versionTwoSavedGameSchema } from './types'
import type { GameState, RoomId, SavedGame } from './types'

const route: RoomId[] = [
  'ashen-gate', 'crypt-skulk', 'lost-pilgrim', 'sealed-coffer',
  'lantern-merchant', 'moon-well', 'bone-sentry', 'hollow-king',
]

function versionTwoGame(game: GameState) {
  return {
    seed: game.seed, rng: game.rng, runNumber: game.runNumber, floor: game.floor,
    roomIndex: game.roomIndex, deck: game.deck, status: game.status,
    player: game.player, roomsCleared: game.roomsCleared, studied: game.studied,
    puzzle: game.puzzle, journal: game.journal, discovered: game.discovered,
    searched: game.searched, combat: game.combat, dialogue: game.dialogue,
    omen: game.omen, feedback: game.feedback,
  }
}

describe('social save migration and integrity', () => {
  it('migrates an eight-room version-2 route and its unfinished fight without replaying it', () => {
    const base = { ...createRun(12345), deck: [...route], roomIndex: 1, roomsCleared: 1 }
    const fighting = gameReducer(base, { type: 'CHOOSE', direction: 'up' })
    const old = versionTwoSavedGameSchema.parse({
      version: 2, game: versionTwoGame(fighting),
      settings: { sound: true, hints: false }, records: { bestFloor: 2, wins: 1 },
    })
    const values = new Map([[VERSION_TWO_SAVE_KEY, JSON.stringify(old)]])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const migrated = loadSave(storage)
    expect(migrated.error).toBeNull()
    expect(migrated.save?.version).toBe(3)
    expect(migrated.save?.game.deck).toEqual(route)
    expect(migrated.save?.game.rng).toBe(old.game.rng)
    expect(migrated.save?.game.player).toEqual(old.game.player)
    expect(migrated.save?.game.combat).toEqual(old.game.combat)
    expect(migrated.save?.settings).toEqual(old.settings)
    expect(migrated.save?.records).toEqual(old.records)
    expect(migrated.save?.social).toEqual(createSocialState())
    if (!migrated.save) throw new Error('The fictional legacy save failed to migrate.')
    expect(writeSave(migrated.save, storage)).toBeNull()
    expect(values.get(VERSION_TWO_SAVE_KEY)).toBe(JSON.stringify(old))
    expect(values.has(SAVE_KEY)).toBe(true)
  })

  it('persists an active side trip and its consumed five-room cooldown', () => {
    const game = gameReducer({ ...createRun(12345), roomsCleared: 5 }, { type: 'START_VISIT', destinationId: 'mossmere' })
    const save: SavedGame = {
      version: 3, game, social: createSocialState(),
      settings: { sound: false, hints: true }, records: { bestFloor: 1, wins: 0 },
    }
    let value: string | null = null
    expect(writeSave(save, { setItem: (_key, payload) => { value = payload } })).toBeNull()
    expect(loadSave({ getItem: () => value })).toEqual({ save, error: null })
    expect(save.game.lastSideTripAt).toBe(5)
  })

  it('rejects forged cooldowns, claims, and conflicting encounter/visit state', () => {
    const save: SavedGame = {
      version: 3, game: createRun(12345), social: createSocialState(),
      settings: { sound: false, hints: true }, records: { bestFloor: 1, wins: 0 },
    }
    for (const game of [
      { ...save.game, lastSideTripAt: 5 },
      { ...save.game, giftClaims: ['mosskeeper'] },
      { ...save.game, visit: { destinationId: 'cinderhaven', venueId: null, explored: false } },
      { ...save.game, visit: { destinationId: 'mossmere', venueId: 'smith-forge', explored: false } },
    ]) {
      expect(savedGameSchema.safeParse({ ...save, game }).success).toBe(false)
    }
  })

  it('does not silently roll back a corrupt newer save to a valid legacy one', () => {
    const base = { ...createRun(12345), deck: [...route] }
    const old = { version: 2, game: versionTwoGame(base), settings: { sound: false, hints: true }, records: { bestFloor: 1, wins: 0 } }
    const values = new Map([[SAVE_KEY, '{damaged'], [VERSION_TWO_SAVE_KEY, JSON.stringify(old)]])
    const result = loadSave({ getItem: (key) => values.get(key) ?? null })
    expect(result.save).toBeNull()
    expect(result.error).toContain('damaged')
  })
})
