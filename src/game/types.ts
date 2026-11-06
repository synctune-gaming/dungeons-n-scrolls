import { z } from 'zod'

export const ROOM_IDS = [
  'ashen-gate', 'crypt-skulk', 'bone-sentry', 'lost-pilgrim',
  'sealed-coffer', 'lantern-merchant', 'moon-well', 'hollow-king',
  'cinder-stair', 'cinder-hound', 'forge-guardian', 'forge-smith',
  'ember-coffer', 'ash-merchant', 'ember-shrine', 'cinder-drake',
  'pale-bridge', 'veil-wraith', 'moon-knight', 'star-seer',
  'ivory-coffer', 'veil-merchant', 'star-well', 'pale-warden',
] as const

export type RoomId = typeof ROOM_IDS[number]
export type ClassId = 'wanderer' | 'shade' | 'ironbound'
export type Direction = 'left' | 'up' | 'right'
export type Rune = 'moon' | 'flame' | 'eye'
export type RelicId = 'iron-charm' | 'fleet-feather' | 'ember-stone'
export type RoomKind = 'passage' | 'combat' | 'npc' | 'treasure' | 'shop' | 'shrine' | 'boss'

interface RoomBase {
  id: RoomId
  name: string
  description: string
  zone: 'overworld' | 'dungeon'
}

export type Room = RoomBase & (
  | { kind: 'combat' | 'boss'; enemy: { attack: number; defense: number; gold: number; xp: number } }
  | { kind: Exclude<RoomKind, 'combat' | 'boss'> }
)

export interface Choice {
  direction: Direction
  label: string
  hint: string
  disabled?: boolean
}

const integer = (min: number, max = 1_000_000) => z.number().int().min(min).max(max)

const playerSchema = z.object({
  classId: z.enum(['wanderer', 'shade', 'ironbound']),
  health: integer(0),
  maxHealth: integer(1),
  strength: integer(1, 100),
  dexterity: integer(1, 100),
  wisdom: integer(1, 100),
  gold: integer(0),
  xp: integer(0),
  level: integer(1, 10),
  potions: integer(0, 1000),
  relics: z.array(z.enum(['iron-charm', 'fleet-feather', 'ember-stone'])).max(3),
}).strict()

const gameSchema = z.object({
  seed: integer(0, 4_294_967_295),
  rng: integer(0, 4_294_967_295),
  runNumber: integer(1),
  floor: integer(1, 3),
  roomIndex: integer(0, 7),
  deck: z.array(z.enum(ROOM_IDS)).min(1).max(8),
  status: z.enum(['active', 'dead', 'won']),
  player: playerSchema,
  roomsCleared: integer(0, 24),
  studied: z.boolean(),
  puzzle: z.object({
    combination: z.array(z.enum(['moon', 'flame', 'eye'])).length(3),
    progress: integer(0, 2),
    mistakes: integer(0, 2),
  }).strict().nullable(),
  journal: z.array(z.object({
    id: integer(1),
    text: z.string().min(1).max(500),
    tone: z.enum(['info', 'good', 'danger']),
  }).strict()).min(1).max(30),
}).strict().superRefine((game, context) => {
  const expectedBoss = ['hollow-king', 'cinder-drake', 'pale-warden'][game.floor - 1]
  const regionIds = ROOM_IDS.slice((game.floor - 1) * 8, game.floor * 8)
  const valid = game.roomIndex < game.deck.length
    && game.player.health <= game.player.maxHealth
    && new Set(game.player.relics).size === game.player.relics.length
    && new Set(game.deck).size === game.deck.length
    && game.deck.every((id) => regionIds.includes(id))
    && game.deck.at(-1) === expectedBoss
    && (game.status !== 'active' || game.player.health > 0)
    && (game.status !== 'dead' || game.player.health === 0)
    && (game.status !== 'won' || (game.floor === 3 && game.player.health > 0))
    && (!game.puzzle || (
      game.status === 'active'
      && ['sealed-coffer', 'ember-coffer', 'ivory-coffer'].includes(game.deck[game.roomIndex] ?? '')
      && new Set(game.puzzle.combination).size === 3
    ))
  if (!valid) {
    context.addIssue({ code: 'custom', message: 'The saved run contains inconsistent game state.' })
  }
})

export const savedGameSchema = z.object({
  version: z.literal(1),
  game: gameSchema,
  settings: z.object({ sound: z.boolean(), hints: z.boolean() }).strict(),
  records: z.object({ bestFloor: integer(1, 3), wins: integer(0) }).strict(),
}).strict()

export type Player = z.infer<typeof playerSchema>
export type GameState = z.infer<typeof gameSchema>
export type SavedGame = z.infer<typeof savedGameSchema>
export type Settings = SavedGame['settings']

export type GameAction =
  | { type: 'CHOOSE'; direction: Direction }
  | { type: 'DRINK_POTION' }
  | { type: 'PICK_RUNE'; rune: Rune }
  | { type: 'CLOSE_PUZZLE' }
