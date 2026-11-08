import type { ClassId, RelicId, RoomId } from '../game/types'
import { ADVENTURER_IDS } from './types'
import type { AdventurerId, Appearance, GiftId, MessageId, PresetId, SocialState } from './types'

export const GIFTS: Record<GiftId, { name: string; effect: string; health: number; mana: number; strength: number }> = {
  'trail-ration': { name: 'Trail ration', effect: 'Restore up to 4 health', health: 4, mana: 0, strength: 0 },
  'aether-spark': { name: 'Aether spark', effect: 'Restore up to 2 mana', health: 0, mana: 2, strength: 0 },
  'lucky-charm': { name: 'Lucky charm', effect: '+1 strength for this run', health: 0, mana: 0, strength: 1 },
}

export const MESSAGES: Record<MessageId, string> = {
  greet: 'Safe travels, adventurer.',
  'good-luck': 'May your lantern stay bright.',
  'well-fought': 'That was a fight worth remembering.',
  thanks: 'Thank you for the help.',
  'greet-reply': 'A friendly face makes a long road shorter.',
  'good-luck-reply': 'And may yours lead you home.',
  'well-fought-reply': 'A little patience. A little courage.',
  'thanks-reply': 'Save a little kindness for the next wanderer.',
}
export const REPLIES: Record<PresetId, MessageId> = {
  greet: 'greet-reply', 'good-luck': 'good-luck-reply', 'well-fought': 'well-fought-reply', thanks: 'thanks-reply',
}

export interface Story {
  title: string
  text: string
  roomId: RoomId
  floor: number
  known?: boolean
}

export interface Adventurer {
  id: AdventurerId
  name: string
  classId: ClassId
  appearance: Appearance
  description: string
  home: string
  level: number
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  strength: number
  dexterity: number
  wisdom: number
  relics: RelicId[]
  returnGift: GiftId
  stories: Story[]
}

export const ADVENTURERS: Record<AdventurerId, Adventurer> = {
  mosskeeper: {
    id: 'mosskeeper', name: 'Mosskeeper', classId: 'wanderer', appearance: { style: 'hood', palette: 'sage' },
    description: 'Collects old maps and shares the last of the trail bread.', home: 'Mossmere',
    level: 3, health: 58, maxHealth: 92, mana: 14, maxMana: 32, strength: 10, dexterity: 7, wisdom: 8,
    relics: ['fleet-feather'], returnGift: 'trail-ration',
    stories: [
      { title: 'The road through the roots', text: 'A broken sign pointed nowhere. The moss pointed toward a town.', roomId: 'moss-trail', floor: 1 },
      { title: 'Company by the fire', text: 'A stranger traded a story for half a loaf. Neither of us left hungry.', roomId: 'lost-pilgrim', floor: 1 },
      { title: 'A quiet discovery', text: 'Under the old stones, moonlight was still waiting. I filled my flask and carried on.', roomId: 'moon-well', floor: 1 },
    ],
  },
  emberfox: {
    id: 'emberfox', name: 'Ember Fox', classId: 'shade', appearance: { style: 'braids', palette: 'ember' },
    description: 'Finds a quiet way past anything that would rather fight.', home: 'Cinderhaven',
    level: 4, health: 46, maxHealth: 80, mana: 18, maxMana: 38, strength: 8, dexterity: 13, wisdom: 9,
    relics: ['ember-stone'], returnGift: 'aether-spark',
    stories: [
      { title: 'Footsteps in the ash', text: 'The pass was warm beneath my boots. Somewhere ahead, a forge still rang.', roomId: 'ash-trail', floor: 2 },
      { title: 'Not every foe needs a blade', text: 'A shape guarded the road. I watched its footsteps, then chose a different path.', roomId: 'cinder-hound', floor: 2, known: false },
      { title: 'A borrowed spark', text: 'The smith gave me a coal that would not go out. Enough light for one more mile.', roomId: 'forge-smith', floor: 2 },
    ],
  },
  starling: {
    id: 'starling', name: 'Starling Vale', classId: 'wanderer', appearance: { style: 'braids', palette: 'aether' },
    description: 'Reads the night sky like a map, occasionally upside down.', home: 'Starlight Quay',
    level: 5, health: 64, maxHealth: 104, mana: 22, maxMana: 42, strength: 12, dexterity: 8, wisdom: 12,
    relics: ['iron-charm'], returnGift: 'lucky-charm',
    stories: [
      { title: 'Beyond the white bridge', text: 'The mist lifted for a moment. There was a road on the other side after all.', roomId: 'pale-bridge', floor: 3 },
      { title: 'A question for the stars', text: 'The reader offered no ending, only a place to sit. Sometimes that is enough.', roomId: 'star-seer', floor: 3 },
      { title: 'The longest way home', text: 'We lit the camp before the stars appeared. One small flame, shared by everyone.', roomId: 'star-camp', floor: 3 },
    ],
  },
  stoneward: {
    id: 'stoneward', name: 'Stoneward', classId: 'ironbound', appearance: { style: 'helm', palette: 'sage' },
    description: 'Carries the heavy pack so the rest of the party can breathe.', home: 'Mossmere',
    level: 2, health: 72, maxHealth: 110, mana: 10, maxMana: 26, strength: 13, dexterity: 5, wisdom: 5,
    relics: ['iron-charm'], returnGift: 'trail-ration',
    stories: [
      { title: 'An oath at the gate', text: 'The old walls have stood longer than any of us. I stopped to listen.', roomId: 'ashen-gate', floor: 1 },
      { title: 'Hold, then strike', text: 'The creature raised its weapon. I raised my guard. A longer fight, but a safer one.', roomId: 'grave-brute', floor: 1, known: false },
      { title: 'Room for another lantern', text: 'We made camp with the road at our backs. Nobody had to keep watch alone.', roomId: 'moss-camp', floor: 1 },
    ],
  },
  reedshade: {
    id: 'reedshade', name: 'Reedshade', classId: 'shade', appearance: { style: 'hood', palette: 'aether' },
    description: 'Leaves a feather at every crossroads and never explains why.', home: 'Mossmere',
    level: 2, health: 38, maxHealth: 68, mana: 15, maxMana: 32, strength: 6, dexterity: 11, wisdom: 8,
    relics: ['fleet-feather'], returnGift: 'aether-spark',
    stories: [
      { title: 'A trail almost forgotten', text: 'No footsteps, no signposts. Just a ribbon of green between the stones.', roomId: 'moss-trail', floor: 1 },
      { title: 'Three little symbols', text: 'The lock was patient. So was I. Moon, flame, eye, and a click in the dark.', roomId: 'sealed-coffer', floor: 1 },
      { title: 'A little light to spare', text: 'The lantern keeper had a vial left. I saved it for the road ahead.', roomId: 'lantern-merchant', floor: 1 },
    ],
  },
  'lantern-rook': {
    id: 'lantern-rook', name: 'Lantern Rook', classId: 'ironbound', appearance: { style: 'helm', palette: 'ember' },
    description: 'Keeps a lantern burning for anyone who loses their way.', home: 'Cinderhaven',
    level: 3, health: 80, maxHealth: 116, mana: 12, maxMana: 30, strength: 14, dexterity: 5, wisdom: 7,
    relics: ['ember-stone'], returnGift: 'lucky-charm',
    stories: [
      { title: 'Down the warm stair', text: 'The mountain hummed through the soles of my boots. I answered with a song.', roomId: 'cinder-stair', floor: 2 },
      { title: 'A coal for the road', text: 'I stopped at the market for supplies. The keeper threw in a story for free.', roomId: 'ash-merchant', floor: 2 },
      { title: 'Until the fire settles', text: 'For one night, the sparks were only sparks. We watched them rise and rested.', roomId: 'ember-camp', floor: 2 },
    ],
  },
}

export function orderedAdventurers(social: SocialState): Adventurer[] {
  return ADVENTURER_IDS.map((id) => ADVENTURERS[id]).sort((a, b) =>
    Number(social.following.includes(b.id)) - Number(social.following.includes(a.id)))
}

export function boostedAdventurer(id: AdventurerId, social: SocialState): Adventurer {
  const adventurer = ADVENTURERS[id]
  const boost = social.boosts[id]
  return {
    ...adventurer,
    health: Math.min(adventurer.maxHealth, adventurer.health + boost.health),
    mana: Math.min(adventurer.maxMana, adventurer.mana + boost.mana),
    strength: adventurer.strength + boost.strength,
  }
}
