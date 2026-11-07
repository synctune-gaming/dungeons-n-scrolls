import type { ClassId, DialogueResponse, Element, EnemyIntent, Player, RelicId, Room, RoomId, SpellId } from './types'

export const CLASSES: Record<ClassId, {
  name: string
  title: string
  description: string
  stats: Pick<Player, 'maxHealth' | 'strength' | 'dexterity' | 'wisdom'>
}> = {
  wanderer: {
    name: 'Wanderer',
    title: 'A little brave. A little lost.',
    description: 'A balanced adventurer. Reliable in a fight, with just enough curiosity to get into trouble.',
    stats: { maxHealth: 80, strength: 8, dexterity: 6, wisdom: 6 },
  },
  shade: {
    name: 'Shade',
    title: 'The quiet way through.',
    description: 'Slip past enemies and open rune locks without a puzzle. Lighter armor leaves little room for mistakes.',
    stats: { maxHealth: 62, strength: 5, dexterity: 10, wisdom: 7 },
  },
  ironbound: {
    name: 'Ironbound',
    title: 'If it has a lock, hit it.',
    description: 'Heavy armor and a heavy hand. More health, stronger attacks, and fewer talents for delicate locks.',
    stats: { maxHealth: 96, strength: 11, dexterity: 4, wisdom: 4 },
  },
}

export const RELICS: Record<RelicId, { name: string; description: string; effect: string }> = {
  'iron-charm': {
    name: 'Iron charm',
    description: 'Cold iron, warm memories. Someone carried this a long way.',
    effect: '+8 max health. Take 2 less damage in combat.',
  },
  'fleet-feather': {
    name: 'Fleet feather',
    description: 'It never quite touches the bottom of your satchel.',
    effect: '+2 dexterity. Better sneaking and easier locks.',
  },
  'ember-stone': {
    name: 'Ember stone',
    description: 'A small coal that refuses to go out.',
    effect: '+2 strength. Stronger attacks and safer forced locks.',
  },
}

export const REGIONS: {
  floor: number
  name: string
  dungeon: string
  subtitle: string
  boss: RoomId
  rooms: RoomId[]
}[] = [
  {
    floor: 1,
    name: 'The Ashen Woods',
    dungeon: 'The Sunken Keep',
    subtitle: 'An old road. A forgotten kingdom.',
    boss: 'hollow-king',
    rooms: [
      'ashen-gate', 'crypt-skulk', 'bone-sentry', 'lost-pilgrim',
      'sealed-coffer', 'lantern-merchant', 'moon-well', 'hollow-king',
    ],
  },
  {
    floor: 2,
    name: 'The Ember Pass',
    dungeon: 'The Cinderworks',
    subtitle: 'Something still stirs beneath the forge.',
    boss: 'cinder-drake',
    rooms: [
      'cinder-stair', 'cinder-hound', 'forge-guardian', 'forge-smith',
      'ember-coffer', 'ash-merchant', 'ember-shrine', 'cinder-drake',
    ],
  },
  {
    floor: 3,
    name: 'The Pale Crossing',
    dungeon: 'The Pale Sanctum',
    subtitle: 'The last light is not always a friendly one.',
    boss: 'pale-warden',
    rooms: [
      'pale-bridge', 'veil-wraith', 'moon-knight', 'star-seer',
      'ivory-coffer', 'veil-merchant', 'star-well', 'pale-warden',
    ],
  },
]

export function getRegion(floor: number) {
  const region = REGIONS.find((entry) => entry.floor === floor)
  if (!region) throw new Error(`Unknown adventure floor: ${floor}`)
  return region
}

export const ROOMS: Record<RoomId, Room> = {
  'ashen-gate': {
    id: 'ashen-gate', kind: 'passage', name: 'The forgotten gate', zone: 'overworld',
    description: 'The path ends. The adventure doesn\'t. Beyond these walls, the old kingdom is waiting.',
  },
  'crypt-skulk': {
    id: 'crypt-skulk', kind: 'combat', name: 'Crypt skulk', zone: 'dungeon',
    description: 'A scrape of claws. Two hungry eyes. This little creature has no intention of letting you pass.',
    enemy: { health: 28, attack: 11, defense: 6, gold: 10, xp: 7, weakness: 'fire' },
  },
  'bone-sentry': {
    id: 'bone-sentry', kind: 'combat', name: 'Bone sentry', zone: 'dungeon',
    description: 'Its oath outlived its flesh. The sentry lifts a rusted blade and remembers what to do.',
    enemy: { health: 34, attack: 13, defense: 8, gold: 14, xp: 9, weakness: 'arcane' },
  },
  'lost-pilgrim': {
    id: 'lost-pilgrim', kind: 'npc', name: 'A fellow wanderer', zone: 'overworld',
    description: '"You\'re going in there?" The stranger smiles. "Then you might want to hear a story first."',
  },
  'sealed-coffer': {
    id: 'sealed-coffer', kind: 'treasure', name: 'The rune-locked chest', zone: 'dungeon',
    description: 'Three strange symbols. One very tempting lock. Whatever is inside has been waiting for you.',
  },
  'lantern-merchant': {
    id: 'lantern-merchant', kind: 'shop', name: 'The lantern keeper', zone: 'overworld',
    description: '"A tonic for your wounds? A charm for your luck? Everything has a price, friend."',
  },
  'moon-well': {
    id: 'moon-well', kind: 'shrine', name: 'A moment of stillness', zone: 'dungeon',
    description: 'Moonlight pools in the broken stone. For once, nothing here is trying to kill you.',
  },
  'hollow-king': {
    id: 'hollow-king', kind: 'boss', name: 'The Hollow King', zone: 'dungeon',
    description: 'A crown of thorns. A throne of bones. The king has been expecting a visitor.',
    enemy: { health: 66, attack: 24, defense: 13, gold: 45, xp: 18, weakness: 'frost' },
  },
  'cinder-stair': {
    id: 'cinder-stair', kind: 'passage', name: 'Beneath the embers', zone: 'overworld',
    description: 'The woods fall behind you. A stairway descends into the mountain, warm as a living thing.',
  },
  'cinder-hound': {
    id: 'cinder-hound', kind: 'combat', name: 'Cinder hound', zone: 'dungeon',
    description: 'Sparks fall from its jaws. It circles once, then the whole corridor smells of smoke.',
    enemy: { health: 38, attack: 17, defense: 9, gold: 19, xp: 10, weakness: 'frost' },
  },
  'forge-guardian': {
    id: 'forge-guardian', kind: 'combat', name: 'Forge guardian', zone: 'dungeon',
    description: 'An abandoned suit of armor begins to move. There is no one inside. That is not reassuring.',
    enemy: { health: 42, attack: 19, defense: 11, gold: 22, xp: 11, weakness: 'frost' },
  },
  'forge-smith': {
    id: 'forge-smith', kind: 'npc', name: 'The last smith', zone: 'overworld',
    description: '"The forge isn\'t dead," she says, turning a blackened coin. "It\'s just dreaming."',
  },
  'ember-coffer': {
    id: 'ember-coffer', kind: 'treasure', name: 'A coal-black coffer', zone: 'dungeon',
    description: 'Something golden glows between the seams. The runes are almost too hot to touch.',
  },
  'ash-merchant': {
    id: 'ash-merchant', kind: 'shop', name: 'A shop in the ashes', zone: 'overworld',
    description: 'Even at the edge of a burning mountain, someone has found a way to sell you a tonic.',
  },
  'ember-shrine': {
    id: 'ember-shrine', kind: 'shrine', name: 'The sleeping flame', zone: 'dungeon',
    description: 'A single flame hangs above the well. It gives off light, but no heat.',
  },
  'cinder-drake': {
    id: 'cinder-drake', kind: 'boss', name: 'The Cinder Drake', zone: 'dungeon',
    description: 'The mountain takes a breath. Two wings unfold in the dark. Now you know what kept the forge warm.',
    enemy: { health: 84, attack: 30, defense: 16, gold: 70, xp: 24, weakness: 'frost' },
  },
  'pale-bridge': {
    id: 'pale-bridge', kind: 'passage', name: 'The pale crossing', zone: 'overworld',
    description: 'A bridge of white stone leads across the mist. On the other side, the last door stands open.',
  },
  'veil-wraith': {
    id: 'veil-wraith', kind: 'combat', name: 'Veil wraith', zone: 'dungeon',
    description: 'A shape pulls itself from the mist. For a moment, it looks almost like someone you knew.',
    enemy: { health: 44, attack: 22, defense: 13, gold: 25, xp: 12, weakness: 'fire' },
  },
  'moon-knight': {
    id: 'moon-knight', kind: 'combat', name: 'Moon knight', zone: 'dungeon',
    description: 'Silver armor. A silent challenge. The knight bows before raising its sword.',
    enemy: { health: 48, attack: 24, defense: 15, gold: 29, xp: 13, weakness: 'arcane' },
  },
  'star-seer': {
    id: 'star-seer', kind: 'npc', name: 'The star reader', zone: 'overworld',
    description: '"I saw you in a dream," the old woman says. "I couldn\'t quite see how it ended."',
  },
  'ivory-coffer': {
    id: 'ivory-coffer', kind: 'treasure', name: 'The ivory chest', zone: 'dungeon',
    description: 'A beautiful thing in a terrible place. Its three runes shine with borrowed starlight.',
  },
  'veil-merchant': {
    id: 'veil-merchant', kind: 'shop', name: 'The midnight market', zone: 'overworld',
    description: '"Last stop before the sanctum. Spend your gold. You can\'t take it with you."',
  },
  'star-well': {
    id: 'star-well', kind: 'shrine', name: 'The wishing well', zone: 'dungeon',
    description: 'The stars are reflected in the water, though there is no sky above you.',
  },
  'pale-warden': {
    id: 'pale-warden', kind: 'boss', name: 'The Pale Warden', zone: 'dungeon',
    description: 'At the end of every road, someone keeps the gate. This one has never let anyone leave.',
    enemy: { health: 100, attack: 35, defense: 19, gold: 100, xp: 30, weakness: 'fire' },
  },
}

export const ROOM_LABELS: Record<Room['kind'], string> = {
  passage: 'Uncharted path',
  combat: 'Enemy encounter',
  npc: 'A chance meeting',
  treasure: 'Hidden treasure',
  shop: 'Wandering shop',
  shrine: 'Safe haven',
  boss: 'Boss encounter',
}

export const SPELLS: Record<SpellId, {
  name: string
  shortName: string
  cost: number
  element: Element | null
  description: string
}> = {
  'ember-bolt': { name: 'Ember bolt', shortName: 'Ember', cost: 6, element: 'fire', description: 'A bolt of hungry flame. Deals fire damage and burns for two more turns.' },
  'frost-bind': { name: 'Frost bind', shortName: 'Frost', cost: 8, element: 'frost', description: 'Ice closes around your foe. Deals frost damage and freezes two enemy actions.' },
  'storm-lance': { name: 'Storm lance', shortName: 'Storm', cost: 8, element: 'arcane', description: 'A spear of lightning. Heavy arcane damage that passes through a raised guard.' },
  'arcane-ward': { name: 'Arcane ward', shortName: 'Ward', cost: 5, element: null, description: 'Weave a shield of light. It absorbs incoming damage until its strength runs out.' },
  'mending-light': { name: 'Mending light', shortName: 'Mend', cost: 7, element: null, description: 'Trade a little magic for another chance. Restores health, but enemies still get their turn.' },
}

export const INTENTS: Record<EnemyIntent, { name: string; description: string; hint: string }> = {
  lunge: { name: 'Quick lunge', description: 'It lowers its shoulder. A quick strike is coming.', hint: 'Guard to soften the blow, or dodge.' },
  heavy: { name: 'Crushing blow', description: 'The weapon rises. This one will hurt.', hint: 'Dodge, freeze it, or put up a ward.' },
  hex: { name: 'Hollow curse', description: 'A dark sigil gathers between its hands.', hint: 'Curses cannot be dodged. Guard or ward.' },
  brace: { name: 'Raised guard', description: 'It braces behind its armor. Steel will struggle.', hint: 'Spells pass through its guard.' },
  recover: { name: 'An opening', description: 'It falters. For one breath, you have the upper hand.', hint: 'A good moment to strike, mend, or recover mana.' },
}

interface BossPattern {
  phases: readonly [string, string]
  patterns: readonly [readonly EnemyIntent[], readonly EnemyIntent[]]
  transition: string
}

const BOSS_PATTERNS: Partial<Record<RoomId, BossPattern>> = {
  'hollow-king': { phases: ['Thronebound', 'Uncrowned'], patterns: [['lunge', 'brace', 'heavy'], ['heavy', 'hex', 'lunge', 'recover']], transition: 'The crown shatters. The Hollow King rises, no longer bound to his throne.' },
  'cinder-drake': { phases: ['Sleeping ember', 'Wildfire'], patterns: [['lunge', 'heavy', 'brace'], ['hex', 'heavy', 'lunge', 'recover']], transition: 'Its wings ignite. The Cinder Drake tears free of the forge.' },
  'pale-warden': { phases: ['Gatekeeper', 'Unbound'], patterns: [['brace', 'hex', 'lunge'], ['heavy', 'hex', 'recover', 'lunge']], transition: 'The mask breaks. Something ancient looks out through the Pale Warden.' },
}

export function getBossPattern(id: RoomId) {
  const pattern = BOSS_PATTERNS[id]
  if (!pattern) throw new Error(`No boss pattern exists for ${id}.`)
  return pattern
}

export function getEnemyPattern(room: Room, phase: 1 | 2): readonly EnemyIntent[] {
  if (room.kind === 'boss') return getBossPattern(room.id).patterns[phase === 1 ? 0 : 1]
  if (room.kind !== 'combat') throw new Error('This room has no enemy intentions.')
  if (room.enemy.weakness === 'arcane') return ['brace', 'lunge', 'hex', 'recover']
  if (room.enemy.weakness === 'frost') return ['lunge', 'heavy', 'brace']
  return ['lunge', 'heavy', 'recover']
}

interface Dialogue {
  opening: string
  clue: string
  responses: Record<DialogueResponse, { label: string; hint: string }>
}

const responses: Dialogue['responses'] = {
  rumor: { label: 'Ask what lies ahead', hint: '+1 wisdom. A clue, not a map.' },
  rest: { label: 'Share the fire', hint: 'Restore health and 8 mana.' },
  trade: { label: 'Ask for supplies', hint: 'A healing tonic for 20 gold.' },
}

const DIALOGUES: Partial<Record<RoomId, Dialogue>> = {
  'lost-pilgrim': { opening: '"I heard a crown fall, once. It made no sound." The wanderer holds out a hand to the fire. "Sit a moment. The road will still be there."', clue: 'The wanderer whispers: "Cold hands can break an old crown. But mind what wakes beneath it." Your wisdom grows.', responses },
  'forge-smith': { opening: '"Steel remembers the heat that shaped it." The smith looks toward the mountain. "Sometimes it remembers too much. What would you know?"', clue: 'The smith says: "When the wings catch fire, bind them with frost. The forge has a second heartbeat." Your wisdom grows.', responses },
  'star-seer': { opening: '"The stars did not show me your ending." The old woman turns a card face down. "Perhaps that means you still get to choose."', clue: 'The seer murmurs: "A pale mask hides a darker face. Take a little fire to the last gate." Your wisdom grows.', responses },
}

export function getDialogue(id: RoomId) {
  const dialogue = DIALOGUES[id]
  if (!dialogue) throw new Error(`No conversation exists for ${id}.`)
  return dialogue
}
