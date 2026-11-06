import type { ClassId, Player, RelicId, Room, RoomId } from './types'

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
    enemy: { attack: 11, defense: 6, gold: 10, xp: 7 },
  },
  'bone-sentry': {
    id: 'bone-sentry', kind: 'combat', name: 'Bone sentry', zone: 'dungeon',
    description: 'Its oath outlived its flesh. The sentry lifts a rusted blade and remembers what to do.',
    enemy: { attack: 13, defense: 8, gold: 14, xp: 9 },
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
    enemy: { attack: 24, defense: 13, gold: 45, xp: 18 },
  },
  'cinder-stair': {
    id: 'cinder-stair', kind: 'passage', name: 'Beneath the embers', zone: 'overworld',
    description: 'The woods fall behind you. A stairway descends into the mountain, warm as a living thing.',
  },
  'cinder-hound': {
    id: 'cinder-hound', kind: 'combat', name: 'Cinder hound', zone: 'dungeon',
    description: 'Sparks fall from its jaws. It circles once, then the whole corridor smells of smoke.',
    enemy: { attack: 17, defense: 9, gold: 19, xp: 10 },
  },
  'forge-guardian': {
    id: 'forge-guardian', kind: 'combat', name: 'Forge guardian', zone: 'dungeon',
    description: 'An abandoned suit of armor begins to move. There is no one inside. That is not reassuring.',
    enemy: { attack: 19, defense: 11, gold: 22, xp: 11 },
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
    enemy: { attack: 30, defense: 16, gold: 70, xp: 24 },
  },
  'pale-bridge': {
    id: 'pale-bridge', kind: 'passage', name: 'The pale crossing', zone: 'overworld',
    description: 'A bridge of white stone leads across the mist. On the other side, the last door stands open.',
  },
  'veil-wraith': {
    id: 'veil-wraith', kind: 'combat', name: 'Veil wraith', zone: 'dungeon',
    description: 'A shape pulls itself from the mist. For a moment, it looks almost like someone you knew.',
    enemy: { attack: 22, defense: 13, gold: 25, xp: 12 },
  },
  'moon-knight': {
    id: 'moon-knight', kind: 'combat', name: 'Moon knight', zone: 'dungeon',
    description: 'Silver armor. A silent challenge. The knight bows before raising its sword.',
    enemy: { attack: 24, defense: 15, gold: 29, xp: 13 },
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
    enemy: { attack: 35, defense: 19, gold: 100, xp: 30 },
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
