import { describe, expect, it } from 'vitest'
import { createRun, gameReducer, getChoices } from './engine'
import type { GameState, Player, RoomId } from './types'

function inRoom(id: RoomId, player: Partial<Player> = {}): GameState {
  const game = createRun(12345)
  const roomIndex = game.deck.indexOf(id)
  if (roomIndex < 0) throw new Error(`No ${id} in the test route.`)
  return {
    ...game, roomIndex, roomsCleared: roomIndex,
    player: { ...game.player, ...player },
  }
}

const choose = (game: GameState, direction: 'up' | 'left' | 'right' = 'up') =>
  gameReducer(game, { type: 'CHOOSE', direction })

const start = (id: RoomId = 'crypt-skulk', player: Partial<Player> = {}) => choose(inRoom(id, player))

function withIntent(game: GameState, intent: 'heavy' | 'lunge' | 'hex'): GameState {
  if (!game.combat) throw new Error('The test encounter has no combat.')
  return { ...game, combat: { ...game.combat, intent } }
}

describe('encounters worth discovering', () => {
  it('does not reveal an enemy or a future boss just by generating the route', () => {
    const game = createRun(12345)
    expect(game.discovered).toEqual(['ashen-gate'])
    expect(game.discovered).not.toContain('hollow-king')
  })

  it('reveals the foe on approach without resolving the whole encounter', () => {
    const game = inRoom('crypt-skulk')
    const approached = choose(game)
    expect(approached.roomIndex).toBe(game.roomIndex)
    expect(approached.player).toEqual(game.player)
    expect(approached.combat?.health).toBeGreaterThan(0)
    expect(approached.combat?.turn).toBe(0)
    expect(approached.discovered).toContain('crypt-skulk')
    expect(approached.discovered).not.toContain('hollow-king')
  })

  it('lets the lantern reveal a foe without silently starting a fight', () => {
    const game = inRoom('crypt-skulk')
    const revealed = choose(game, 'right')
    expect(revealed.discovered).toContain('crypt-skulk')
    expect(revealed.combat).toBeNull()
    expect(revealed.player.mana).toBe(game.player.mana - 2)
    expect(revealed.roomIndex).toBe(game.roomIndex)
  })

  it('keeps an unidentified enemy unidentified when slipping past', () => {
    const game = inRoom('crypt-skulk', { dexterity: 30 })
    const passed = choose(game, 'left')
    expect(passed.roomIndex).toBe(game.roomIndex + 1)
    expect(passed.discovered).not.toContain('crypt-skulk')
    expect(passed.journal.at(-1)?.text).not.toContain('crypt skulk')
  })
})

describe('tactical turns', () => {
  it('trades blows across turns instead of paying out for one swipe', () => {
    const game = start()
    const attacked = choose(game)
    expect(attacked.roomIndex).toBe(game.roomIndex)
    expect(attacked.combat?.health).toBeLessThan(game.combat?.health ?? 0)
    expect(attacked.combat?.health).toBeGreaterThan(0)
    expect(attacked.combat?.turn).toBe(1)
    expect(attacked.player.gold).toBe(game.player.gold)
    expect(attacked.player.health).toBeLessThan(game.player.health)
    expect(attacked.feedback.enemyDamage).toBeGreaterThan(0)
  })

  it('makes guarding reduce a heavy attack and recover some mana', () => {
    const game = withIntent(start('crypt-skulk', { mana: 1 }), 'heavy')
    const attacked = choose(game)
    const guarded = choose(game, 'left')
    expect(guarded.player.health).toBeGreaterThan(attacked.player.health)
    expect(guarded.player.mana).toBeGreaterThan(game.player.mana)
    expect(guarded.combat?.turn).toBe(1)
    expect(guarded.combat?.opening).toBeGreaterThan(0)
  })

  it('lets dexterity dodge a telegraphed blow, but not an undodgeable curse', () => {
    const game = withIntent(start('crypt-skulk', { dexterity: 30 }), 'heavy')
    const dodged = choose(game, 'right')
    expect(dodged.player.health).toBe(game.player.health)
    expect(dodged.combat?.turn).toBe(1)
    const cursed = choose(withIntent(game, 'hex'), 'right')
    expect(cursed.player.health).toBeLessThan(game.player.health)
  })

  it('charges a combat turn for drinking a tonic instead of allowing free healing', () => {
    const game = withIntent(start('crypt-skulk', { health: 30 }), 'lunge')
    const healed = gameReducer(game, { type: 'DRINK_POTION' })
    expect(healed.combat?.turn).toBe(1)
    expect(healed.player.potions).toBe(game.player.potions - 1)
    expect(healed.player.health).toBeGreaterThan(game.player.health)
    expect(healed.player.health).toBeLessThan(game.player.health + 24)
  })

  it('does not let a boss be skipped once the fight begins', () => {
    const game = start('hollow-king')
    const rejected = gameReducer(game, { type: 'FLEE' })
    expect(rejected.combat).toEqual(game.combat)
    expect(rejected.floor).toBe(1)
    expect(rejected.roomIndex).toBe(game.roomIndex)
    expect(rejected.journal.at(-1)?.text).toContain('cannot escape')
  })

  it('makes an ordinary retreat costly, without granting combat loot', () => {
    const game = start()
    const fled = gameReducer(game, { type: 'FLEE' })
    expect(fled.combat).toBeNull()
    expect(fled.roomIndex).toBe(game.roomIndex + 1)
    expect(fled.player.health).toBeLessThan(game.player.health)
    expect(fled.player.gold).toBe(game.player.gold)
  })
})

describe('a real grimoire', () => {
  it('spends mana on an ember bolt and leaves a burning foe', () => {
    const game = start('hollow-king')
    const cast = gameReducer(game, { type: 'CAST_SPELL', spell: 'ember-bolt' })
    expect(cast.player.mana).toBe(game.player.mana - 6)
    expect(cast.combat?.health).toBeLessThan(game.combat?.health ?? 0)
    expect(cast.combat?.burnTurns).toBeGreaterThan(0)
    expect(cast.feedback.type).toBe('ember')
    const burned = choose(cast, 'left')
    expect(burned.combat?.health).toBeLessThan(cast.combat?.health ?? 0)
    expect(burned.combat?.burnTurns).toBeLessThan(cast.combat?.burnTurns ?? 0)
  })

  it('uses frost to prevent the next enemy action', () => {
    const game = withIntent(start('hollow-king'), 'heavy')
    const frozen = gameReducer(game, { type: 'CAST_SPELL', spell: 'frost-bind' })
    expect(frozen.player.mana).toBe(game.player.mana - 8)
    expect(frozen.player.health).toBe(game.player.health)
    expect(frozen.combat?.turn).toBe(1)
    expect(frozen.feedback.type).toBe('frost')
  })

  it('puts a depleting arcane shield between the player and the enemy', () => {
    const game = withIntent(start('hollow-king'), 'lunge')
    const warded = gameReducer(game, { type: 'CAST_SPELL', spell: 'arcane-ward' })
    expect(warded.player.mana).toBe(game.player.mana - 5)
    expect(warded.player.health).toBe(game.player.health)
    expect(warded.combat?.ward).toBeGreaterThan(0)
    const next = choose(withIntent(warded, 'heavy'))
    expect(next.combat?.ward).toBeLessThan(warded.combat?.ward ?? 0)
  })

  it('makes mending light restore health but still consume an enemy turn', () => {
    const game = start('hollow-king', { health: 30 })
    const healed = gameReducer(game, { type: 'CAST_SPELL', spell: 'mending-light' })
    expect(healed.player.mana).toBe(game.player.mana - 7)
    expect(healed.player.health).toBeGreaterThan(game.player.health)
    expect(healed.player.health).toBeLessThanOrEqual(game.player.maxHealth)
    expect(healed.combat?.turn).toBe(1)
  })

  it('rejects an unaffordable spell without spending a turn or RNG state', () => {
    const game = start('hollow-king', { mana: 0 })
    const rejected = gameReducer(game, { type: 'CAST_SPELL', spell: 'ember-bolt' })
    expect(rejected.player).toEqual(game.player)
    expect(rejected.combat).toEqual(game.combat)
    expect(rejected.rng).toBe(game.rng)
    expect(rejected.journal.at(-1)?.text).toContain('mana')
  })

  it('does not cast offensive spells with no foe or through a rune puzzle', () => {
    const game = createRun(12345)
    const rejected = gameReducer(game, { type: 'CAST_SPELL', spell: 'storm-lance' })
    expect(rejected.player).toEqual(game.player)
    const puzzle = choose(inRoom('sealed-coffer', { dexterity: 6 }))
    expect(gameReducer(puzzle, { type: 'CAST_SPELL', spell: 'mending-light' })).toBe(puzzle)
  })

  it('refills mana with a real consumable and refuses to waste one at full mana', () => {
    const game = createRun(12345)
    expect(gameReducer(game, { type: 'DRINK_AETHER' }).player).toEqual(game.player)
    const depleted = { ...game, player: { ...game.player, mana: 0 } }
    const restored = gameReducer(depleted, { type: 'DRINK_AETHER' })
    expect(restored.player.mana).toBe(14)
    expect(restored.player.aether).toBe(depleted.player.aether - 1)
  })
})

describe('guardians with a second act', () => {
  it('breaks into a new phase instead of dying to one overpowered hit', () => {
    const game = start('hollow-king', { strength: 100 })
    const hit = choose(game)
    expect(hit.combat?.phase).toBe(2)
    expect(hit.combat?.health).toBeGreaterThan(0)
    expect(hit.combat?.result).toBe('fighting')
    expect(hit.player.gold).toBe(game.player.gold)
    expect(hit.feedback.type).toBe('phase')
  })

  it('awards a defeated foe once and keeps the scene until the player continues', () => {
    let game = start('hollow-king', { strength: 100 })
    for (let turn = 0; turn < 10 && game.combat?.result === 'fighting'; turn += 1) game = choose(game)
    expect(game.combat?.result).toBe('victory')
    expect(game.combat?.health).toBe(0)
    expect(game.floor).toBe(1)
    const gold = game.player.gold
    const replayed = gameReducer(game, { type: 'CAST_SPELL', spell: 'ember-bolt' })
    expect(replayed.player.gold).toBe(gold)
    expect(getChoices(game).find((choice) => choice.direction === 'up')?.label).toBe('Continue')
    const continued = choose(game)
    expect(continued.floor).toBe(2)
    expect(continued.combat).toBeNull()
    expect(continued.player.gold).toBe(gold)
  })
})

describe('things beyond the blade', () => {
  it('starts a conversation, lets the player respond, and cannot farm that response', () => {
    const game = inRoom('lost-pilgrim')
    const talking = choose(game, 'left')
    expect(talking.dialogue).toBe(true)
    expect(talking.roomIndex).toBe(game.roomIndex)
    expect(talking.player).toEqual(game.player)
    const answered = gameReducer(talking, { type: 'RESPOND_NPC', response: 'rumor' })
    expect(answered.dialogue).toBe(false)
    expect(answered.player.wisdom).toBe(game.player.wisdom + 1)
    expect(answered.player.maxMana).toBe(game.player.maxMana + 2)
    expect(answered.roomIndex).toBe(game.roomIndex + 1)
    expect(gameReducer(answered, { type: 'RESPOND_NPC', response: 'rumor' })).toBe(answered)
  })

  it('can leave a conversation without losing the room', () => {
    const game = choose(inRoom('lost-pilgrim'), 'left')
    const closed = gameReducer(game, { type: 'CLOSE_DIALOGUE' })
    expect(closed.dialogue).toBe(false)
    expect(closed.roomIndex).toBe(game.roomIndex)
    expect(closed.player).toEqual(game.player)
  })

  it('stores a mysterious inscription outcome before the choice and prevents rerolling', () => {
    const game = createRun(12345)
    const inspected = gameReducer(game, { type: 'INSPECT_INSCRIPTION' })
    expect(inspected.omen).not.toBeNull()
    expect(inspected.searched).toContain('ashen-gate')
    const claimed = gameReducer(inspected, { type: 'RESOLVE_OMEN', accept: true })
    expect(claimed.omen).toBeNull()
    expect(claimed.player.health).toBeLessThan(game.player.health)
    expect(gameReducer(inspected, { type: 'RESOLVE_OMEN', accept: true })).toEqual(claimed)
    const repeated = gameReducer(claimed, { type: 'INSPECT_INSCRIPTION' })
    expect(repeated.player).toEqual(claimed.player)
    expect(repeated.rng).toBe(claimed.rng)
  })

  it('makes declining an inscription safe without leaving it available to farm', () => {
    const game = createRun(12345)
    const inspected = gameReducer(game, { type: 'INSPECT_INSCRIPTION' })
    const declined = gameReducer(inspected, { type: 'RESOLVE_OMEN', accept: false })
    expect(declined.player).toEqual(game.player)
    expect(declined.searched).toContain('ashen-gate')
    expect(declined.roomIndex).toBe(0)
  })
})
