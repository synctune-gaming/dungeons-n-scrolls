import { CLASSES, getBossPattern, getDialogue, getEnemyPattern, getRegion, INTENTS, RELICS, ROOMS, SPELLS } from './content'
import { INSCRIPTION_ROOM_IDS, RELIC_IDS } from './types'
import type { Choice, ClassId, Combat, EffectType, GameAction, GameState, RelicId, RoomId, SpellId } from './types'

function random(rng: number): [number, number] {
  const next = (rng + 0x6d2b79f5) >>> 0
  let value = Math.imul(next ^ (next >>> 15), next | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return [next, ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296]
}

function roll(game: GameState, min: number, max: number): [GameState, number] {
  const [rng, value] = random(game.rng)
  return [{ ...game, rng }, min + Math.floor(value * (max - min + 1))]
}

function buildDeck(floor: number, seed: number): [RoomId[], number] {
  const region = getRegion(floor)
  const entrance = region.rooms[0]
  if (!entrance) throw new Error(`Floor ${floor} has no entrance.`)
  const middle = region.rooms.slice(1, -1)
  let rng = seed
  for (let index = middle.length - 1; index > 0; index -= 1) {
    const result = random(rng)
    rng = result[0]
    const target = Math.floor(result[1] * (index + 1))
    const current = middle[index]
    const other = middle[target]
    if (!current || !other) throw new Error('The adventure route could not be shuffled.')
    middle[index] = other
    middle[target] = current
  }
  return [[entrance, ...middle, region.boss], rng]
}

export function createRun(seed: number, classId: ClassId = 'wanderer', runNumber = 1): GameState {
  const normalizedSeed = seed >>> 0
  const [deck, rng] = buildDeck(1, normalizedSeed)
  const stats = CLASSES[classId].stats
  const maxMana = 16 + stats.wisdom * 2
  return {
    seed: normalizedSeed, rng, runNumber, floor: 1, roomIndex: 0, deck,
    status: 'active', roomsCleared: 0, studied: false, puzzle: null,
    discovered: ['ashen-gate'], searched: [], combat: null, dialogue: false, omen: null,
    feedback: { id: 0, type: 'travel', enemyDamage: 0, playerDamage: 0, healing: 0, text: 'Your story begins.' },
    player: {
      classId, ...stats, health: stats.maxHealth,
      gold: 38, xp: 0, level: 1, potions: 2, relics: [],
      mana: maxMana, maxMana, aether: 1,
    },
    journal: [{
      id: 1, tone: 'info',
      text: 'Your story begins in the Ashen Woods. The forgotten gate lies ahead.',
    }],
  }
}

export function getRoom(game: GameState) {
  const id = game.deck[game.roomIndex]
  if (!id) throw new Error(`No room exists at position ${game.roomIndex}.`)
  return ROOMS[id]
}

export function getRoomPresentation(game: GameState) {
  const room = getRoom(game)
  const known = game.discovered.includes(room.id) || (room.kind !== 'combat' && room.kind !== 'boss')
  return {
    known,
    name: known ? room.name : room.kind === 'boss' ? 'A breath behind the gate' : 'A shape in the dark',
    description: known ? room.description : 'Two lights blink in the darkness. Raise your lantern, or trust the blade in your hand.',
  }
}

export function experienceTarget(level: number) {
  return level * 12
}

function log(game: GameState, text: string, tone: 'info' | 'good' | 'danger' = 'info'): GameState {
  return {
    ...game,
    journal: [...game.journal, { id: (game.journal.at(-1)?.id ?? 0) + 1, text, tone }].slice(-30),
  }
}

function hurt(game: GameState, amount: number): GameState {
  const health = Math.max(0, game.player.health - amount)
  const next = { ...game, player: { ...game.player, health } }
  if (health > 0) return next
  return log({ ...next, status: 'dead', puzzle: null, combat: null, dialogue: false, omen: null }, 'Your light goes out. The dungeon keeps its secrets.', 'danger')
}

function heal(game: GameState, amount: number): GameState {
  return {
    ...game,
    player: { ...game.player, health: Math.min(game.player.maxHealth, game.player.health + amount) },
  }
}

function restoreMana(game: GameState, amount: number): GameState {
  return { ...game, player: { ...game.player, mana: Math.min(game.player.maxMana, game.player.mana + amount) } }
}

function gainWisdom(game: GameState): GameState {
  const wisdom = Math.min(100, game.player.wisdom + 1)
  const capacity = (wisdom - game.player.wisdom) * 2
  return {
    ...game,
    player: { ...game.player, wisdom, maxMana: game.player.maxMana + capacity, mana: game.player.mana + capacity },
  }
}

function gainXp(game: GameState, amount: number): GameState {
  let next = { ...game, player: { ...game.player, xp: game.player.xp + amount } }
  while (next.player.level < 10 && next.player.xp >= experienceTarget(next.player.level)) {
    const player = next.player
    const level = player.level + 1
    next = {
      ...next,
      player: {
        ...player,
        xp: player.xp - experienceTarget(player.level),
        level, strength: Math.min(100, player.strength + 1),
        dexterity: Math.min(100, player.dexterity + (level % 2 === 0 ? 1 : 0)),
        maxHealth: player.maxHealth + 6,
        health: Math.min(player.maxHealth + 6, player.health + 6),
        maxMana: player.maxMana + 2,
        mana: Math.min(player.maxMana + 2, player.mana + 4),
      },
    }
    next = log(next, `Level ${level}. +1 strength, +6 max health, +2 max mana${level % 2 === 0 ? ', +1 dexterity' : ''}.`, 'good')
  }
  return next
}

function equipRelic(game: GameState, id: RelicId): GameState {
  if (game.player.relics.includes(id)) return game
  const player = { ...game.player, relics: [...game.player.relics, id] }
  if (id === 'iron-charm') {
    player.maxHealth += 8
    player.health += 8
  }
  if (id === 'fleet-feather') player.dexterity = Math.min(100, player.dexterity + 2)
  if (id === 'ember-stone') player.strength = Math.min(100, player.strength + 2)
  return { ...game, player }
}

function advance(game: GameState): GameState {
  if (game.status !== 'active') return game
  const next: GameState = { ...game, roomsCleared: game.roomsCleared + 1, puzzle: null, studied: false, combat: null, dialogue: false, omen: null }
  if (getRoom(game).kind === 'boss') {
    if (game.floor === 3) {
      return log({ ...next, status: 'won' }, 'The final gate opens. You made it out, with a story worth telling.', 'good')
    }
    const floor = game.floor + 1
    const [deck, rng] = buildDeck(floor, game.rng)
    const entrance = deck[0]
    if (!entrance) throw new Error('The new region has no entrance.')
    return log(
      restoreMana(heal({ ...next, floor, deck, rng, roomIndex: 0, discovered: [...next.discovered, entrance] }, 10), 8),
      `You reach ${getRegion(floor).name}. Fresh air restores up to 10 health and 8 mana.`,
      'good',
    )
  }
  if (game.roomIndex + 1 >= game.deck.length) {
    throw new Error('The adventure route ended without its boss encounter.')
  }
  const roomIndex = game.roomIndex + 1
  const id = game.deck[roomIndex]
  if (!id) throw new Error('The next room is missing from the route.')
  const room = ROOMS[id]
  const discovered = room.kind !== 'combat' && room.kind !== 'boss' && !next.discovered.includes(id)
    ? [...next.discovered, id] : next.discovered
  return { ...next, roomIndex, discovered }
}

function drinkPotion(game: GameState): GameState {
  if (game.player.potions === 0) return log(game, 'No tonics left. Look for a shop or a safe haven.', 'danger')
  if (game.player.health === game.player.maxHealth) return log(game, 'You are already at full health. Keep that tonic for later.')
  const restored = Math.min(24, game.player.maxHealth - game.player.health)
  return log(
    heal({ ...game, player: { ...game.player, potions: game.player.potions - 1 } }, 24),
    `A healing tonic restores ${restored} health.`, 'good',
  )
}

function openChest(game: GameState): GameState {
  let [next, gold] = roll(game, 20, 35)
  gold *= game.floor
  next = { ...next, player: { ...next.player, gold: next.player.gold + gold }, puzzle: null }
  const available = RELIC_IDS.filter((id) => !next.player.relics.includes(id))
  let treasure = `${gold} gold`
  if (available.length > 0) {
    const [rolled, index] = roll(next, 0, available.length - 1)
    const relic = available[index]
    if (!relic) throw new Error('The chest contains an unknown relic.')
    next = equipRelic(rolled, relic)
    treasure += ` and ${RELICS[relic].name.toLowerCase()}`
  }
  return advance(gainXp(log(next, `Chest opened. You found ${treasure}.`, 'good'), 6))
}

function startBattle(game: GameState): GameState {
  const room = getRoom(game)
  if (room.kind !== 'combat' && room.kind !== 'boss') throw new Error('This room has no enemy to fight.')
  const intent = getEnemyPattern(room, 1)[0]
  if (!intent) throw new Error('The enemy has no opening intention.')
  const combat: Combat = {
    roomId: room.id, health: room.enemy.health, maxHealth: room.enemy.health,
    turn: 0, phase: 1, intent, intentIndex: 0, result: 'fighting',
    burnTurns: 0, frozenTurns: 0, ward: 0, opening: 0,
  }
  return log({
    ...game, combat,
    discovered: game.discovered.includes(room.id) ? game.discovered : [...game.discovered, room.id],
  }, `${room.name} steps into the light. ${INTENTS[intent].description}`)
}

function defeatEnemy(game: GameState): GameState {
  const room = getRoom(game)
  if (!game.combat || room.kind !== 'combat' && room.kind !== 'boss') throw new Error('There is no enemy to defeat.')
  if (game.combat.result === 'victory') return game
  const [rewarded, bonus] = roll(game, 0, 6)
  const gold = room.enemy.gold + bonus
  const next: GameState = {
    ...rewarded,
    player: { ...rewarded.player, gold: rewarded.player.gold + gold },
    combat: { ...game.combat, health: 0, result: 'victory', burnTurns: 0, frozenTurns: 0 },
  }
  return gainXp(log(next, `${room.name} defeated. +${gold} gold, +${room.enemy.xp} XP. The path is yours.`, 'good'), room.enemy.xp)
}

function damageEnemy(game: GameState, damage: number): GameState {
  const combat = game.combat
  if (!combat || combat.result !== 'fighting') throw new Error('There is no active enemy to damage.')
  const room = getRoom(game)
  let health = Math.max(0, combat.health - damage)
  let phase = combat.phase
  let next = game
  if (room.kind === 'boss' && phase === 1 && health <= Math.ceil(combat.maxHealth / 2)) {
    health = Math.max(Math.ceil(combat.maxHealth / 2), health)
    phase = 2
    next = log(next, getBossPattern(room.id).transition, 'danger')
  }
  next = { ...next, combat: { ...combat, health, phase } }
  return health === 0 ? defeatEnemy(next) : next
}

function finishTurn(game: GameState, previousPhase: 1 | 2, defense: 'guard' | 'dodge' | 'none' = 'none', newBurn = false): GameState {
  let next = game
  let combat = next.combat
  if (!combat) return next
  if (combat.result === 'victory') return { ...next, combat: { ...combat, turn: combat.turn + 1 } }
  const room = getRoom(next)
  if (room.kind !== 'combat' && room.kind !== 'boss') throw new Error('An enemy turn has no enemy.')
  if (combat.burnTurns > 0 && !newBurn) {
    next = damageEnemy({ ...next, combat: { ...combat, burnTurns: combat.burnTurns - 1 } }, 3 + next.floor)
    next = log(next, 'The lingering embers bite again.', 'good')
    combat = next.combat
    if (!combat) return next
    if (combat.result === 'victory') return { ...next, combat: { ...combat, turn: combat.turn + 1 } }
  }
  const phaseBreak = combat.phase !== previousPhase
  if (phaseBreak) {
    next = log(next, 'A second presence wakes. Read its next move before you strike again.', 'danger')
  } else if (combat.frozenTurns > 0) {
    next = log({ ...next, combat: { ...combat, frozenTurns: combat.frozenTurns - 1 } }, 'The frost holds. Its attack never comes.', 'good')
  } else if (combat.intent === 'recover' || combat.intent === 'brace') {
    next = log(next, combat.intent === 'recover' ? 'It catches its breath. You have an opening.' : 'It raises its guard. Magic can slip through.')
  } else {
    const [rolled, variation] = roll(next, 1, 3)
    next = rolled
    const armor = next.player.relics.includes('iron-charm') ? 2 : 0
    const pressure = Math.floor(combat.turn / 6)
    let damage = Math.max(3, Math.ceil(room.enemy.attack * 0.4) + next.floor + variation + pressure
      + (combat.phase === 2 ? 2 : 0) - Math.floor(next.player.strength * 0.15) - armor)
    if (combat.intent === 'heavy') damage = Math.ceil(damage * 1.6)
    if (combat.intent === 'hex') damage += 2
    if (defense === 'guard') {
      damage = Math.max(1, Math.ceil(damage * (combat.intent === 'hex' ? 0.55 : 0.3)))
      if (combat.intent !== 'hex') {
        combat = { ...combat, opening: Math.min(30, 3 + Math.floor(next.player.wisdom / 3)) }
        next = { ...next, combat }
      }
    }
    if (defense === 'dodge') {
      const [dodged, chance] = roll(next, 1, 6)
      next = dodged
      if (combat.intent !== 'hex' && next.player.dexterity + chance >= 9 + next.floor) {
        damage = 0
        next = restoreMana({ ...next, combat: { ...combat, opening: 3 } }, 2)
        next = log(next, 'You step out of the strike. A counterattack is waiting.', 'good')
      } else {
        next = log(next, combat.intent === 'hex' ? 'A curse follows you through the dodge.' : 'You move too late.', 'danger')
      }
    }
    const ward = next.combat?.ward ?? 0
    const absorbed = Math.min(ward, damage)
    if (absorbed > 0 && next.combat) {
      next = log({ ...next, combat: { ...next.combat, ward: ward - absorbed } }, `Your ward absorbs ${absorbed} damage.`, 'good')
    }
    damage -= absorbed
    next = hurt(next, damage)
    if (next.status === 'dead') return next
    if (damage > 0) next = log(next, `${room.name}: ${INTENTS[combat.intent].name.toLowerCase()}. -${damage} health.`, 'danger')
  }
  const current = next.combat
  if (!current || current.result !== 'fighting') return next
  const pattern = getEnemyPattern(room, current.phase)
  const intentIndex = phaseBreak ? 0 : (current.intentIndex + 1) % pattern.length
  const intent = pattern[intentIndex]
  if (!intent) throw new Error('The enemy has no next intention.')
  return { ...next, combat: { ...current, turn: current.turn + 1, intentIndex, intent } }
}

function attack(game: GameState): GameState {
  const combat = game.combat
  const room = getRoom(game)
  if (!combat || room.kind !== 'combat' && room.kind !== 'boss') throw new Error('There is no enemy to strike.')
  const [rolled, variation] = roll(game, 0, 3)
  let damage = Math.max(4, game.player.strength + 3 + variation - Math.floor(room.enemy.defense / 3))
  damage += combat.opening + (game.studied ? 2 + Math.floor(game.player.wisdom / 4) : 0)
  if (combat.intent === 'brace') damage = Math.max(2, Math.floor(damage / 2))
  const struck = damageEnemy({ ...rolled, combat: { ...combat, opening: 0 } }, damage)
  const dealt = combat.health - (struck.combat?.health ?? 0)
  return finishTurn(log(struck, `Your blade deals ${dealt} damage.`, 'good'), combat.phase)
}

export function spellUnavailable(game: GameState, spell: SpellId): string | null {
  if (game.status !== 'active') return 'This adventure has ended.'
  if (game.puzzle || game.dialogue || game.omen) return 'Finish this interaction first.'
  const active = game.combat?.result === 'fighting'
  if (spell !== 'mending-light' && !active) return 'Find a foe before casting this spell.'
  if (spell === 'mending-light' && game.player.health === game.player.maxHealth) return 'You are already at full health.'
  if (spell === 'frost-bind' && (game.combat?.frozenTurns ?? 0) > 0) return 'The foe is already frozen.'
  if (game.player.mana < SPELLS[spell].cost) return `You need ${SPELLS[spell].cost} mana to cast ${SPELLS[spell].name.toLowerCase()}.`
  return null
}

function castSpell(game: GameState, spell: SpellId): GameState {
  const reason = spellUnavailable(game, spell)
  if (reason) return log(game, reason, 'danger')
  const definition = SPELLS[spell]
  let next = { ...game, player: { ...game.player, mana: game.player.mana - definition.cost } }
  const combat = next.combat
  if (spell === 'mending-light') {
    next = log(heal(next, 10 + next.player.wisdom * 2), 'Mending light knits your wounds closed.', 'good')
    return combat?.result === 'fighting' ? finishTurn(next, combat.phase) : next
  }
  if (!combat) throw new Error('An offensive spell has no combat state.')
  if (spell === 'arcane-ward') {
    return finishTurn(log({ ...next, combat: { ...combat, ward: 14 + next.player.wisdom } }, 'An arcane ward settles around your blade.', 'good'), combat.phase)
  }
  const room = getRoom(next)
  if (room.kind !== 'combat' && room.kind !== 'boss') throw new Error('An offensive spell has no enemy.')
  const bonus = room.enemy.weakness === definition.element ? 5 : 0
  const damage = (spell === 'ember-bolt' ? 12 : spell === 'storm-lance' ? 15 : 7) + next.player.wisdom + bonus
  next = {
    ...next,
    combat: {
      ...combat,
      burnTurns: spell === 'ember-bolt' ? 2 : combat.burnTurns,
      frozenTurns: spell === 'frost-bind' ? 2 : combat.frozenTurns,
    },
  }
  next = damageEnemy(next, damage)
  next = log(next, `${definition.name} deals ${combat.health - (next.combat?.health ?? 0)} damage${bonus ? '. Its weakness answers the spell' : ''}.`, 'good')
  return finishTurn(next, combat.phase, 'none', spell === 'ember-bolt')
}

function flee(game: GameState): GameState {
  const room = getRoom(game)
  if (room.kind === 'boss') return log(game, 'You cannot escape this guardian. Read its intention and stand your ground.', 'danger')
  if (room.kind !== 'combat') return log(game, 'There is no fight to escape here.')
  const [next, damage] = roll(game, 3, 6)
  const escaped = hurt(next, damage)
  if (escaped.status === 'dead') return escaped
  const name = game.discovered.includes(room.id) ? room.name.toLowerCase() : 'the unseen presence'
  return advance(log(escaped, `You escape ${name}. -${damage} health.`, 'danger'))
}

function revealFoe(game: GameState): GameState {
  const room = getRoom(game)
  if (room.kind !== 'combat' && room.kind !== 'boss') return log(game, 'The lantern finds no hidden foe here.')
  if (game.discovered.includes(room.id)) return log(game, 'You have already brought this presence into the light.')
  if (game.player.mana < 2) return log(game, 'You need 2 mana to kindle the revealing lantern.', 'danger')
  return log({
    ...game,
    discovered: [...game.discovered, room.id],
    player: { ...game.player, mana: game.player.mana - 2 },
  }, `The lantern reveals ${room.name}. Its weakness is ${room.enemy.weakness}.`, 'good')
}

function studyEnemy(game: GameState): GameState {
  const room = getRoom(game)
  if (room.kind !== 'combat' && room.kind !== 'boss') return log(game, 'There is no foe to study here.')
  if (game.combat?.result === 'victory') return log(game, 'The foe is already fallen. Your path is clear.')
  if (!game.discovered.includes(room.id)) return revealFoe(game)
  if (game.studied) return log(game, 'You already found the weakness. Time to act.')
  if (game.player.mana < 3) return log(game, 'You need 3 mana to study this weakness.', 'danger')
  const next = log({
    ...game, studied: true,
    player: { ...game.player, mana: game.player.mana - 3 },
  }, `A weakness in the ${room.enemy.weakness} sigil. Your strikes will hit harder.`, 'good')
  return game.combat ? finishTurn(next, game.combat.phase) : next
}

export function getChoices(game: GameState): Choice[] {
  if (game.status !== 'active') return []
  const room = getRoom(game)
  const known = game.discovered.includes(room.id)
  const { strength, dexterity, wisdom, gold, health, maxHealth, potions, relics } = game.player
  if (game.combat?.result === 'victory') {
    return [{ direction: 'up', label: 'Continue', hint: 'Loot collected. A new path awaits.' }]
  }
  if (game.combat) {
    return [
      { direction: 'left', label: 'Guard', hint: 'Block damage / +3 mana' },
      { direction: 'up', label: 'Strike', hint: `STR ${strength}${game.combat.opening ? ' / Counter ready' : ''}` },
      { direction: 'right', label: 'Dodge', hint: `DEX ${dexterity}` },
    ]
  }
  switch (room.kind) {
    case 'passage': return [
      { direction: 'left', label: 'Take the trail', hint: 'Scout ahead' },
      { direction: 'up', label: 'Enter the gate', hint: 'Explore' },
      { direction: 'right', label: 'Search the ruins', hint: 'Find gold' },
    ]
    case 'combat': return [
      { direction: 'left', label: known ? 'Sneak past' : 'Slip past', hint: `DEX ${dexterity}` },
      { direction: 'up', label: known ? 'Begin the fight' : 'Draw your blade', hint: 'Meet what waits' },
      { direction: 'right', label: known ? 'Escape' : 'Raise the lantern', hint: known ? 'Lose some health' : 'Reveal / 2 mana', disabled: !known && game.player.mana < 2 },
    ]
    case 'npc': return [
      { direction: 'left', label: 'Talk', hint: `WIT ${wisdom}` },
      { direction: 'up', label: 'Move on', hint: 'Keep exploring' },
      { direction: 'right', label: 'Trade', hint: potions >= 1000 ? 'Satchel full' : 'Tonic / 20 gold', disabled: gold < 20 || potions >= 1000 },
    ]
    case 'treasure': return [
      { direction: 'left', label: 'Leave it', hint: 'Keep exploring' },
      { direction: 'up', label: 'Open the chest', hint: dexterity >= 8 ? 'Lockpick / DEX 8+' : 'Solve the rune lock' },
      { direction: 'right', label: 'Force the lock', hint: strength >= 9 ? 'STR 9+ / Safe' : 'Costs 6 health' },
    ]
    case 'shop': return [
      { direction: 'left', label: 'Buy a tonic', hint: '15 gold', disabled: gold < 15 || potions >= 1000 },
      { direction: 'up', label: 'Keep moving', hint: 'Leave the shop' },
      { direction: 'right', label: 'Buy iron charm', hint: relics.includes('iron-charm') ? 'Already equipped' : '30 gold', disabled: gold < 30 || relics.includes('iron-charm') },
    ]
    case 'shrine': return [
      { direction: 'left', label: 'Take a blessing', hint: '+1 STR / -5 health' },
      { direction: 'up', label: 'Drink from the well', hint: `Restore ${16 + game.floor * 4} health` },
      { direction: 'right', label: 'Make an offering', hint: '+28 health / 10 gold', disabled: gold < 10 },
    ]
    case 'boss': return [
      { direction: 'left', label: 'Drink a tonic', hint: `${potions} remaining`, disabled: potions === 0 || health === maxHealth },
      { direction: 'up', label: known ? 'Challenge the boss' : 'Approach the presence', hint: 'There is no way around' },
      { direction: 'right', label: known ? 'Study weakness' : 'Raise the lantern', hint: game.studied ? 'Weakness found' : known ? `WIT ${wisdom} / 3 mana` : 'Reveal / 2 mana', disabled: game.studied || game.player.mana < (known ? 3 : 2) },
    ]
  }
}

function resolveAction(game: GameState, action: GameAction): GameState {
  if (game.status !== 'active') return game
  if (action.type === 'CLOSE_PUZZLE') return game.puzzle ? { ...game, puzzle: null } : game
  if (action.type === 'CLOSE_DIALOGUE') return game.dialogue ? { ...game, dialogue: false } : game
  if (action.type === 'RESPOND_NPC') {
    if (!game.dialogue) return game
    let next: GameState = { ...game, dialogue: false }
    if (action.response === 'rumor') {
      next = gainWisdom(next)
      return advance(gainXp(log(next, getDialogue(getRoom(game).id).clue, 'good'), 4))
    }
    if (action.response === 'rest') {
      return advance(gainXp(log(restoreMana(heal(next, 12 + game.player.wisdom), 8), 'A shared fire, a quieter heart. Your wounds and magic recover.', 'good'), 4))
    }
    if (game.player.gold < 20) return log(game, 'You need 20 gold for the offered supplies.', 'danger')
    if (game.player.potions >= 1000) return log(game, 'Your satchel cannot hold another tonic.', 'danger')
    next = restoreMana({ ...next, player: { ...next.player, gold: next.player.gold - 20, potions: next.player.potions + 1 } }, 4)
    return advance(log(next, 'The stranger leaves you a tonic and a little magic for the road. -20 gold.', 'good'))
  }
  if (action.type === 'RESOLVE_OMEN') {
    const omen = game.omen
    if (!omen) return game
    let next: GameState = { ...game, omen: null }
    if (!action.accept) return log(next, 'You leave the inscription and its bargain untouched.')
    next = hurt(next, 4)
    if (next.status === 'dead') return next
    if (omen.outcome === 0) {
      return log({ ...next, player: { ...next.player, strength: Math.min(100, next.player.strength + 1), gold: next.player.gold + 12 } }, 'The stone grants a fierce blessing. -4 health, +1 strength, +12 gold.', 'good')
    }
    if (omen.outcome === 1) {
      return log(restoreMana(gainWisdom(next), 8), 'A forgotten word enters your thoughts. -4 health, +1 wisdom, restored mana.', 'good')
    }
    next = hurt(next, 10)
    if (next.status === 'dead') return next
    return log({ ...next, player: { ...next.player, gold: next.player.gold + 5 } }, 'The inscription bites back. -14 health, +5 gold. Not every promise is a gift.', 'danger')
  }
  if (action.type === 'PICK_RUNE') {
    if (!game.puzzle) return game
    const puzzle = game.puzzle
    if (action.rune === puzzle.combination[puzzle.progress]) {
      if (puzzle.progress === 2) return openChest(game)
      return { ...game, puzzle: { ...puzzle, progress: puzzle.progress + 1 } }
    }
    let next = hurt(game, 4)
    if (next.status === 'dead') return next
    if (puzzle.mistakes === 2) {
      return advance(log({ ...next, puzzle: null }, 'The rune lock jams. -4 health. The chest stays behind.', 'danger'))
    }
    next = { ...next, puzzle: { ...puzzle, progress: 0, mistakes: puzzle.mistakes + 1 } }
    return log(next, 'Wrong rune. -4 health. Try the sequence again.', 'danger')
  }
  if (game.puzzle || game.dialogue || game.omen) return game
  if (action.type === 'CAST_SPELL') return castSpell(game, action.spell)
  if (action.type === 'DRINK_POTION') {
    const next = drinkPotion(game)
    return game.combat?.result === 'fighting' && next.player.potions < game.player.potions ? finishTurn(next, game.combat.phase) : next
  }
  if (action.type === 'DRINK_AETHER') {
    if (game.player.aether === 0) return log(game, 'No aether vials left. Look for a merchant or a well.', 'danger')
    if (game.player.mana === game.player.maxMana) return log(game, 'Your mana is already full. Save the vial.')
    const next = log(restoreMana({ ...game, player: { ...game.player, aether: game.player.aether - 1 } }, 14), 'An aether vial restores up to 14 mana.', 'good')
    return game.combat?.result === 'fighting' ? finishTurn(next, game.combat.phase) : next
  }
  if (action.type === 'FLEE') return flee(game)
  if (action.type === 'STUDY_ENEMY') return studyEnemy(game)
  if (action.type === 'BUY_AETHER') {
    if (getRoom(game).kind !== 'shop') return log(game, 'Aether vials are sold by merchants.', 'danger')
    if (game.player.gold < 12) return log(game, 'You need 12 gold for an aether vial.', 'danger')
    if (game.player.aether >= 1000) return log(game, 'Your satchel cannot hold another aether vial.', 'danger')
    return log({ ...game, player: { ...game.player, gold: game.player.gold - 12, aether: game.player.aether + 1 } }, 'Aether vial purchased. -12 gold, +1 vial.', 'good')
  }
  if (action.type === 'INSPECT_INSCRIPTION') {
    const roomId = INSCRIPTION_ROOM_IDS.find((id) => id === getRoom(game).id)
    if (!roomId) return log(game, 'There is no hidden inscription in this room.')
    if (game.searched.includes(roomId)) return log(game, 'You already read this inscription. Its bargain cannot be repeated.')
    const [next, outcome] = roll(game, 0, 2)
    return log({ ...next, searched: [...next.searched, roomId], omen: { roomId, outcome } }, 'A hidden inscription answers your lantern. It offers a bargain.')
  }
  if (game.combat) {
    if (game.combat.result === 'victory') {
      return action.direction === 'up' ? advance(game) : log(game, 'The path is clear. Swipe up to continue.')
    }
    if (action.direction === 'up') return attack(game)
    if (action.direction === 'left') {
      return finishTurn(log(restoreMana(game, 3), 'You raise your guard and gather a little magic.'), game.combat.phase, 'guard')
    }
    return finishTurn(game, game.combat.phase, 'dodge')
  }
  const room = getRoom(game)
  const { direction } = action
  switch (room.kind) {
    case 'passage': {
      if (direction === 'right') {
        const [next, gold] = roll(game, 5, 12)
        return advance(gainXp(log(
          { ...next, player: { ...next.player, gold: next.player.gold + gold } },
          `A loose stone hides ${gold} gold. The path leads onward.`, 'good',
        ), 2))
      }
      return advance(gainXp(log(
        game,
        direction === 'up' ? 'You step through the gate. Somewhere below, a torch is still burning.' : 'You scout the old trail and find a way into the keep.',
      ), direction === 'up' ? 2 : 3))
    }
    case 'combat': {
      if (direction === 'up') return startBattle(game)
      if (direction === 'right') return game.discovered.includes(room.id) ? flee(game) : revealFoe(game)
      const [next, chance] = roll(game, 1, 6)
      const name = game.discovered.includes(room.id) ? room.name.toLowerCase() : 'the unseen presence'
      if (game.player.dexterity + chance >= room.enemy.defense + 4) {
        return advance(gainXp(log(next, `You slip past ${name} without a sound.`, 'good'), 3))
      }
      const damage = Math.ceil(room.enemy.attack / 2)
      const spotted = hurt(startBattle(next), damage)
      return spotted.status === 'dead' ? spotted : log(spotted, `Your footsteps betray you. -${damage} health. You must fight or flee.`, 'danger')
    }
    case 'npc': {
      if (direction === 'up') return advance(log(game, 'You exchange a nod and follow the road.'))
      if (direction === 'right') {
        if (game.player.gold < 20) return log(game, 'You need 20 gold to trade for a tonic.', 'danger')
        if (game.player.potions >= 1000) return log(game, 'Your satchel cannot hold another tonic.', 'danger')
        return advance(log({ ...game, player: { ...game.player, gold: game.player.gold - 20, potions: game.player.potions + 1 } }, 'A fair trade. -20 gold, +1 healing tonic.', 'good'))
      }
      return log({ ...game, dialogue: true }, 'The stranger makes room by the fire. What will you ask?')
    }
    case 'treasure': {
      if (direction === 'left') return advance(log(game, 'You leave the chest and its secrets behind.'))
      if (direction === 'right') {
        const damage = game.player.strength >= 9 ? 0 : 6
        const next = hurt(game, damage)
        if (next.status === 'dead') return next
        return openChest(log(next, damage ? 'The lock breaks. So does a little skin. -6 health.' : 'A firm strike breaks the lock.'))
      }
      if (game.player.dexterity >= 8) return openChest(game)
      const [next, permutation] = roll(game, 0, 2)
      const combinations = [
        ['moon', 'flame', 'eye'],
        ['eye', 'moon', 'flame'],
        ['flame', 'eye', 'moon'],
      ] as const
      const combination = combinations[permutation]
      if (!combination) throw new Error('The rune lock has no combination.')
      return { ...next, puzzle: { combination: [...combination], progress: 0, mistakes: 0 } }
    }
    case 'shop': {
      if (direction === 'up') return advance(log(game, 'You leave the lantern glow and follow the path.'))
      if (direction === 'left') {
        if (game.player.gold < 15) return log(game, 'You need 15 gold to buy a healing tonic.', 'danger')
        if (game.player.potions >= 1000) return log(game, 'Your satchel cannot hold another tonic.', 'danger')
        return log({ ...game, player: { ...game.player, gold: game.player.gold - 15, potions: game.player.potions + 1 } }, 'Healing tonic purchased. -15 gold, +1 tonic.', 'good')
      }
      if (game.player.relics.includes('iron-charm')) return log(game, 'Your iron charm is already equipped.')
      if (game.player.gold < 30) return log(game, 'You need 30 gold to buy the iron charm.', 'danger')
      return log(equipRelic({ ...game, player: { ...game.player, gold: game.player.gold - 30 } }, 'iron-charm'), 'Iron charm equipped. -30 gold, +8 max health, +2 armor.', 'good')
    }
    case 'shrine': {
      if (direction === 'left') {
        const next = hurt(game, 5)
        if (next.status === 'dead') return next
        return advance(log({ ...next, player: { ...next.player, strength: Math.min(100, next.player.strength + 1) } }, 'The well grants a blessing. +1 strength, -5 health.', 'good'))
      }
      if (direction === 'right') {
        if (game.player.gold < 10) return log(game, 'You need 10 gold to make an offering.', 'danger')
        return advance(gainXp(log(restoreMana(heal({ ...game, player: { ...game.player, gold: game.player.gold - 10 } }, 28), game.player.maxMana), 'The well accepts your offering. -10 gold, restored health and mana.', 'good'), 5))
      }
      return advance(gainXp(log(restoreMana(heal(game, 16 + game.floor * 4), game.player.maxMana), 'The quiet water restores your health and all your mana. +3 XP.', 'good'), 3))
    }
    case 'boss': {
      if (direction === 'up') return startBattle(game)
      if (direction === 'left') return drinkPotion(game)
      return studyEnemy(game)
    }
  }
}

function effectFor(before: GameState, after: GameState, action: GameAction): EffectType {
  if (after.floor !== before.floor || after.roomIndex !== before.roomIndex) return 'travel'
  if (after.combat?.result === 'victory' && before.combat?.result !== 'victory') return 'victory'
  if (after.combat?.phase === 2 && before.combat?.phase === 1) return 'phase'
  if (after.discovered.length > before.discovered.length) return 'reveal'
  if (action.type === 'CAST_SPELL' && !spellUnavailable(before, action.spell)) {
    const types: Record<SpellId, EffectType> = {
      'ember-bolt': 'ember', 'frost-bind': 'frost', 'storm-lance': 'storm', 'arcane-ward': 'ward', 'mending-light': 'heal',
    }
    return types[action.spell]
  }
  if (action.type === 'DRINK_POTION' && after.player.potions < before.player.potions) return 'heal'
  if (action.type === 'DRINK_AETHER' && after.player.aether < before.player.aether) return 'ward'
  if (action.type === 'RESOLVE_OMEN' || action.type === 'INSPECT_INSCRIPTION') return 'secret'
  if (action.type === 'CHOOSE' && before.combat?.result === 'fighting') {
    return action.direction === 'up' ? 'strike' : action.direction === 'left' ? 'guard' : 'dodge'
  }
  return 'info'
}

export function gameReducer(game: GameState, action: GameAction): GameState {
  const next = resolveAction(game, action)
  if (next === game) return game
  const lastId = game.journal.at(-1)?.id ?? 0
  const text = next.journal.filter((entry) => entry.id > lastId).map((entry) => entry.text).join(' ').slice(0, 500)
  return {
    ...next,
    feedback: {
      id: game.feedback.id + 1,
      type: effectFor(game, next, action),
      enemyDamage: game.combat && next.combat ? Math.max(0, game.combat.health - next.combat.health) : 0,
      playerDamage: Math.max(0, game.player.health - next.player.health),
      healing: Math.max(0, next.player.health - game.player.health),
      text,
    },
  }
}
