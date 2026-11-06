import { savedGameSchema } from './types'
import type { SavedGame } from './types'

export const SAVE_KEY = 'dungeons-and-scrolls.save.v1'

export function loadSave(storage?: Pick<Storage, 'getItem'>): { save: SavedGame | null; error: string | null } {
  let raw: string | null
  try {
    raw = (storage ?? window.localStorage).getItem(SAVE_KEY)
  } catch (error) {
    console.error('Cannot read the saved adventure:', error)
    return { save: null, error: 'Your saved adventure cannot be read. Allow browser storage to keep your progress.' }
  }
  if (raw === null) return { save: null, error: null }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (error) {
    console.error('The saved adventure is not valid JSON:', error)
    return { save: null, error: 'Your saved adventure is damaged. A new adventure has started.' }
  }
  const result = savedGameSchema.safeParse(data)
  if (!result.success) {
    console.error('The saved adventure is incompatible:', result.error.issues)
    return { save: null, error: 'Your saved adventure is damaged or from an unsupported version. A new adventure has started.' }
  }
  return { save: result.data, error: null }
}

export function writeSave(save: SavedGame, storage?: Pick<Storage, 'setItem'>): string | null {
  try {
    (storage ?? window.localStorage).setItem(SAVE_KEY, JSON.stringify(save))
    return null
  } catch (error) {
    console.error('Cannot save the adventure:', error)
    return 'Your adventure could not save. Allow browser storage and keep this tab open to avoid losing progress.'
  }
}
