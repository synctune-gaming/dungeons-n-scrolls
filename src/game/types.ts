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
export const CLASS_IDS = ['wanderer', 'shade', 'ironbound'] as const
export const RELIC_IDS = ['iron-charm', 'fleet-feather', 'ember-stone'] as const
export type ClassId = typeof CLASS_IDS[number]
export type Direction = 'left' | 'up' | 'right'
export type Rune = 'moon' | 'flame' | 'eye'
export type RelicId = typeof RELIC_IDS[number]
export type RoomKind = 'passage' | 'combat' | 'npc' | 'treasure' | 'shop' | 'shrine' | 'boss'
export const SPELL_IDS = ['ember-bolt', 'frost-bind', 'storm-lance', 'arcane-ward', 'mending-light'] as const
export const INTENT_IDS = ['lunge', 'heavy', 'hex', 'brace', 'recover'] as const
export const EFFECT_IDS = ['travel', 'reveal', 'strike', 'guard', 'dodge', 'ember', 'frost', 'storm', 'ward', 'heal', 'phase', 'victory', 'secret', 'info'] as const
export type SpellId = typeof SPELL_IDS[number]
export type EnemyIntent = typeof INTENT_IDS[number]
export type EffectType = typeof EFFECT_IDS[number]
export type Element = 'fire' | 'frost' | 'arcane'
export type DialogueResponse = 'rumor' | 'rest' | 'trade'

export const BATTLE_ROOM_IDS = [
  'crypt-skulk', 'bone-sentry', 'hollow-king', 'cinder-hound', 'forge-guardian',
  'cinder-drake', 'veil-wraith', 'moon-knight', 'pale-warden',
] as const
export type BattleRoomId = typeof BATTLE_ROOM_IDS[number]
export const INSCRIPTION_ROOM_IDS = [
  'ashen-gate', 'sealed-coffer', 'moon-well', 'cinder-stair', 'ember-coffer',
  'ember-shrine', 'pale-bridge', 'ivory-coffer', 'star-well',
] as const

interface RoomBase {
  id: RoomId
  name: string
  description: string
  zone: 'overworld' | 'dungeon'
}

export type Room = RoomBase & (
  | { id: BattleRoomId; kind: 'combat' | 'boss'; enemy: { health: number; attack: number; defense: number; gold: number; xp: number; weakness: Element } }
  | { kind: Exclude<RoomKind, 'combat' | 'boss'> }
)

export interface Choice {
  direction: Direction
  label: string
  hint: string
  disabled?: boolean
}

const integer = (min: number, max = 1_000_000) => z.number().int().min(min).max(max)

const legacyPlayerSchema = z.object({
  classId: z.enum(CLASS_IDS),
  health: integer(0),
  maxHealth: integer(1),
  strength: integer(1, 100),
  dexterity: integer(1, 100),
  wisdom: integer(1, 100),
  gold: integer(0),
  xp: integer(0),
  level: integer(1, 10),
  potions: integer(0, 1000),
  relics: z.array(z.enum(RELIC_IDS)).max(3),
}).strict()

const playerSchema = legacyPlayerSchema.extend({
  mana: integer(0),
  maxMana: integer(1),
  aether: integer(0, 1000),
}).strict()

const baseGameSchema = z.object({
  seed: integer(0, 4_294_967_295),
  rng: integer(0, 4_294_967_295),
  runNumber: integer(1),
  floor: integer(1, 3),
  roomIndex: integer(0, 7),
  deck: z.array(z.enum(ROOM_IDS)).min(1).max(8),
  status: z.enum(['active', 'dead', 'won']),
  player: legacyPlayerSchema,
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
}).strict()

function validateCommon(game: z.infer<typeof baseGameSchema>, context: z.RefinementCtx) {
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
}

const legacyGameSchema = baseGameSchema.superRefine(validateCommon)

const combatSchema = z.object({
  roomId: z.enum(BATTLE_ROOM_IDS),
  health: integer(0),
  maxHealth: integer(1),
  turn: integer(0),
  phase: z.union([z.literal(1), z.literal(2)]),
  intent: z.enum(INTENT_IDS),
  intentIndex: integer(0, 3),
  result: z.enum(['fighting', 'victory']),
  burnTurns: integer(0, 2),
  frozenTurns: integer(0, 2),
  ward: integer(0, 1000),
  opening: integer(0, 30),
}).strict()

const feedbackSchema = z.object({
  id: integer(0),
  type: z.enum(EFFECT_IDS),
  actionType: z.enum(EFFECT_IDS).default('info'),
  enemyDamage: integer(0),
  playerDamage: integer(0),
  healing: integer(0),
  text: z.string().max(500),
}).strict()

const gameSchema = baseGameSchema.extend({
  player: playerSchema,
  discovered: z.array(z.enum(ROOM_IDS)).max(24),
  searched: z.array(z.enum(INSCRIPTION_ROOM_IDS)).max(9),
  combat: combatSchema.nullable(),
  dialogue: z.boolean(),
  omen: z.object({
    roomId: z.enum(INSCRIPTION_ROOM_IDS),
    outcome: integer(0, 2),
  }).strict().nullable(),
  feedback: feedbackSchema,
}).strict().superRefine((game, context) => {
  validateCommon(game, context)
  const id = game.deck[game.roomIndex]
  const allowed = ROOM_IDS.slice(0, game.floor * 8)
  const interactions = Number(Boolean(game.puzzle)) + Number(Boolean(game.combat))
    + Number(game.dialogue) + Number(Boolean(game.omen))
  const valid = game.player.mana <= game.player.maxMana
    && new Set(game.discovered).size === game.discovered.length
    && new Set(game.searched).size === game.searched.length
    && game.discovered.every((roomId) => allowed.includes(roomId))
    && game.searched.every((roomId) => allowed.includes(roomId))
    && interactions <= 1
    && (game.status === 'active' || interactions === 0)
    && (!game.dialogue || ['lost-pilgrim', 'forge-smith', 'star-seer'].includes(id ?? ''))
    && (!game.omen || (game.omen.roomId === id && game.searched.includes(game.omen.roomId)))
    && (!game.combat || (
      game.combat.roomId === id
      && game.discovered.includes(game.combat.roomId)
      && game.combat.health <= game.combat.maxHealth
      && (game.combat.result === 'victory' ? game.combat.health === 0 : game.combat.health > 0)
      && (game.combat.phase === 1 || ['hollow-king', 'cinder-drake', 'pale-warden'].includes(game.combat.roomId))
      && (!['hollow-king', 'cinder-drake', 'pale-warden'].includes(game.combat.roomId)
        || game.combat.phase === 2 || game.combat.health > Math.ceil(game.combat.maxHealth / 2))
    ))
  if (!valid) {
    context.addIssue({ code: 'custom', message: 'The saved encounter or resource state is inconsistent.' })
  }
})

const savedFields = {
  settings: z.object({ sound: z.boolean(), hints: z.boolean() }).strict(),
  records: z.object({ bestFloor: integer(1, 3), wins: integer(0) }).strict(),
}

export const legacySavedGameSchema = z.object({
  version: z.literal(1),
  game: legacyGameSchema,
  ...savedFields,
}).strict()

export const savedGameSchema = z.object({
  version: z.literal(2),
  game: gameSchema,
  ...savedFields,
}).strict()

export type Player = z.infer<typeof playerSchema>
export type GameState = z.infer<typeof gameSchema>
export type Combat = z.infer<typeof combatSchema>
export type Feedback = z.infer<typeof feedbackSchema>
export type SavedGame = z.infer<typeof savedGameSchema>
export type LegacySavedGame = z.infer<typeof legacySavedGameSchema>
export type Settings = SavedGame['settings']

export type GameAction =
  | { type: 'CHOOSE'; direction: Direction }
  | { type: 'DRINK_POTION' }
  | { type: 'PICK_RUNE'; rune: Rune }
  | { type: 'CLOSE_PUZZLE' }
  | { type: 'CAST_SPELL'; spell: SpellId }
  | { type: 'DRINK_AETHER' }
  | { type: 'BUY_AETHER' }
  | { type: 'FLEE' }
  | { type: 'STUDY_ENEMY' }
  | { type: 'RESPOND_NPC'; response: DialogueResponse }
  | { type: 'CLOSE_DIALOGUE' }
  | { type: 'INSPECT_INSCRIPTION' }
  | { type: 'RESOLVE_OMEN'; accept: boolean }
