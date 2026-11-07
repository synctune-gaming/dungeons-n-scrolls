import AxeBuilder from '@axe-core/playwright'
import { expect, test as base } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { createRun } from '../src/game/engine'
import { SAVE_KEY } from '../src/game/persistence'
import type { Player, RoomId, SavedGame } from '../src/game/types'

const route: RoomId[] = [
  'ashen-gate', 'crypt-skulk', 'lost-pilgrim', 'sealed-coffer',
  'lantern-merchant', 'moon-well', 'bone-sentry', 'hollow-king',
]

const test = base.extend<{ activate: (target: Locator) => Promise<void> }>({
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

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([])
})

async function enter(page: Page, room: RoomId = 'ashen-gate', player: Partial<Player> = {}) {
  const game = createRun(12345)
  game.deck = [...route]
  game.roomIndex = route.indexOf(room)
  if (game.roomIndex < 0) throw new Error(`The test route has no ${room}.`)
  game.roomsCleared = game.roomIndex
  game.player = { ...game.player, ...player }
  const save: SavedGame = {
    version: 1, game,
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  }
  await page.addInitScript(({ key, payload }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(payload))
  }, { key: SAVE_KEY, payload: save })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

test('shows an original scene with every choice reachable in the first viewport', async ({ page }, info) => {
  await enter(page)
  await expect(page.getByRole('heading', { name: 'The Ashen Woods', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /original pixel-art woodland path/ })).toBeVisible()
  for (const name of ['Take the trail', 'Enter the gate', 'Search the ruins']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
  }
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth, content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
  if (process.env.ARTIFACT_DIR) {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/${info.project.name}.png`, fullPage: true })
  }
})

test('supports scrolling without consuming an entire run from wheel inertia', async ({ page, browserName, isMobile }) => {
  test.skip(browserName === 'webkit' && isMobile, 'Playwright does not inject mouse wheels into mobile WebKit.')
  await enter(page)
  await page.getByRole('img', { name: /original pixel-art woodland path/ }).hover()
  await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  for (let index = 0; index < 8; index += 1) await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'A fellow wanderer', exact: true })).toBeVisible()
})

test('supports upward and horizontal pointer swipes', async ({ page, browserName, isMobile, hasTouch }) => {
  test.skip(browserName === 'webkit' && isMobile, 'Playwright exposes native taps, but no native swipe injection, on mobile WebKit.')
  await enter(page)
  const image = page.getByRole('img', { name: /original pixel-art woodland path/ })
  const box = await image.boundingBox()
  if (!box) throw new Error('The room artwork is not visible.')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  if (hasTouch && browserName === 'chromium') {
    const session = await page.context().newCDPSession(page)
    const swipe = async (dx: number, dy: number) => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let step = 1; step <= 6; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6 }],
        })
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    try {
      await swipe(0, -95)
      await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
      await swipe(95, 0)
      await expect(page.getByRole('heading', { name: 'A fellow wanderer', exact: true })).toBeVisible()
    } finally {
      await session.detach()
    }
    return
  }
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 95, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 95, y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: 'A fellow wanderer', exact: true })).toBeVisible()
})

test('offers keyboard controls, protected dialogs, and focus restoration', async ({ page, activate }) => {
  await enter(page)
  await page.getByRole('heading', { name: 'The forgotten gate', exact: true }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  const inventory = page.getByRole('button', { name: 'Open your satchel', exact: true })
  await activate(inventory)
  await expect(page.getByRole('dialog', { name: 'Your satchel' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(inventory).toBeFocused()
  await page.getByRole('heading', { name: 'Crypt skulk', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'A fellow wanderer', exact: true })).toBeVisible()
})

test('solves a low-dexterity chest and equips its loot', async ({ page, activate }) => {
  await enter(page, 'sealed-coffer', { dexterity: 6 })
  await activate(page.getByRole('button', { name: 'Open the chest', exact: true }))
  const dialog = page.getByRole('dialog', { name: 'The rune lock' })
  await expect(dialog).toBeVisible()
  const symbols = await dialog.getByRole('list', { name: 'Rune combination' }).getByRole('listitem').allTextContents()
  for (const symbol of symbols) {
    const rune = symbol.match(/moon|flame|eye/)?.[0]
    if (!rune) throw new Error('The visible lock has no readable rune.')
    await activate(dialog.getByRole('button', { name: `Choose ${rune} rune`, exact: true }))
  }
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'The lantern keeper', exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Open your satchel', exact: true }))
  await expect(page.getByRole('dialog').getByText('Equipped', { exact: true })).toHaveCount(1)
})

test('lets dexterity bypass a lock without showing the puzzle', async ({ page, activate }) => {
  await enter(page, 'sealed-coffer', { dexterity: 10 })
  await activate(page.getByRole('button', { name: 'Open the chest', exact: true }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'The lantern keeper', exact: true })).toBeVisible()
})

test('makes shop purchases real and prevents buying with an empty purse', async ({ page, activate }) => {
  await enter(page, 'lantern-merchant', { gold: 15 })
  const tonic = page.getByRole('button', { name: 'Buy a tonic', exact: true })
  await activate(tonic)
  await expect(tonic).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Buy iron charm', exact: true })).toBeDisabled()
  await activate(page.getByRole('button', { name: 'Open your satchel', exact: true }))
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Healing tonic x3/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await activate(page.getByRole('button', { name: 'Keep moving', exact: true }))
  await expect(page.getByRole('heading', { name: 'A moment of stillness', exact: true })).toBeVisible()
})

test('persists the current room and preferences through a reload', async ({ page, activate }) => {
  await enter(page)
  await activate(page.getByRole('button', { name: 'Enter the gate', exact: true }))
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Open settings', exact: true }))
  await activate(page.getByRole('checkbox', { name: /Gesture hints/ }))
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await expect(page.getByText('Scroll or swipe to explore', { exact: true })).toHaveCount(0)
  await activate(page.getByRole('button', { name: 'Open settings', exact: true }))
  await expect(page.getByRole('checkbox', { name: /Gesture hints/ })).not.toBeChecked()
})

test('ends a fatal fight and starts a fresh run with the selected class', async ({ page, activate }) => {
  await enter(page, 'crypt-skulk', { health: 1 })
  await activate(page.getByRole('button', { name: 'Attack', exact: true }))
  await expect(page.getByRole('heading', { name: 'Every ending is a beginning.' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toHaveAttribute('value', '0')
  await activate(page.getByRole('button', { name: 'Try a new adventure', exact: true }))
  await activate(page.getByRole('radio', { name: /Shade/ }))
  await activate(page.getByRole('button', { name: 'Begin a new adventure', exact: true }))
  await expect(page.getByRole('heading', { name: 'The forgotten gate', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toHaveAttribute('max', '62')
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toHaveAttribute('value', '62')
})

test('plays all three floors to victory and preserves the win after restarting', async ({ page, activate }) => {
  await enter(page, 'ashen-gate', { strength: 30, dexterity: 10 })
  const primaryAction = /^(Enter the gate|Attack|Move on|Open the chest|Keep moving|Drink from the well|Challenge the boss)$/
  for (let step = 0; step < 24; step += 1) {
    await activate(page.getByRole('button', { name: primaryAction }))
  }
  await expect(page.getByRole('heading', { name: 'You lived to tell the tale.' })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Try a new adventure', exact: true }))
  await activate(page.getByRole('button', { name: 'Begin a new adventure', exact: true }))
  await activate(page.getByRole('button', { name: 'View your journey', exact: true }))
  await expect(page.getByRole('dialog').getByText('Completed adventures1', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Best floor3 / 3', { exact: true })).toBeVisible()
})

test('reports corrupt storage and still provides a playable new adventure', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{not a saved game'), SAVE_KEY)
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Your saved adventure is damaged')
  await expect(page.getByRole('button', { name: 'Enter the gate', exact: true })).toBeEnabled()
})

test('meets automated accessibility checks in the adventure and inventory', async ({ page, activate }) => {
  await enter(page)
  const adventure = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(adventure.violations).toEqual([])
  await activate(page.getByRole('button', { name: 'Open your satchel', exact: true }))
  const inventory = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(inventory.violations).toEqual([])
})

test('keeps controls reachable on a short phone and honors reduced motion', async ({ page, activate }) => {
  await page.setViewportSize({ width: 360, height: 664 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enter(page)
  await expect(page.getByRole('button', { name: 'Enter the gate', exact: true })).toBeInViewport({ ratio: 1 })
  const animation = await page.getByRole('img', { name: /original pixel-art woodland path/ }).evaluate((element) => {
    const room = element.closest('.room-content')
    return room ? getComputedStyle(room).animationName : ''
  })
  expect(animation).toBe('none')
  await activate(page.getByRole('button', { name: 'Enter the gate', exact: true }))
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
})
