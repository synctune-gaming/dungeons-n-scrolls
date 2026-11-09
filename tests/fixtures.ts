import { expect, test as base } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { createRun } from '../src/game/engine'
import { ROOMS } from '../src/game/content'
import { SAVE_KEY } from '../src/game/persistence'
import { savedGameSchema } from '../src/game/types'
import type { GameState, Player, RoomId, SavedGame } from '../src/game/types'
import { createSocialState } from '../src/social/types'

const route: RoomId[] = [
  'ashen-gate', 'crypt-skulk', 'lost-pilgrim', 'sealed-coffer',
  'lantern-merchant', 'moon-well', 'bone-sentry', 'hollow-king',
]

export const test = base.extend<{ activate: (target: Locator) => Promise<void> }>({
  activate: async ({ hasTouch }, use) => {
    await use((target) => hasTouch ? target.tap() : target.click())
  },
})

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]) })

export async function enter(page: Page, room: RoomId = 'ashen-gate', player: Partial<Player> = {}) {
  const game = createRun(12345)
  game.deck = [...route]
  game.roomIndex = route.indexOf(room)
  if (game.roomIndex < 0) throw new Error(`The test route has no ${room}.`)
  game.roomsCleared = game.roomIndex
  game.discovered = route.slice(0, game.roomIndex + 1).filter((id) => ROOMS[id].kind !== 'combat' && ROOMS[id].kind !== 'boss')
  game.player = { ...game.player, ...player }
  await loadGame(page, game)
}

export async function loadGame(page: Page, game: GameState) {
  const save: SavedGame = {
    version: 3, game, social: createSocialState(),
    settings: { sound: false, hints: true }, records: { bestFloor: 1, wins: 0 },
  }
  await page.addInitScript(({ key, payload }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(payload))
  }, { key: SAVE_KEY, payload: save })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

export async function beginBattle(page: Page, activate: (target: Locator) => Promise<void>, room: RoomId = 'hollow-king', player: Partial<Player> = {}) {
  await enter(page, room, player)
  await activate(page.getByRole('button', { name: /^(Draw your blade|Begin the fight|Approach the presence|Challenge the boss)$/ }))
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Strike', exact: true })).toBeEnabled()
}

export async function openTools(page: Page, activate: (target: Locator) => Promise<void>) {
  await activate(page.getByRole('button', { name: 'More', exact: true }))
  await expect(page.getByRole('dialog', { name: 'Adventure tools', exact: true })).toBeVisible()
}

export async function readSave(page: Page): Promise<SavedGame> {
  const value: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) throw new Error('The fictional test adventure did not save.')
    return JSON.parse(raw)
  }, SAVE_KEY)
  return savedGameSchema.parse(value)
}
