import { describe, expect, it } from 'vitest'
import { createRun, gameReducer } from '../game/engine'
import { loadSave, writeSave } from '../game/persistence'
import { savedGameSchema } from '../game/types'
import type { SavedGame } from '../game/types'
import { ADVENTURERS, orderedAdventurers } from './content'
import { socialReducer } from './engine'
import { createSocialState, socialStateSchema } from './types'

function makeSave(): SavedGame {
  const game = createRun(12345)
  return {
    version: 3, game: { ...game, player: { ...game.player, health: 50, mana: 10 } },
    social: createSocialState(),
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  }
}

describe('local profiles and following', () => {
  it('trims personalization without changing class, stats, route, or RNG', () => {
    const before = makeSave()
    const result = socialReducer(before, {
      type: 'CUSTOMIZE',
      profile: { name: '  Moss Runner  ', appearance: { style: 'helm', palette: 'aether' } },
    })
    expect(result.error).toBeNull()
    expect(result.save.social.hero.name).toBe('Moss Runner')
    expect(result.save.social.hero.appearance).toEqual({ style: 'helm', palette: 'aether' })
    expect(result.save.game).toEqual(before.game)
    expect(socialReducer(before, { type: 'CUSTOMIZE', profile: { ...before.social.hero, name: '   ' } }).error).toBeTruthy()
    expect(socialReducer(before, { type: 'CUSTOMIZE', profile: { ...before.social.hero, name: 'x'.repeat(33) } }).error).toBeTruthy()
  })

  it('follows idempotently, prioritizes those stories, and unfollows', () => {
    const before = makeSave()
    const followed = socialReducer(before, { type: 'FOLLOW', adventurerId: 'starling' }).save
    expect(followed.social.following).toEqual(['starling'])
    expect(socialReducer(followed, { type: 'FOLLOW', adventurerId: 'starling' }).save).toBe(followed)
    expect(orderedAdventurers(followed.social)[0]?.id).toBe('starling')
    const unfollowed = socialReducer(followed, { type: 'UNFOLLOW', adventurerId: 'starling' }).save
    expect(unfollowed.social.following).toEqual([])
    expect(unfollowed.game).toEqual(before.game)
  })

  it('validates fictional IDs and rejects duplicate or invented social data', () => {
    const state = createSocialState()
    expect(socialStateSchema.safeParse({ ...state, following: ['mosskeeper', 'mosskeeper'] }).success).toBe(false)
    expect(socialStateSchema.safeParse({ ...state, following: ['real-account'] }).success).toBe(false)
    expect(socialReducer(makeSave(), { type: 'FOLLOW', adventurerId: 'real-account' }).error).toBeTruthy()
  })
})

describe('predefined messages and free useful gifts', () => {
  it('keeps the recipient correct and rejects editable text, notes, and invented presets', () => {
    const before = makeSave()
    const sent = socialReducer(before, { type: 'SEND_PRESET', adventurerId: 'emberfox', presetId: 'good-luck' }).save
    expect(sent.social.messages).toHaveLength(2)
    expect(sent.social.messages.every((entry) => entry.adventurerId === 'emberfox')).toBe(true)
    expect(sent.social.messages[0]).toMatchObject({ kind: 'preset', sender: 'hero', presetId: 'good-luck' })
    expect(sent.game).toEqual(before.game)
    for (const action of [
      { type: 'SEND_PRESET', adventurerId: 'emberfox', presetId: 'good-luck', text: 'custom message' },
      { type: 'SEND_PRESET', adventurerId: 'emberfox', presetId: 'invented' },
      { type: 'GIVE_GIFT', adventurerId: 'emberfox', giftId: 'trail-ration', note: 'custom note' },
    ]) {
      const rejected = socialReducer(before, action)
      expect(rejected.error).toBeTruthy()
      expect(rejected.save).toBe(before)
    }
  })

  it('boosts the fictional recipient for free and queues only one return per adventurer per run', () => {
    const before = makeSave()
    const given = socialReducer(before, { type: 'GIVE_GIFT', adventurerId: 'mosskeeper', giftId: 'trail-ration' }).save
    expect(given.social.boosts.mosskeeper.health).toBe(4)
    expect(given.game.player).toEqual(before.game.player)
    expect(given.game.rng).toBe(before.game.rng)
    expect(given.game.deck).toEqual(before.game.deck)
    expect(given.social.messages.filter((entry) => entry.kind === 'received-gift')).toHaveLength(1)
    const repeated = socialReducer(given, { type: 'GIVE_GIFT', adventurerId: 'mosskeeper', giftId: 'trail-ration' }).save
    expect(repeated.social.boosts.mosskeeper.health).toBe(4)
    expect(repeated.social.messages.filter((entry) => entry.kind === 'received-gift')).toHaveLength(1)
    expect(repeated.game.player).toEqual(before.game.player)
  })

  it('applies the exact small effects atomically and permits at most three claims per run', () => {
    const before = makeSave()
    let save = before
    for (const adventurerId of ['mosskeeper', 'emberfox', 'starling'] as const) {
      save = socialReducer(save, { type: 'GIVE_GIFT', adventurerId, giftId: 'lucky-charm' }).save
    }
    const fourth = socialReducer(save, { type: 'GIVE_GIFT', adventurerId: 'stoneward', giftId: 'lucky-charm' }).save
    expect(fourth.social.messages.filter((entry) => entry.kind === 'received-gift')).toHaveLength(3)
    const incoming = save.social.messages.filter((entry) => entry.kind === 'received-gift')
    expect(incoming.map((entry) => entry.giftId)).toEqual([
      ADVENTURERS.mosskeeper.returnGift, ADVENTURERS.emberfox.returnGift, ADVENTURERS.starling.returnGift,
    ])
    for (const entry of incoming) {
      const result = socialReducer(save, { type: 'CLAIM_GIFT', messageId: entry.id })
      expect(result.error).toBeNull()
      save = result.save
      expect(save.social.messages.find((message) => message.id === entry.id)).toMatchObject({ claimed: true })
      expect(socialReducer(save, { type: 'CLAIM_GIFT', messageId: entry.id }).error).toBeTruthy()
    }
    expect(save.game.player.health).toBe(before.game.player.health + 4)
    expect(save.game.player.mana).toBe(before.game.player.mana + 2)
    expect(save.game.player.strength).toBe(before.game.player.strength + 1)
    expect(save.game.giftClaims).toHaveLength(3)
    expect(save.game.rng).toBe(before.game.rng)
    expect(save.game.roomIndex).toBe(before.game.roomIndex)
    expect(savedGameSchema.safeParse(save).success).toBe(true)
  })

  it('does not consume gifts at full resources, in battle, or in a different run', () => {
    const before = makeSave()
    const given = socialReducer(before, { type: 'GIVE_GIFT', adventurerId: 'mosskeeper', giftId: 'trail-ration' }).save
    const gift = given.social.messages.find((entry) => entry.kind === 'received-gift')
    if (!gift) throw new Error('The fictional return gift is missing.')
    const full = { ...given, game: { ...given.game, player: { ...given.game.player, health: given.game.player.maxHealth } } }
    const rejected = socialReducer(full, { type: 'CLAIM_GIFT', messageId: gift.id })
    expect(rejected.error).toContain('full health')
    expect(rejected.save.social.messages.find((entry) => entry.id === gift.id)).toMatchObject({ claimed: false })
    const index = given.game.deck.indexOf('crypt-skulk')
    const fighting = gameReducer({ ...given.game, roomIndex: index }, { type: 'CHOOSE', direction: 'up' })
    expect(socialReducer({ ...given, game: fighting }, { type: 'CLAIM_GIFT', messageId: gift.id }).error).toContain('fight')
    const restarted = { ...given, game: createRun(456, 'shade', given.game.runNumber + 1) }
    const expired = socialReducer(restarted, { type: 'CLAIM_GIFT', messageId: gift.id })
    expect(expired.error).toContain('previous run')
    expect(expired.save.game.player).toEqual(restarted.game.player)
    expect(restarted.social).toEqual(given.social)
  })

  it('retains a pending return while bounding a long preset conversation', () => {
    let save = socialReducer(makeSave(), { type: 'GIVE_GIFT', adventurerId: 'mosskeeper', giftId: 'trail-ration' }).save
    for (let index = 0; index < 150; index += 1) {
      save = socialReducer(save, { type: 'SEND_PRESET', adventurerId: 'emberfox', presetId: 'greet' }).save
    }
    expect(save.social.messages.length).toBeLessThanOrEqual(240)
    expect(save.social.messages.some((entry) => entry.kind === 'received-gift' && !entry.claimed)).toBe(true)
    expect(savedGameSchema.safeParse(save).success).toBe(true)
  })

  it('round-trips profile, follows, conversations, receipts, and gameplay boosts', () => {
    let save = socialReducer(makeSave(), { type: 'FOLLOW', adventurerId: 'mosskeeper' }).save
    save = socialReducer(save, { type: 'GIVE_GIFT', adventurerId: 'starling', giftId: 'lucky-charm' }).save
    const gift = save.social.messages.find((entry) => entry.kind === 'received-gift')
    if (!gift) throw new Error('No simulated incoming gift.')
    save = socialReducer(save, { type: 'CLAIM_GIFT', messageId: gift.id }).save
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    expect(writeSave(save, storage)).toBeNull()
    expect(loadSave(storage)).toEqual({ save, error: null })
  })
})
