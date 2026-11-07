import { describe, expect, it } from 'vitest'
import { createRun, gameReducer, getChoices, getRoom } from './engine'
import { loadSave, SAVE_KEY, writeSave } from './persistence'
import { CLASS_IDS, savedGameSchema } from './types'
import type { GameState, Player, RoomId, SavedGame } from './types'

function encounter(id: RoomId, player: Partial<Player> = {}): GameState {
  const game = createRun(12345)
  return {
    ...game,
    deck: [id, 'ashen-gate'],
    player: { ...game.player, ...player },
  }
}

const choose = (game: GameState, direction: 'up' | 'left' | 'right' = 'up') =>
  gameReducer(game, { type: 'CHOOSE', direction })

describe('a replayable descent', () => {
  it('starts in the overworld with a complete adventurer and a boss at the end', () => {
    const game = createRun(12345)
    expect(getRoom(game).zone).toBe('overworld')
    expect(game.player.health).toBe(game.player.maxHealth)
    expect(game.deck).toHaveLength(8)
    expect(game.deck.at(-1)).toBe('hollow-king')
    expect(game.status).toBe('active')
  })

  it('reproduces a seed without mutating earlier state', () => {
    const first = createRun(12345)
    const snapshot = structuredClone(first)
    expect(createRun(12345)).toEqual(first)
    expect(choose(first)).toEqual(choose(createRun(12345)))
    expect(first).toEqual(snapshot)
  })

  it('changes the route for a different seed', () => {
    const routes = new Set([1, 2, 3, 4, 5].map((seed) => createRun(seed).deck.join(',')))
    expect(routes.size).toBeGreaterThan(1)
  })

  it('gives each class a meaningful strength and resets a new run', () => {
    const shade = createRun(42, 'shade', 2)
    const ironbound = createRun(42, 'ironbound', 3)
    expect(shade.player.dexterity).toBeGreaterThan(ironbound.player.dexterity)
    expect(ironbound.player.maxHealth).toBeGreaterThan(shade.player.maxHealth)
    expect(ironbound.runNumber).toBe(3)
    expect(ironbound.roomsCleared).toBe(0)
  })
})

describe('quick combat and choices', () => {
  it('resolves a fight in one gesture with health, gold, and experience changes', () => {
    const game = encounter('crypt-skulk')
    const fought = choose(game)
    expect(fought.roomIndex).toBe(1)
    expect(fought.player.health).toBeLessThan(game.player.health)
    expect(fought.player.gold).toBeGreaterThan(game.player.gold)
    expect(fought.player.xp + fought.player.level).toBeGreaterThan(1)
    expect(fought.journal.at(-1)?.text).toContain('Crypt skulk')
  })

  it('lets a dexterous adventurer sneak past without stealing combat rewards', () => {
    const game = encounter('crypt-skulk', { dexterity: 30 })
    const sneaked = choose(game, 'left')
    expect(sneaked.roomIndex).toBe(1)
    expect(sneaked.player.health).toBe(game.player.health)
    expect(sneaked.player.gold).toBe(game.player.gold)
  })

  it('makes fleeing cost health but not reward gold', () => {
    const game = encounter('bone-sentry')
    const fled = choose(game, 'right')
    expect(fled.roomIndex).toBe(1)
    expect(fled.player.health).toBeLessThan(game.player.health)
    expect(fled.player.gold).toBe(game.player.gold)
  })

  it('allows talking and trading with strangers', () => {
    const game = encounter('lost-pilgrim')
    expect(choose(game, 'left').player.gold).toBeGreaterThan(game.player.gold)
    const traded = choose(game, 'right')
    expect(traded.player.gold).toBe(game.player.gold - 20)
    expect(traded.player.potions).toBe(game.player.potions + 1)
  })

  it('does not purchase on insufficient funds, and explains the problem', () => {
    const game = encounter('lantern-merchant', { gold: 0 })
    const rejected = choose(game, 'left')
    expect(rejected.player).toEqual(game.player)
    expect(rejected.roomIndex).toBe(0)
    expect(rejected.journal.at(-1)?.text).toContain('gold')
    expect(getChoices(game).find((choice) => choice.direction === 'left')?.disabled).toBe(true)
  })

  it('lets a shop sell a tonic without forcing the player out', () => {
    const game = encounter('lantern-merchant')
    const bought = choose(game, 'left')
    expect(bought.player.potions).toBe(game.player.potions + 1)
    expect(bought.player.gold).toBe(game.player.gold - 15)
    expect(bought.roomIndex).toBe(0)
    expect(choose(bought).roomIndex).toBe(1)
  })

  it('respects satchel capacity when trading with an NPC', () => {
    const game = encounter('lost-pilgrim', { potions: 1000 })
    expect(choose(game, 'right').player).toEqual(game.player)
    expect(getChoices(game).find((choice) => choice.direction === 'right')?.disabled).toBe(true)
  })

  it('cannot farm a purchased relic', () => {
    const game = encounter('lantern-merchant', { gold: 100 })
    const bought = choose(game, 'right')
    const repeated = choose(bought, 'right')
    expect(bought.player.relics).toContain('iron-charm')
    expect(repeated.player).toEqual(bought.player)
  })

  it('caps healing and refuses to waste a potion at full health', () => {
    const game = encounter('crypt-skulk', { health: 70 })
    const healed = gameReducer(game, { type: 'DRINK_POTION' })
    expect(healed.player.health).toBe(80)
    expect(healed.player.potions).toBe(game.player.potions - 1)
    expect(gameReducer(healed, { type: 'DRINK_POTION' }).player).toEqual(healed.player)
  })

  it('ends at zero health and prevents any further rewards', () => {
    const game = encounter('bone-sentry', { health: 1 })
    const dead = choose(game)
    expect(dead.status).toBe('dead')
    expect(dead.player.health).toBe(0)
    expect(dead.player.gold).toBe(game.player.gold)
    expect(choose(dead)).toBe(dead)
    expect(gameReducer(dead, { type: 'DRINK_POTION' })).toBe(dead)
  })
})

describe('rune-locked chests', () => {
  it('requires a puzzle only when dexterity is low', () => {
    const low = choose(encounter('sealed-coffer', { dexterity: 6 }))
    expect(low.puzzle).not.toBeNull()
    expect(low.roomIndex).toBe(0)
    const high = choose(encounter('sealed-coffer', { dexterity: 8 }))
    expect(high.puzzle).toBeNull()
    expect(high.roomIndex).toBe(1)
  })

  it('unlocks the chest by matching its sequence and awards loot exactly once', () => {
    let game = choose(encounter('sealed-coffer', { dexterity: 6 }))
    const runes = game.puzzle?.combination
    expect(runes).toHaveLength(3)
    for (const rune of runes ?? []) {
      game = gameReducer(game, { type: 'PICK_RUNE', rune })
    }
    expect(game.puzzle).toBeNull()
    expect(game.roomIndex).toBe(1)
    expect(game.player.relics).toHaveLength(1)
    const after = gameReducer(game, { type: 'PICK_RUNE', rune: 'moon' })
    expect(after).toBe(game)
  })

  it('charges for a wrong rune and jams after three mistakes', () => {
    let game = choose(encounter('sealed-coffer', { dexterity: 6 }))
    const correct = game.puzzle?.combination[0]
    const wrong = correct === 'moon' ? 'flame' : 'moon'
    for (let attempt = 0; attempt < 3; attempt += 1) {
      game = gameReducer(game, { type: 'PICK_RUNE', rune: wrong })
    }
    expect(game.puzzle).toBeNull()
    expect(game.roomIndex).toBe(1)
    expect(game.player.health).toBe(68)
    expect(game.player.relics).toHaveLength(0)
  })

  it('lets the player close the puzzle without opening or skipping the chest', () => {
    const game = choose(encounter('sealed-coffer'))
    const closed = gameReducer(game, { type: 'CLOSE_PUZZLE' })
    expect(closed.puzzle).toBeNull()
    expect(closed.roomIndex).toBe(0)
    expect(closed.player).toEqual(game.player)
  })
})

describe('bosses, progression, and victory', () => {
  it('does not allow a boss to be skipped or its weakness to be farmed', () => {
    const game = encounter('hollow-king')
    const studied = choose(game, 'right')
    expect(studied.roomIndex).toBe(0)
    expect(studied.studied).toBe(true)
    expect(studied.player.health).toBeLessThan(game.player.health)
    expect(choose(studied, 'right').player).toEqual(studied.player)
  })

  it('moves from the first boss into a new overworld region', () => {
    const game = encounter('hollow-king', { strength: 30 })
    const nextFloor = choose(game)
    expect(nextFloor.floor).toBe(2)
    expect(nextFloor.roomIndex).toBe(0)
    expect(nextFloor.status).toBe('active')
    expect(getRoom(nextFloor).zone).toBe('overworld')
    expect(nextFloor.deck.at(-1)).toBe('cinder-drake')
  })

  it('wins only after the final boss and freezes the completed run', () => {
    const game = { ...encounter('pale-warden', { strength: 30 }), floor: 3 }
    const won = choose(game)
    expect(won.status).toBe('won')
    expect(won.puzzle).toBeNull()
    expect(choose(won)).toBe(won)
  })

  it('levels up from experience with real stat and health improvements', () => {
    const game = encounter('crypt-skulk', { xp: 11 })
    const fought = choose(game)
    expect(fought.player.level).toBe(2)
    expect(fought.player.strength).toBeGreaterThan(game.player.strength)
    expect(fought.player.maxHealth).toBeGreaterThan(game.player.maxHealth)
  })
})

describe('saved adventures', () => {
  const save: SavedGame = {
    version: 1,
    game: createRun(12345),
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  }

  it('round-trips a complete run, preferences, and records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    expect(writeSave(save, storage)).toBeNull()
    expect(values.has(SAVE_KEY)).toBe(true)
    expect(loadSave(storage)).toEqual({ save, error: null })
  })

  it('rejects corrupt, unknown-version, and impossible saves with a visible error', () => {
    for (const value of [
      '{broken',
      JSON.stringify({ ...save, version: 99 }),
      JSON.stringify({ ...save, game: { ...save.game, roomIndex: 99 } }),
      JSON.stringify({ ...save, game: { ...save.game, player: { ...save.game.player, health: 999 } } }),
    ]) {
      const result = loadSave({ getItem: () => value })
      expect(result.save).toBeNull()
      expect(result.error).toContain('saved')
    }
  })

  it('reports blocked browser storage instead of pretending to save', () => {
    const blocked = {
      getItem: () => { throw new Error('Storage blocked') },
      setItem: () => { throw new Error('Storage blocked') },
    }
    expect(loadSave(blocked).error).toContain('saved')
    expect(writeSave(save, blocked)).toContain('save')
  })

  it('keeps every intermediate state saveable across classes and varied seeded choices', () => {
    for (const classId of CLASS_IDS) {
      for (let seed = 1; seed <= 30; seed += 1) {
        let game = createRun(seed, classId)
        for (let step = 0; step < 80 && game.status === 'active'; step += 1) {
          if (game.puzzle) {
            const rune = game.puzzle.combination[game.puzzle.progress]
            if (!rune) throw new Error('The test run has an incomplete puzzle.')
            game = gameReducer(game, { type: 'PICK_RUNE', rune })
          } else if (game.player.health < game.player.maxHealth / 2 && game.player.potions > 0) {
            game = gameReducer(game, { type: 'DRINK_POTION' })
          } else {
            const choices = getChoices(game).filter((choice) => !choice.disabled)
            const choice = choices[(seed + step) % choices.length]
            if (!choice) throw new Error('The test run has no available choices.')
            game = choose(game, choice.direction)
          }
          expect(savedGameSchema.safeParse({ ...save, game }).success).toBe(true)
        }
      }
    }
  })
})
