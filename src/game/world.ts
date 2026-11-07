import type { RoomId } from './types'

export const DESTINATION_IDS = [
  'mossmere', 'pilgrim-camp', 'lantern-market',
  'cinderhaven', 'smith-forge', 'ash-bazaar',
  'starlight-quay', 'seer-tent', 'midnight-market',
] as const
export type DestinationId = typeof DESTINATION_IDS[number]
export const SIDE_TRIP_INTERVAL = 5

export interface Destination {
  id: DestinationId
  name: string
  kind: 'city' | 'npc' | 'shop'
  floor: number
  roomId: RoomId
  description: string
  discovery: string
  venues: DestinationId[]
}

export const DESTINATIONS: Record<DestinationId, Destination> = {
  mossmere: {
    id: 'mossmere', name: 'Mossmere', kind: 'city', floor: 1, roomId: 'moss-trail',
    description: 'A small woodland city. Follow the lanterns to a market and a shared campfire.',
    discovery: 'You find the old road markers beneath the moss. A map of the woodland crossings takes shape. +2 XP.',
    venues: ['pilgrim-camp', 'lantern-market'],
  },
  'pilgrim-camp': {
    id: 'pilgrim-camp', name: 'The pilgrim camp', kind: 'npc', floor: 1, roomId: 'lost-pilgrim',
    description: 'A wanderer outside Mossmere shares rumors, a warm fire, and travel supplies.',
    discovery: '', venues: [],
  },
  'lantern-market': {
    id: 'lantern-market', name: 'The lantern market', kind: 'shop', floor: 1, roomId: 'lantern-merchant',
    description: 'Tonics, aether, and an iron charm. A working market for your current adventure.',
    discovery: '', venues: [],
  },
  cinderhaven: {
    id: 'cinderhaven', name: 'Cinderhaven', kind: 'city', floor: 2, roomId: 'ash-trail',
    description: 'A forge city in the mountain pass. Its last smith still tends the coals.',
    discovery: 'You trace the cooling channels through the city. The old forge roads are not forgotten. +2 XP.',
    venues: ['smith-forge', 'ash-bazaar'],
  },
  'smith-forge': {
    id: 'smith-forge', name: 'The smith forge', kind: 'npc', floor: 2, roomId: 'forge-smith',
    description: 'Ask the last smith for a clue, share her fire, or buy supplies.',
    discovery: '', venues: [],
  },
  'ash-bazaar': {
    id: 'ash-bazaar', name: 'The ash bazaar', kind: 'shop', floor: 2, roomId: 'ash-merchant',
    description: 'A sheltered mountain market selling tonics, aether, and charms.',
    discovery: '', venues: [],
  },
  'starlight-quay': {
    id: 'starlight-quay', name: 'Starlight Quay', kind: 'city', floor: 3, roomId: 'mist-trail',
    description: 'A city at the edge of the mist. Look for a reader of stars and the midnight stalls.',
    discovery: 'You chart the lamps along the quay. Their reflections mark a safe road through the mist. +2 XP.',
    venues: ['seer-tent', 'midnight-market'],
  },
  'seer-tent': {
    id: 'seer-tent', name: 'The star reader tent', kind: 'npc', floor: 3, roomId: 'star-seer',
    description: 'The seer offers a quiet meeting, a clue, and supplies for the last crossing.',
    discovery: '', venues: [],
  },
  'midnight-market': {
    id: 'midnight-market', name: 'The midnight market', kind: 'shop', floor: 3, roomId: 'veil-merchant',
    description: 'Restock your satchel before returning to the dungeon. Purchases use your run gold.',
    discovery: '', venues: [],
  },
}
