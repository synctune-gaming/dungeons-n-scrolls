import AxeBuilder from '@axe-core/playwright'
import { expect, test as base } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { createRun } from '../src/game/engine'
import { ROOMS } from '../src/game/content'
import { SAVE_KEY } from '../src/game/persistence'
import type { Player, RoomId, SavedGame } from '../src/game/types'
import { createSocialState } from '../src/social/types'

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
  game.discovered = route.slice(0, game.roomIndex + 1).filter((id) => ROOMS[id].kind !== 'combat' && ROOMS[id].kind !== 'boss')
  game.player = { ...game.player, ...player }
  const save: SavedGame = {
    version: 3, game, social: createSocialState(),
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  }
  await page.addInitScript(({ key, payload }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(payload))
  }, { key: SAVE_KEY, payload: save })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

async function beginBattle(page: Page, activate: (target: Locator) => Promise<void>, room: RoomId = 'hollow-king', player: Partial<Player> = {}) {
  await enter(page, room, player)
  await activate(page.getByRole('button', { name: /^(Draw your blade|Begin the fight|Approach the presence|Challenge the boss)$/ }))
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Strike', exact: true })).toBeEnabled()
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
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  for (let index = 0; index < 8; index += 1) await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Draw your blade', exact: true })).toBeEnabled()
  await page.waitForTimeout(250)
  await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  for (let index = 0; index < 8; index += 1) await page.mouse.wheel(0, 300)
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveAttribute('value', '28')
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
      await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Raise the lantern', exact: true })).toBeEnabled()
      await swipe(95, 0)
      await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
      await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toHaveAttribute('value', '26')
    } finally {
      await session.detach()
    }
    return
  }
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 95, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Raise the lantern', exact: true })).toBeEnabled()
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 95, y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toHaveAttribute('value', '26')
})

test('offers keyboard controls, protected dialogs, and focus restoration', async ({ page, activate }) => {
  await enter(page)
  await page.getByRole('heading', { name: 'The forgotten gate', exact: true }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  const inventory = page.getByRole('button', { name: 'Open your satchel', exact: true })
  await activate(inventory)
  await expect(page.getByRole('dialog', { name: 'Your satchel' })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(inventory).toBeFocused()
  await expect(page.getByRole('button', { name: 'Raise the lantern', exact: true })).toBeEnabled()
  await page.getByRole('heading', { name: 'A shape in the dark', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Open settings', exact: true }))
  await activate(page.getByRole('checkbox', { name: /Gesture hints/ }))
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await expect(page.getByText('Scroll or swipe to explore', { exact: true })).toHaveCount(0)
  await activate(page.getByRole('button', { name: 'Open settings', exact: true }))
  await expect(page.getByRole('checkbox', { name: /Gesture hints/ })).not.toBeChecked()
})

test('ends a fatal fight and starts a fresh run with the selected class', async ({ page, activate }) => {
  await beginBattle(page, activate, 'crypt-skulk', { health: 1 })
  await activate(page.getByRole('button', { name: 'Strike', exact: true }))
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
  test.setTimeout(90_000)
  await enter(page, 'ashen-gate', { strength: 100, dexterity: 10 })
  const primaryAction = /^(Enter the gate|Draw your blade|Begin the fight|Approach the presence|Strike|Continue|Move on|Open the chest|Keep moving|Drink from the well|Challenge the boss)$/
  for (let step = 0; step < 100; step += 1) {
    if (await page.getByRole('heading', { name: 'You lived to tell the tale.' }).count()) break
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
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
})

test('keeps future rooms and guardians anonymous until they are discovered', async ({ page, activate }) => {
  await enter(page)
  await expect(page.locator('body')).not.toContainText('The Hollow King')
  await expect(page.locator('body')).not.toContainText('Crypt skulk')
  await activate(page.getByRole('button', { name: 'View your journey', exact: true }))
  const map = page.getByRole('dialog', { name: 'A road into the unknown' })
  await expect(map).not.toContainText('The Hollow King')
  await expect(map).not.toContainText('The Cinderworks')
  await expect(map).not.toContainText('The Pale Sanctum')
  await expect(map.getByText('Uncharted region', { exact: true })).toHaveCount(2)
  await page.keyboard.press('Escape')
  await activate(page.getByRole('button', { name: 'Enter the gate', exact: true }))
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Raise the lantern', exact: true }))
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('The Hollow King')
})

test('combines frost, guard, ward, and fire across a real boss phase change', async ({ page, activate }) => {
  await beginBattle(page, activate)
  const mana = page.getByRole('progressbar', { name: 'Mana', exact: true })
  const health = page.getByRole('progressbar', { name: 'Health', exact: true })
  const enemy = page.getByRole('progressbar', { name: 'Enemy health', exact: true })
  await activate(page.getByRole('button', { name: 'Cast frost bind', exact: true }))
  await expect(mana).toHaveAttribute('value', '20')
  await expect(health).toHaveAttribute('value', '80')
  await expect(enemy).toHaveAttribute('value', '48')
  await expect(page.getByText('Held by frost', { exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Guard', exact: true }))
  await expect(mana).toHaveAttribute('value', '23')
  await activate(page.getByRole('button', { name: 'Cast arcane ward', exact: true }))
  await expect(mana).toHaveAttribute('value', '18')
  await activate(page.getByRole('button', { name: 'Cast ember bolt', exact: true }))
  await expect(page.getByText('Uncrowned', { exact: true })).toBeVisible()
  await expect(enemy).toHaveAttribute('value', '33')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0)
  await activate(page.getByRole('button', { name: 'Cast frost bind', exact: true }))
  await activate(page.getByRole('button', { name: 'Strike', exact: true }))
  await expect(enemy).toHaveAttribute('value', '0')
  await expect(page.getByText('The passage opens.', { exact: true })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Continue', exact: true }))
  await expect(page.getByRole('heading', { name: 'The Ember Pass', exact: true })).toBeVisible()
})

test('casts storm and mending spells, and consumes aether instead of free refills', async ({ page, activate }) => {
  await beginBattle(page, activate)
  const mana = page.getByRole('progressbar', { name: 'Mana', exact: true })
  await activate(page.getByRole('button', { name: 'Cast storm lance', exact: true }))
  await expect(mana).toHaveAttribute('value', '20')
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveAttribute('value', '45')
  await activate(page.getByRole('button', { name: 'Cast mending light', exact: true }))
  await expect(mana).toHaveAttribute('value', '13')
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toHaveAttribute('value', '80')
  await activate(page.getByRole('button', { name: 'Drink aether vial', exact: true }))
  await expect(mana).toHaveAttribute('value', '27')
  await expect(page.getByRole('button', { name: 'Drink aether vial', exact: true })).toBeDisabled()
})

test('holds a boss in its second phase even after an overpowered strike', async ({ page, activate }) => {
  await beginBattle(page, activate, 'hollow-king', { strength: 100 })
  await activate(page.getByRole('button', { name: 'Strike', exact: true }))
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveAttribute('value', '33')
  await expect(page.getByText('Uncrowned', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0)
  await activate(page.getByRole('button', { name: 'Strike', exact: true }))
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
})

test('offers actual conversations and one-time inscription bargains', async ({ page, activate }) => {
  await enter(page, 'lost-pilgrim')
  await activate(page.getByRole('button', { name: 'Speak to the stranger', exact: true }))
  await expect(page.getByRole('dialog', { name: 'A fellow wanderer' })).toBeVisible()
  await activate(page.getByRole('button', { name: /Ask what lies ahead/ }))
  await expect(page.getByRole('heading', { name: 'The rune-locked chest', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toHaveAttribute('max', '30')
  await activate(page.getByRole('button', { name: 'Inspect the hidden inscription', exact: true }))
  await expect(page.getByRole('dialog', { name: 'Something answers.' })).toBeVisible()
  await activate(page.getByRole('button', { name: 'Leave it untouched', exact: true }))
  await expect(page.getByRole('button', { name: 'Inspect the hidden inscription', exact: true })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'The rune-locked chest', exact: true })).toBeVisible()
})

test('saves an unfinished fight with its health, mana, and conditions', async ({ page, activate }) => {
  await beginBattle(page, activate)
  await activate(page.getByRole('button', { name: 'Cast frost bind', exact: true }))
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveAttribute('value', '48')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'The Hollow King', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Enemy health', exact: true })).toHaveAttribute('value', '48')
  await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toHaveAttribute('value', '20')
  await expect(page.getByText('Held by frost', { exact: true })).toBeVisible()
})

test('keeps every tactical choice and spell visible on a short phone', async ({ page, activate }) => {
  await page.setViewportSize({ width: 360, height: 664 })
  await beginBattle(page, activate)
  await activate(page.getByRole('button', { name: 'Cast frost bind', exact: true }))
  await expect(page.getByText('Held by frost', { exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  for (const name of ['Strike', 'Guard', 'Dodge', 'Cast ember bolt', 'Cast frost bind', 'Cast storm lance', 'Cast arcane ward', 'Cast mending light', 'Drink aether vial']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('animates real pixels and stops ambient motion when reduced motion is requested', async ({ page }) => {
  await enter(page)
  await page.bringToFront()
  const canvas = page.locator('canvas')
  const checksum = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')
    if (!context) throw new Error('The scene has no canvas context.')
    const pixels = context.getImageData(0, 0, element.width, element.height).data
    let hash = 0
    for (let index = 0; index < pixels.length; index += 1) hash = (Math.imul(hash, 31) + (pixels[index] ?? 0)) >>> 0
    return hash
  })
  const first = await checksum()
  await expect.poll(checksum).not.toBe(first)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(canvas).toHaveAttribute('data-motion', 'reduced')
  const still = await checksum()
  await page.waitForTimeout(250)
  expect(await checksum()).toBe(still)
})
