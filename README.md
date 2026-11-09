# Dungeons & Scrolls

A first-person, pixel-art roguelike that moves like your feed. Scroll into the next room, swipe to make a choice, and see whether the dungeon gives you treasure or a new reason to start over.

Three classes, five spells, twelve rooms per floor, and guardians with a second phase. Light foes and tougher monsters need different tactics; unidentified encounters stay hidden until discovered. Animated pixel scenes bring each seeded run to life.

Personalize your hero, follow fictional adventurers, browse their stories, and search for playable city or NPC side trips every five dungeon rooms. Preset-only chats offer free useful gifts and up to three small return-gift boosts per run. Everything saves in your browser, with no accounts or multiplayer backend.

## Play locally

Use Node.js 22.12+ in the 22.x series, 24.x, or 26+. Node.js 26 is recommended.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, usually **http://localhost:5173**. The live dungeon fills the screen, with compact health/mana and encounter controls. Use **Timeline**, **Search**, and **Profile** to navigate, and **More** for stories, field notes, and settings. Swipe or scroll on the active encounter to make a choice; buttons and arrow keys work too.

## Docs

- [How to play](docs/gameplay.md)
- [Development, testing, and deployment](docs/development.md)
