import { expect } from '@playwright/test'
import { beginBattle, enter, readSave, test } from './fixtures'

test('shows arrows and action outcomes without swipe labels', async ({ page }) => {
  await enter(page)
  const choices = page.getByRole('group', { name: 'Choose your next move' })
  for (const [label, outcome, shortcut] of [
    ['Take the trail', 'Scout ahead', 'ArrowLeft'],
    ['Enter the gate', 'Explore', 'ArrowUp'],
    ['Search the ruins', 'Find gold', 'ArrowRight'],
  ] as const) {
    const action = choices.getByRole('button', { name: label, exact: true })
    await expect(action).toHaveAccessibleDescription(outcome)
    await expect(action).toHaveAttribute('aria-keyshortcuts', shortcut)
    await expect(action.locator('svg')).toHaveCount(1)
  }
  await expect(choices.getByText(/^Swipe (left|right|up|down)$/i)).toHaveCount(0)
})

test('keeps artwork proportions in portrait and landscape', async ({ page, activate }) => {
  await page.addInitScript(() => {
    const scale = CanvasRenderingContext2D.prototype.scale
    CanvasRenderingContext2D.prototype.scale = function (x, y) {
      if (Math.abs(Math.abs(x) - Math.abs(y)) > 0.000001) throw new Error('Scene artwork must not be stretched on one axis.')
      scale.call(this, x, y)
    }
  })
  await enter(page)
  const art = page.getByRole('main').getByRole('img')
  await expect(art).toBeVisible()
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1280, height: 320 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => art.evaluate((element: HTMLCanvasElement) => {
      const bounds = element.getBoundingClientRect()
      return Math.abs(element.width / bounds.width - element.height / bounds.height)
    })).toBeLessThanOrEqual(1 / viewport.height)
  }
  await activate(page.getByRole('button', { name: 'Enter the gate', exact: true }))
  await expect(art).toHaveAccessibleName(/torchlit dungeon/)
})

test('fills the viewport with the live scene instead of page chrome', async ({ page }) => {
  await enter(page)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('The viewport is missing.')
  await expect.poll(async () => {
    const scene = await page.getByRole('img', { name: /original pixel-art woodland path/ }).boundingBox()
    return scene && { x: Math.round(scene.x), y: Math.round(scene.y), width: Math.round(scene.width), height: Math.round(scene.height) }
  }).toEqual({ x: 0, y: 0, ...viewport })
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height)
  await expect(page.getByRole('heading', { name: 'The forgotten gate', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Fictional adventurer stories' })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Adventure overview' })).toHaveCount(0)
  await expect(page.getByRole('progressbar', { name: 'Health', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Mana', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Experience', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^View journey map/ })).toHaveAccessibleName(/Floor 01.*Room 1 \/ 8/)
})

test('keeps essential controls reachable on small phones and after rotation', async ({ page, activate }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await beginBattle(page, activate)
  await activate(page.getByRole('button', { name: 'Cast frost bind', exact: true }))
  await expect(page.getByRole('button', { name: 'Strike', exact: true })).toBeEnabled()
  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 664 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    for (const name of [
      'Strike', 'Guard', 'Dodge', 'Cast ember bolt', 'Cast frost bind', 'Cast storm lance',
      'Cast arcane ward', 'Cast mending light', 'Drink aether vial', 'Open your satchel',
      'Open your grimoire', 'View journey map', 'Timeline', 'Search', 'Profile', 'More',
    ]) {
      const control = page.getByRole('button', { name: name === 'View journey map' ? /^View journey map/ : name, exact: name !== 'View journey map' })
      await expect(control).toBeInViewport({ ratio: 1 })
      const bounds = await control.boundingBox()
      if (!bounds) throw new Error(`${name} is missing from the encounter.`)
      expect(bounds.width, `${name} touch width`).toBeGreaterThanOrEqual(44)
      expect(bounds.height, `${name} touch height`).toBeGreaterThanOrEqual(44)
    }
    const intent = await page.getByRole('group', { name: 'Enemy intention' }).boundingBox()
    const choices = await page.getByRole('group', { name: 'Choose your next move' }).boundingBox()
    if (!intent || !choices) throw new Error('The intention or choices are missing.')
    expect(intent.y).toBeGreaterThanOrEqual(0)
    if (viewport.width < viewport.height) expect(intent.y + intent.height).toBeLessThanOrEqual(choices.y)
    else expect(intent.x + intent.width).toBeLessThanOrEqual(choices.x)
    const status = await page.getByRole('region', { name: 'Adventurer status' }).boundingBox()
    const title = await page.getByRole('heading', { name: 'The Hollow King', exact: true }).boundingBox()
    if (!status || !title) throw new Error('The status or boss title is missing.')
    expect(title.y).toBeGreaterThanOrEqual(status.y + status.height)
    expect(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }))).toEqual(viewport)
    if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/${info.project.name}-combat-${viewport.width}x${viewport.height}.png` })
  }
})

test('keeps scene discoveries clear of status and choice overlays', async ({ page, activate }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await enter(page, 'sealed-coffer')
  const chest = page.getByRole('button', { name: 'Examine the chest', exact: true })
  await expect(chest).toBeInViewport({ ratio: 1 })
  const bounds = await chest.boundingBox()
  const status = await page.getByRole('region', { name: 'Adventurer status' }).boundingBox()
  const copy = await page.getByRole('heading', { name: 'The rune-locked chest', exact: true }).boundingBox()
  if (!bounds || !status || !copy) throw new Error('The chest, status, or room title is missing.')
  expect(bounds.y).toBeGreaterThanOrEqual(status.y + status.height)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(copy.y)
  await activate(chest)
  await expect(page.getByRole('dialog', { name: 'The rune lock', exact: true })).toBeVisible()
})

test('does not turn wheel scrolling over encounter buttons into choices', async ({ page, browserName, isMobile }) => {
  test.skip(browserName === 'webkit' && isMobile, 'Playwright does not inject mouse wheels into mobile WebKit.')
  await enter(page)
  const before = await readSave(page)
  await page.getByRole('button', { name: 'Enter the gate', exact: true }).hover()
  await page.mouse.wheel(0, 300)
  expect((await readSave(page)).game).toEqual(before.game)
  await page.getByRole('img', { name: /original pixel-art woodland path/ }).hover()
  await page.mouse.wheel(0, 300)
  await expect(page.getByRole('heading', { name: 'A shape in the dark', exact: true })).toBeVisible()
})

test('opens secondary tools without spending a turn and restores focus to More', async ({ page, activate }) => {
  await beginBattle(page, activate, 'crypt-skulk')
  const before = await readSave(page)
  const more = page.getByRole('button', { name: 'More', exact: true })
  await activate(more)
  const tools = page.getByRole('dialog', { name: 'Adventure tools', exact: true })
  await expect(tools).toBeVisible()
  await expect(tools.getByRole('region', { name: 'Fictional adventurer stories' })).toBeVisible()
  await page.keyboard.press('ArrowUp')
  expect((await readSave(page)).game).toEqual(before.game)
  await activate(tools.getByRole('button', { name: 'Open settings', exact: true }))
  await expect(page.getByRole('dialog', { name: 'Make yourself at home' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(more).toBeFocused()
  expect((await readSave(page)).game).toEqual(before.game)
})

test('returns to the same fullscreen fight after browsing search and profile', async ({ page, activate }) => {
  await beginBattle(page, activate, 'crypt-skulk')
  const before = await readSave(page)
  for (const name of ['Search', 'Profile', 'Timeline']) {
    await activate(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name, exact: true }))
  }
  await expect(page.getByRole('heading', { name: 'Crypt skulk', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Enemy intention' })).toBeInViewport({ ratio: 1 })
  expect((await readSave(page)).game).toEqual(before.game)
  const scene = await page.getByRole('img', { name: /original pixel-art torchlit dungeon/ }).boundingBox()
  const viewport = page.viewportSize()
  if (!scene || !viewport) throw new Error('The resumed scene or viewport is missing.')
  expect(scene.height).toBeCloseTo(viewport.height, 0)
})
