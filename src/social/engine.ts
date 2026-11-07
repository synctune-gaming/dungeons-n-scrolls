import { gameReducer, giftUnavailable } from '../game/engine'
import type { SavedGame } from '../game/types'
import { ADVENTURERS, GIFTS, REPLIES } from './content'
import { socialActionSchema } from './types'
import type { ChatEntry } from './types'

type SocialResult = { save: SavedGame; error: string | null }

function append(save: SavedGame, entries: ChatEntry[]): SavedGame {
  const all = [...save.social.messages, ...entries]
  const pending = all.filter((entry) => entry.kind === 'received-gift' && !entry.claimed && entry.runNumber === save.game.runNumber)
  const pendingIds = new Set(pending.map((entry) => entry.id))
  const recent = all.filter((entry) => !pendingIds.has(entry.id)).slice(-(240 - pending.length))
  return {
    ...save, social: {
      ...save.social,
      messages: [...recent, ...pending].sort((a, b) => a.id - b.id),
      nextId: save.social.nextId + entries.length,
    },
  }
}

export function socialReducer(save: SavedGame, input: unknown): SocialResult {
  const parsed = socialActionSchema.safeParse(input)
  if (!parsed.success) {
    console.error('The profile or chat action is invalid:', parsed.error.issues)
    return { save, error: parsed.error.issues[0]?.message ?? 'Choose a listed profile option, message, or gift.' }
  }
  const action = parsed.data
  if (action.type === 'CUSTOMIZE') return { save: { ...save, social: { ...save.social, hero: action.profile } }, error: null }
  if (action.type === 'FOLLOW') {
    if (save.social.following.includes(action.adventurerId)) return { save, error: null }
    return { save: { ...save, social: { ...save.social, following: [...save.social.following, action.adventurerId] } }, error: null }
  }
  if (action.type === 'UNFOLLOW') {
    if (!save.social.following.includes(action.adventurerId)) return { save, error: null }
    return { save: { ...save, social: { ...save.social, following: save.social.following.filter((id) => id !== action.adventurerId) } }, error: null }
  }
  if (action.type === 'CLAIM_GIFT') {
    const entry = save.social.messages.find((message) => message.id === action.messageId)
    if (entry?.kind !== 'received-gift') return { save, error: 'This conversation has no such return gift.' }
    if (entry.claimed) return { save, error: 'You already claimed this return gift.' }
    if (entry.runNumber !== save.game.runNumber) return { save, error: 'This gift is from a previous run. Give a new gift for this adventure.' }
    const reason = giftUnavailable(save.game, entry.adventurerId, entry.giftId)
    if (reason) return { save, error: reason }
    const game = gameReducer(save.game, { type: 'RECEIVE_GIFT', adventurerId: entry.adventurerId, giftId: entry.giftId })
    return {
      save: {
        ...save, game,
        social: { ...save.social, messages: save.social.messages.map((message) => message.id === entry.id ? { ...entry, claimed: true } : message) },
      },
      error: null,
    }
  }
  if (save.social.nextId > 999_995) return { save, error: 'This local conversation reached its message limit.' }
  const id = save.social.nextId
  const adventurerId = action.adventurerId
  if (action.type === 'SEND_PRESET') {
    return {
      save: append(save, [
        { id, kind: 'preset', adventurerId, sender: 'hero', presetId: action.presetId },
        { id: id + 1, kind: 'preset', adventurerId, sender: 'adventurer', presetId: REPLIES[action.presetId] },
      ]),
      error: null,
    }
  }
  const gift = GIFTS[action.giftId]
  const old = save.social.boosts[adventurerId]
  const boost = {
    health: Math.min(4, old.health + gift.health),
    mana: Math.min(2, old.mana + gift.mana),
    strength: Math.min(1, old.strength + gift.strength),
  }
  const entries: ChatEntry[] = [{
    id, kind: 'sent-gift', adventurerId, giftId: action.giftId,
    boosted: boost.health !== old.health || boost.mana !== old.mana || boost.strength !== old.strength,
  }]
  const reciprocal = save.game.status === 'active' && save.game.giftReturns.length < 3 && !save.game.giftReturns.includes(adventurerId)
  if (reciprocal) entries.push({
    id: id + 1, kind: 'received-gift', adventurerId, giftId: ADVENTURERS[adventurerId].returnGift,
    runNumber: save.game.runNumber, claimed: false,
  })
  const next = {
    ...save,
    game: reciprocal ? { ...save.game, giftReturns: [...save.game.giftReturns, adventurerId] } : save.game,
    social: { ...save.social, boosts: { ...save.social.boosts, [adventurerId]: boost } },
  }
  return { save: append(next, entries), error: null }
}
