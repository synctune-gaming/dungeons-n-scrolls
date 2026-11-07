import { z } from 'zod'

export const ADVENTURER_IDS = ['mosskeeper', 'emberfox', 'starling', 'stoneward', 'reedshade', 'lantern-rook'] as const
export const PORTRAIT_STYLES = ['hood', 'braids', 'helm'] as const
export const PORTRAIT_PALETTES = ['sage', 'ember', 'aether'] as const
export const GIFT_IDS = ['trail-ration', 'aether-spark', 'lucky-charm'] as const
export const PRESET_IDS = ['greet', 'good-luck', 'well-fought', 'thanks'] as const
export const MESSAGE_IDS = [...PRESET_IDS, 'greet-reply', 'good-luck-reply', 'well-fought-reply', 'thanks-reply'] as const
export type AdventurerId = typeof ADVENTURER_IDS[number]
export type GiftId = typeof GIFT_IDS[number]
export type PresetId = typeof PRESET_IDS[number]
export type MessageId = typeof MESSAGE_IDS[number]

const integer = (min: number, max = 1_000_000) => z.number().int().min(min).max(max)
export const appearanceSchema = z.object({
  style: z.enum(PORTRAIT_STYLES),
  palette: z.enum(PORTRAIT_PALETTES),
}).strict()
export const heroProfileSchema = z.object({
  name: z.string().trim().min(1, 'Give your adventurer a name.').max(32, 'Use 32 characters or fewer.'),
  appearance: appearanceSchema,
}).strict()
export type Appearance = z.infer<typeof appearanceSchema>
export type HeroProfile = z.infer<typeof heroProfileSchema>

const boostSchema = z.object({
  health: integer(0, 4),
  mana: integer(0, 2),
  strength: integer(0, 1),
}).strict()

const entryFields = { id: integer(1), adventurerId: z.enum(ADVENTURER_IDS) }
export const messageSchema = z.discriminatedUnion('kind', [
  z.object({ ...entryFields, kind: z.literal('preset'), sender: z.enum(['hero', 'adventurer']), presetId: z.enum(MESSAGE_IDS) }).strict(),
  z.object({ ...entryFields, kind: z.literal('sent-gift'), giftId: z.enum(GIFT_IDS), boosted: z.boolean() }).strict(),
  z.object({ ...entryFields, kind: z.literal('received-gift'), giftId: z.enum(GIFT_IDS), runNumber: integer(1), claimed: z.boolean() }).strict(),
])
export type ChatEntry = z.infer<typeof messageSchema>

export const socialStateSchema = z.object({
  hero: heroProfileSchema,
  following: z.array(z.enum(ADVENTURER_IDS)).max(ADVENTURER_IDS.length),
  boosts: z.record(z.enum(ADVENTURER_IDS), boostSchema),
  messages: z.array(messageSchema).max(240),
  nextId: integer(1),
}).strict().superRefine((social, context) => {
  const receipts = social.messages.filter((entry) => entry.kind === 'received-gift')
  const valid = new Set(social.following).size === social.following.length
    && new Set(social.messages.map((entry) => entry.id)).size === social.messages.length
    && social.messages.every((entry, index) => entry.id < social.nextId
      && (index === 0 || entry.id > (social.messages[index - 1]?.id ?? 0))
      && (entry.kind !== 'preset' || entry.sender !== 'hero' || PRESET_IDS.some((id) => id === entry.presetId)))
    && new Set(receipts.map((entry) => `${entry.runNumber}:${entry.adventurerId}`)).size === receipts.length
    && receipts.every((entry) => receipts.filter((other) => other.runNumber === entry.runNumber).length <= 3)
  if (!valid) context.addIssue({ code: 'custom', message: 'The saved following list or conversation is inconsistent.' })
})
export type SocialState = z.infer<typeof socialStateSchema>

export function createSocialState(): SocialState {
  return socialStateSchema.parse({
    hero: { name: 'Wayfarer', appearance: { style: 'hood', palette: 'sage' } },
    following: [], messages: [], nextId: 1,
    boosts: Object.fromEntries(ADVENTURER_IDS.map((id) => [id, { health: 0, mana: 0, strength: 0 }])),
  })
}

export const socialActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CUSTOMIZE'), profile: heroProfileSchema }).strict(),
  z.object({ type: z.literal('FOLLOW'), adventurerId: z.enum(ADVENTURER_IDS) }).strict(),
  z.object({ type: z.literal('UNFOLLOW'), adventurerId: z.enum(ADVENTURER_IDS) }).strict(),
  z.object({ type: z.literal('SEND_PRESET'), adventurerId: z.enum(ADVENTURER_IDS), presetId: z.enum(PRESET_IDS) }).strict(),
  z.object({ type: z.literal('GIVE_GIFT'), adventurerId: z.enum(ADVENTURER_IDS), giftId: z.enum(GIFT_IDS) }).strict(),
  z.object({ type: z.literal('CLAIM_GIFT'), messageId: integer(1) }).strict(),
])
export type SocialAction = z.infer<typeof socialActionSchema>
