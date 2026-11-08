import { describe, expect, it } from 'vitest'
import { createRun, gameReducer, getRoom, sideTripRemaining, visitUnavailable } from './engine'
import { ROOMS } from './content'
import type { GameState, RoomId } from './types'

const choose = (game: GameState, direction: 'up' | 'left' | 'right' = 'up') =>
  gameReducer(game, { type: 'CHOOSE', direction })

function checkpoint(roomsCleared = 5): GameState {
  return { ...createRun(12345), roomsCleared }
}

function atRoom(id: RoomId): GameState {
  const game = createRun(12345)
  const roomIndex = game.deck.indexOf(id)
  if (roomIndex < 0) throw new Error(`Missing fictional encounter: ${id}`)
  return { ...game, roomIndex, roomsCleared: roomIndex, player: { ...game.player, health: 1000, maxHealth: 1000 } }
}

describe('a longer road to the guardian', () => {
  it('places eleven unique encounters before the first boss', () => {
    const game = createRun(12345)
    expect(game.deck).toHaveLength(12)
    expect(new Set(game.deck).size).toBe(12)
    expect(game.deck.slice(0, -1).every((id) => ROOMS[id].kind !== 'boss')).toBe(true)
    expect(game.deck.at(-1)).toBe('hollow-king')
  })

  it('has ordinary monsters with meaningfully different toughness', () => {
    function strikesToWin(id: RoomId) {
      let game = choose(atRoom(id))
      expect(game.roomIndex).toBe(atRoom(id).roomIndex)
      expect(game.combat?.turn).toBe(0)
      game = choose(game)
      expect(game.combat?.result).toBe('fighting')
      let strikes = 1
      while (game.combat?.result === 'fighting' && strikes < 40) {
        game = choose(game)
        strikes += 1
      }
      expect(game.combat?.result).toBe('victory')
      return strikes
    }
    expect(strikesToWin('grave-brute')).toBeGreaterThan(strikesToWin('crypt-skulk'))
  })

  it('records passed encounters once without revealing a sneaked-past monster', () => {
    const base = atRoom('crypt-skulk')
    const game = { ...base, player: { ...base.player, dexterity: 100 } }
    const passed = choose(game, 'left')
    expect(passed.history.at(-1)).toMatchObject({ roomId: 'crypt-skulk', known: false, outcome: 'passed' })
    expect(passed.discovered).not.toContain('crypt-skulk')
    expect(passed.roomsCleared).toBe(game.roomsCleared + 1)
    expect(game.history).toEqual([])
  })
})

describe('one playable side trip every five dungeon rooms', () => {
  it('blocks at four rooms, unlocks at five, and consumes the gate on entry', () => {
    const early = checkpoint(4)
    expect(sideTripRemaining(early)).toBe(1)
    expect(visitUnavailable(early, 'mossmere')).toContain('1 more room')
    const rejected = gameReducer(early, { type: 'START_VISIT', destinationId: 'mossmere' })
    expect(rejected.visit).toBeNull()
    expect(rejected.lastSideTripAt).toBe(0)
    expect(rejected.player).toEqual(early.player)

    const ready = checkpoint()
    expect(visitUnavailable(ready, 'mossmere')).toBeNull()
    const entered = gameReducer(ready, { type: 'START_VISIT', destinationId: 'mossmere' })
    expect(entered.visit).toMatchObject({ destinationId: 'mossmere', venueId: null })
    expect(entered.lastSideTripAt).toBe(5)
    expect(entered.roomsCleared).toBe(5)
    const left = gameReducer(entered, { type: 'END_VISIT' })
    expect(left.visit).toBeNull()
    expect(sideTripRemaining(left)).toBe(5)
    expect(sideTripRemaining({ ...left, roomsCleared: 9 })).toBe(1)
    expect(visitUnavailable({ ...left, roomsCleared: 10 }, 'mossmere')).toBeNull()
  })

  it('does not count exploring a city or visiting its venues as dungeon rooms', () => {
    const before = checkpoint()
    const entered = gameReducer(before, { type: 'START_VISIT', destinationId: 'mossmere' })
    const explored = gameReducer(entered, { type: 'EXPLORE_CITY' })
    expect(explored.player.xp).toBe(before.player.xp + 2)
    expect(explored.worldExplored).toContain('mossmere')
    const repeated = gameReducer(explored, { type: 'EXPLORE_CITY' })
    expect(repeated.player).toEqual(explored.player)
    const venue = gameReducer(repeated, { type: 'VISIT_VENUE', destinationId: 'pilgrim-camp' })
    expect(venue.visit?.venueId).toBe('pilgrim-camp')
    expect(venue.roomsCleared).toBe(5)
    expect(venue.lastSideTripAt).toBe(5)
    const wrongCity = gameReducer(venue, { type: 'VISIT_VENUE', destinationId: 'smith-forge' })
    expect(wrongCity.visit).toEqual(venue.visit)
  })

  it('keeps the dungeon route, RNG, and encounter intact during a real NPC visit', () => {
    const base = checkpoint()
    const before = { ...base, player: { ...base.player, health: 50, mana: 10 } }
    const entered = gameReducer(before, { type: 'START_VISIT', destinationId: 'pilgrim-camp' })
    const rested = gameReducer(entered, { type: 'VISIT_RESPONSE', response: 'rest' })
    expect(rested.player.health).toBeGreaterThan(before.player.health)
    expect(rested.player.mana).toBe(18)
    expect(rested.npcRewards).toContain('lost-pilgrim')
    const repeated = gameReducer(rested, { type: 'VISIT_RESPONSE', response: 'rumor' })
    expect(repeated.player).toEqual(rested.player)
    const returned = gameReducer(repeated, { type: 'END_VISIT' })
    expect(returned.deck).toEqual(before.deck)
    expect(returned.roomIndex).toBe(before.roomIndex)
    expect(returned.floor).toBe(before.floor)
    expect(returned.rng).toBe(before.rng)
    expect(returned.discovered).toEqual(before.discovered)
    expect(getRoom(returned)).toEqual(getRoom(before))
  })

  it('shares the NPC reward ledger with the dungeon encounter', () => {
    const before = { ...atRoom('lost-pilgrim'), roomsCleared: 5 }
    const visited = gameReducer(gameReducer(before, { type: 'START_VISIT', destinationId: 'pilgrim-camp' }), { type: 'VISIT_RESPONSE', response: 'rumor' })
    const returned = gameReducer(visited, { type: 'END_VISIT' })
    const talking = choose(returned, 'left')
    const repeated = gameReducer(talking, { type: 'RESPOND_NPC', response: 'rumor' })
    expect(repeated.player).toEqual(returned.player)
    expect(repeated.feedback.text).toContain('already')
  })

  it('uses actual prices and capacity checks at a visited merchant', () => {
    const entered = gameReducer(checkpoint(), { type: 'START_VISIT', destinationId: 'lantern-market' })
    const bought = gameReducer(entered, { type: 'VISIT_BUY', item: 'tonic' })
    expect(bought.player.gold).toBe(entered.player.gold - 15)
    expect(bought.player.potions).toBe(entered.player.potions + 1)
    expect(bought.roomIndex).toBe(entered.roomIndex)
    const empty = { ...bought, player: { ...bought.player, gold: 0 } }
    expect(gameReducer(empty, { type: 'VISIT_BUY', item: 'aether' }).player).toEqual(empty.player)
    const full = { ...bought, player: { ...bought.player, potions: 1000 } }
    expect(gameReducer(full, { type: 'VISIT_BUY', item: 'tonic' }).player).toEqual(full.player)
  })

  it('rejects combat, unresolved interactions, locked regions, and hidden route actions', () => {
    const fighting = { ...choose(atRoom('crypt-skulk')), roomsCleared: 10 }
    expect(visitUnavailable(fighting, 'mossmere')).toContain('fight')
    expect(gameReducer(fighting, { type: 'START_VISIT', destinationId: 'mossmere' }).combat).toEqual(fighting.combat)
    expect(visitUnavailable(checkpoint(), 'cinderhaven')).toContain('region')
    const puzzle = choose(atRoom('sealed-coffer'))
    expect(visitUnavailable({ ...puzzle, roomsCleared: 10 }, 'mossmere')).toContain('interaction')
    const entered = gameReducer(checkpoint(), { type: 'START_VISIT', destinationId: 'mossmere' })
    expect(choose(entered).roomIndex).toBe(entered.roomIndex)
    expect(choose(entered).roomsCleared).toBe(entered.roomsCleared)
    expect(createRun(678).lastSideTripAt).toBe(0)
  })
})
