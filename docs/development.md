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

The unit suite covers twelve-room generation, varied monster toughness, all room kinds, turn-based combat, intentions, boss phase gates, spell costs and effects, purchases, conversations, one-time inscriptions, puzzles, death, victory, and version-1/version-2 migration. Social checks cover profile validation, following, preset-only messages, bounded recipient boosts, reciprocal gifts, atomic claims, and conversation retention. World checks exercise the exact five-room gate, playable visits, shared NPC rewards, and unchanged dungeon routes/RNG. Intermediate saves are validated across 90 class/seed combinations. A separate normal-stats strategy verifies that every class has a viable complete adventure.

Install test browsers once, then run the browser suite:

```bash
npx playwright install chromium webkit
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium webkit` if browser system libraries are missing.

Playwright manages an isolated local Vite server on port 4177 and stops it afterward. The suite covers desktop Chromium, Android-style Chromium, and mobile WebKit. It uses mouse input on desktop and native taps on touch projects. Chromium's mobile swipe checks inject real touch input through CDP. Checks cover a viewport-filling scene without document scrolling, 44px gameplay touch targets at 320x568 and after landscape rotation, hidden identities, real boss phases and spell combinations, combat resumption, scene interactions, and actual pixel changes for animation and reduced motion. Social flows cover persistent navigation, personalization, follow ordering, More/tools/story focus restoration, input isolation, playable visits and cooldowns, gift receipts/expiry, preset-only chat, 320px layouts, and axe accessibility checks.

Playwright does not expose native mouse-wheel or swipe injection for mobile WebKit, so wheel/swipe-injection checks are explicitly skipped there. Its keyboard, native tap, puzzle, shopping, saving, death, victory, and accessibility checks still run. Physical-device Safari swipe behavior needs manual verification.

Failure traces and screenshots go to ignored `test-results/`. To capture initial desktop/mobile layouts and chat outside the source tree, set `ARTIFACT_DIR` to an existing artifact directory when running the suite. `tests/fixtures.ts` shares fictional saves, native tap/click activation, and runtime-error checks between suites. All fixtures contain fictional game data.

## Structure

| Path | Responsibility |
| --- | --- |
| `src/game/content.ts` | Classes, relics, twelve-room regions, monster ranks, shop definitions, and choice copy |
| `src/game/world.ts` | Cities, NPC/market destinations, venue relationships, and the five-room interval |
| `src/game/engine.ts` | Pure game reducer, seeded generation, history, visits, purchases, and guarded gift effects |
| `src/game/types.ts` | Types and versioned Zod save validation |
| `src/game/persistence.ts` | Browser storage with explicit failure reporting |
| `src/components/PixelScene.tsx` | Original procedural pixel artwork, dithering, and responsive framing |
| `src/components/CombatControls.tsx` | Enemy health, intentions, conditions, spells, and mana refills |
| `src/components/Timeline.tsx` | One fullscreen live encounter, compact status/tactical overlays, and shared read-only encounter history |
| `src/components/Profiles.tsx`, `Portrait.tsx`, `CharacterDetails.tsx` | Cosmetic identity, live hero/fictional profiles, and shared portrait/stat/equipment presentation |
| `src/components/Stories.tsx`, `Explore.tsx`, `GiftChat.tsx` | Sequential stories, playable world discovery, and preset-only conversation controls |
| `src/social/types.ts`, `content.ts`, `engine.ts` | Validated local social state, authored fictional content, and immutable social transitions |
| `src/useRoomGestures.ts` | Pointer swipes and wheel-burst locking |
| `src/useReducedMotion.ts` | Live reduced-motion preference |
| `src/App.tsx` | One saved-state owner, typed screen navigation, More/tools/stories/history, audio, and input guards |
| `src/styles.css` | Basalt, antique-gold, and torchlight tokens; responsive layouts |
| `tests/adventure.spec.ts`, `tests/social.spec.ts`, `tests/gameplay-layout.spec.ts` | Gameplay/social browser, fullscreen/mobile layout, and accessibility checks |

Route order, combat variation, puzzle combinations, and rewards all advance the run's stored PRNG state. Do not call `Math.random()` inside the engine. New runs receive a browser-generated seed.

Add gameplay through `gameReducer` so buttons, scene markers, gestures, and keyboard controls produce the same state transition. Synchronize the animation input lock and keyboard listeners before paint so shortcuts are ready whenever controls are visibly enabled. Keep saved states consistent with `savedGameSchema`; unknown versions and impossible states are rejected with a visible notice. Victory rewards are applied once and the encounter remains until Continue. Do not bypass boss phase gates.

Keep `game.player` authoritative for the hero. Personalization is cosmetic; profiles must not copy gameplay stats into social state. Navigation state is transient and does not dispatch game choices. Incoming gift claims update the gameplay ledger and conversation receipt atomically through `socialReducer`; issuing/claiming returns cannot exceed three per run. Claims must respect encounter and resource guards. Chat actions validate a strict ID-only union: arbitrary message text and notes are rejected.

Visits store a separate destination/venue context, not a second dungeon run. Main-room progression remains frozen while visiting. Charge the five-room gate on entry using the persisted `roomsCleared` counter; world interactions do not count. Shared NPC reward and purchase helpers prevent alternate surfaces from granting duplicate free rewards or changing prices. Encounter history is captured only when the game actually advances and cannot replay actions.

Keep unknown identities out of names, descriptions, image labels, icons, and map entries. `discovered` records identification, not merely passing a room. Do not reveal a future guardian just because it occupies the last route slot.

Artwork is drawn locally at a low logical pixel resolution. Dithered backdrops are cached; the animation loop only redraws live entities, torches, particles, weapons, and effects, capped at 20 FPS. Backdrops fill the viewport while creatures and the first-person sword retain their proportions. The live encounter observes its status and dock bounds to keep foreground entities, spell effects, and scene markers out of HUD areas; other scenes keep their default framing. Animation frames, observers, listeners, and feedback timers are cleaned up; hidden tabs and dialogs pause rendering. Reduced motion keeps static state and combat feedback without ambient movement.

Feedback stores both the action effect and its outcome. A killing or phase-breaking spell must still show its own effect, alongside the victory or phase transition. Resuming a saved fight does not replay old spell animations. The supplied visual reference informed the atmosphere; its image and the Instagram video are not bundled.

## Production

```bash
npm run build
npm run preview
```

Deploy `dist/` to any static host. The app uses no client-side path routing. Serve the root document and bundled assets over HTTP(S); opening `index.html` directly through `file://` is not supported.

The current save key is `dungeons-and-scrolls.save.v3`. If absent, the loader checks version 2 and then version 1. It validates each legacy shape before migration, preserves the current floor route, RNG, resources, combat conditions, pending interactions, preferences, and records, and retains the old keys as backups. New fields initialize safely; past legacy NPC encounters are conservatively marked as having used their free help. Migration does not invent earlier-floor routes or claim unprovable victories.

Version 3 persists personalization, follows, bounded recipient boosts, up to 240 conversation entries, active visits, travel/reward ledgers, and read-only encounter history. Current-run pending return gifts are retained even when older messages are trimmed. Newer saves take priority; corrupt saves are never silently replaced with an older version. Writes validate the complete save and report inconsistencies or storage failures instead of claiming success.

Saves are local to the browser's origin, so different ports or deployment hosts have separate adventures. There is no server authority or anti-cheat mechanism in this prototype.
