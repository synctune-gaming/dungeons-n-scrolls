# Development

This is a playable browser-game prototype, built with React 19, TypeScript 7, and Vite 8. It needs no backend, API keys, database, external image service, or runtime font requests.

## Setup

Use Node.js 22.12+ in the 22.x series, 24.x, or 26+ and npm. Node.js 26 is recommended; the development test runner supports these same Node series.

```bash
npm ci
npm run dev
```

Vite prints its local URL, normally `http://localhost:5173`. Choose a different port if it is occupied:

```bash
npm run dev -- --port 5187 --strictPort
```

## Verify changes

```bash
npm run check
npm run build
npm audit
```

The unit suite covers seeded generation, all room kinds, turn-based combat, intentions, boss phase gates, spell costs and effects, purchases, conversations, one-time inscriptions, puzzles, death, victory, and version-1 save migration. Intermediate saves are validated across 90 class/seed combinations. A separate normal-stats strategy verifies that every class has a viable complete adventure.

Install test browsers once, then run the browser suite:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium webkit` if browser system libraries are missing.

Playwright manages an isolated local Vite server on port 4177 and stops it afterward. The suite covers desktop Chromium, Android-style Chromium, and mobile WebKit. It uses mouse input on desktop and native taps on touch projects. Chromium's mobile swipe checks inject real touch input through CDP. Checks cover hidden identities, real boss phases and spell combinations, combat resumption, scene interactions, short-phone controls, and actual pixel changes for animation and reduced motion.

Playwright does not expose native mouse-wheel or swipe injection for mobile WebKit, so those two API-specific checks are explicitly skipped there. Its keyboard, native tap, puzzle, shopping, saving, death, victory, and accessibility checks still run. Physical-device Safari swipe behavior needs manual verification.

Failure traces and screenshots go to ignored `test-results/`. To capture the initial desktop and mobile layouts outside the source tree, set `ARTIFACT_DIR` to an existing artifact directory when running the suite. All fixtures contain fictional game data.

## Structure

| Path | Responsibility |
| --- | --- |
| `src/game/content.ts` | Classes, relics, regions, authored rooms, and choice copy |
| `src/game/engine.ts` | Pure, immutable game reducer and seeded random generation |
| `src/game/types.ts` | Types and versioned Zod save validation |
| `src/game/persistence.ts` | Browser storage with explicit failure reporting |
| `src/components/PixelScene.tsx` | Original procedural pixel artwork, dithering, and responsive framing |
| `src/components/CombatControls.tsx` | Enemy health, intentions, conditions, spells, and mana refills |
| `src/useRoomGestures.ts` | Pointer swipes and wheel-burst locking |
| `src/useReducedMotion.ts` | Live reduced-motion preference |
| `src/App.tsx` | Adventure feed, character, inventory, journal, map, and settings |
| `src/styles.css` | Basalt, antique-gold, and torchlight tokens; responsive layouts |
| `tests/adventure.spec.ts` | User-facing browser and accessibility checks |

Route order, combat variation, puzzle combinations, and rewards all advance the run's stored PRNG state. Do not call `Math.random()` inside the engine. New runs receive a browser-generated seed.

Add gameplay through `gameReducer` so buttons, scene markers, gestures, and keyboard controls produce the same state transition. Keep saved states consistent with `savedGameSchema`; unknown versions and impossible states are rejected with a visible notice. Victory rewards are applied once and the encounter remains until Continue. Do not bypass boss phase gates.

Keep unknown identities out of names, descriptions, image labels, icons, and map entries. `discovered` records identification, not merely passing a room. Do not reveal a future guardian just because it occupies the last route slot.

Artwork is drawn locally at a low logical pixel resolution. Dithered backdrops are cached; the animation loop only redraws live entities, torches, particles, weapons, and effects, capped at 20 FPS. Backdrops adapt to the viewport while creatures and the first-person sword retain their proportions. Animation frames, observers, listeners, and feedback timers are cleaned up; hidden tabs and dialogs pause rendering. Reduced motion keeps static state and combat feedback without ambient movement.

Feedback stores both the action effect and its outcome. A killing or phase-breaking spell must still show its own effect, alongside the victory or phase transition. Resuming a saved fight does not replay old spell animations. The supplied visual reference informed the atmosphere; its image and the Instagram video are not bundled.

## Production

```bash
npm run build
npm run preview
```

Deploy `dist/` to any static host. The app uses no client-side path routing. Serve the root document and bundled assets over HTTP(S); opening `index.html` directly through `file://` is not supported.

The current save key is `dungeons-and-scrolls.save.v2`. If it is absent, the loader checks `dungeons-and-scrolls.save.v1`, validates the old shape, and migrates the adventure while retaining the original backup. Combat, conditions, discoveries, pending conversations, and inscription outcomes persist. Newer saves take priority; corrupt saves are not silently replaced with an older one.

Saves are local to the browser's origin, so different ports or deployment hosts have separate adventures. There is no server authority or anti-cheat mechanism in this prototype.
