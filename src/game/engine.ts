import { CLASSES, getRegion, RELICS, ROOMS } from './content'
import type { Choice, ClassId, GameAction, GameState, RelicId, RoomId } from './types'

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
  return {
    seed: normalizedSeed, rng, runNumber, floor: 1, roomIndex: 0, deck,
    status: 'active', roomsCleared: 0, studied: false, puzzle: null,
    player: {
      classId, ...stats, health: stats.maxHealth,
      gold: 38, xp: 0, level: 1, potions: 2, relics: [],
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
  return log({ ...next, status: 'dead', puzzle: null }, 'Your light goes out. The dungeon keeps its secrets.', 'danger')
}

function heal(game: GameState, amount: number): GameState {
  return {
    ...game,
    player: { ...game.player, health: Math.min(game.player.maxHealth, game.player.health + amount) },
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
        level, strength: player.strength + 1,
        dexterity: player.dexterity + (level % 2 === 0 ? 1 : 0),
        maxHealth: player.maxHealth + 6,
        health: Math.min(player.maxHealth + 6, player.health + 6),
      },
    }
    next = log(next, `Level ${level}. +1 strength, +6 max health${level % 2 === 0 ? ', +1 dexterity' : ''}.`, 'good')
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
  if (id === 'fleet-feather') player.dexterity += 2
  if (id === 'ember-stone') player.strength += 2
  return { ...game, player }
}

function advance(game: GameState): GameState {
  if (game.status !== 'active') return game
  const next = { ...game, roomsCleared: game.roomsCleared + 1, puzzle: null, studied: false }
  if (getRoom(game).kind === 'boss') {
    if (game.floor === 3) {
      return log({ ...next, status: 'won' }, 'The final gate opens. You made it out, with a story worth telling.', 'good')
    }
    const floor = game.floor + 1
    const [deck, rng] = buildDeck(floor, game.rng)
    return log(
      heal({ ...next, floor, deck, rng, roomIndex: 0 }, 10),
      `You reach ${getRegion(floor).name}. A breath of fresh air restores 10 health.`,
      'good',
    )
  }
  if (game.roomIndex + 1 >= game.deck.length) {
    throw new Error('The adventure route ended without its boss encounter.')
  }
  return { ...next, roomIndex: game.roomIndex + 1 }
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
  const available = (Object.keys(RELICS) as RelicId[]).filter((id) => !next.player.relics.includes(id))
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

function fight(game: GameState): GameState {
  const room = getRoom(game)
  if (room.kind !== 'combat' && room.kind !== 'boss') throw new Error('This room has no enemy to fight.')
  const [rolled, variation] = roll(game, 0, 4)
  const armor = game.player.relics.includes('iron-charm') ? 2 : 0
  const weakness = game.studied ? 3 + Math.floor(game.player.wisdom / 2) : 0
  const damage = Math.max(
    room.kind === 'boss' ? 6 : 2,
    room.enemy.attack + game.floor * 2 + variation
      - Math.floor(game.player.strength * 0.65)
      - Math.floor(game.player.dexterity * 0.25) - armor - weakness,
  )
  let next = hurt(rolled, damage)
  if (next.status === 'dead') return next
  const [rewarded, bonus] = roll(next, 0, 6)
  const gold = room.enemy.gold + bonus
  next = { ...rewarded, player: { ...rewarded.player, gold: rewarded.player.gold + gold } }
  return advance(gainXp(log(next, `${room.name} defeated. -${damage} health, +${gold} gold, +${room.enemy.xp} XP.`, 'good'), room.enemy.xp))
}

export function getChoices(game: GameState): Choice[] {
  if (game.status !== 'active') return []
  const room = getRoom(game)
  const { strength, dexterity, wisdom, gold, health, maxHealth, potions, relics } = game.player
  switch (room.kind) {
    case 'passage': return [
      { direction: 'left', label: 'Take the trail', hint: 'Scout ahead' },
      { direction: 'up', label: 'Enter the gate', hint: 'Explore' },
      { direction: 'right', label: 'Search the ruins', hint: 'Find gold' },
    ]
    case 'combat': return [
      { direction: 'left', label: 'Sneak past', hint: `DEX ${dexterity}` },
      { direction: 'up', label: 'Attack', hint: `STR ${strength}` },
      { direction: 'right', label: 'Escape', hint: 'Lose some health' },
    ]
    case 'npc': return [
      { direction: 'left', label: 'Talk', hint: `WIT ${wisdom}` },
      { direction: 'up', label: 'Move on', hint: 'Keep exploring' },
      { direction: 'right', label: 'Trade', hint: 'Tonic / 20 gold', disabled: gold < 20 },
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
      { direction: 'up', label: 'Challenge the boss', hint: `STR ${strength}` },
      { direction: 'right', label: 'Study weakness', hint: game.studied ? 'Weakness found' : `WIT ${wisdom} / -5 health`, disabled: game.studied },
    ]
  }
}

export function gameReducer(game: GameState, action: GameAction): GameState {
  if (game.status !== 'active') return game
  if (action.type === 'CLOSE_PUZZLE') return game.puzzle ? { ...game, puzzle: null } : game
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
  if (game.puzzle) return game
  if (action.type === 'DRINK_POTION') return drinkPotion(game)
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
      if (direction === 'up') return fight(game)
      const [next, chance] = roll(game, 1, 6)
      if (direction === 'left' && game.player.dexterity + chance >= room.enemy.defense + 4) {
        return advance(gainXp(log(next, `You slip past ${room.name.toLowerCase()} without a sound.`, 'good'), 3))
      }
      const damage = direction === 'right' ? chance + 1 : Math.ceil(room.enemy.attack / 2)
      const escaped = hurt(next, damage)
      if (escaped.status === 'dead') return escaped
      return advance(log(escaped, direction === 'right'
        ? `You escape ${room.name.toLowerCase()}. -${damage} health.`
        : `The ${room.name.toLowerCase()} spots you. You get away, but lose ${damage} health.`, 'danger'))
    }
    case 'npc': {
      if (direction === 'up') return advance(log(game, 'You exchange a nod and follow the road.'))
      if (direction === 'right') {
        if (game.player.gold < 20) return log(game, 'You need 20 gold to trade for a tonic.', 'danger')
        return advance(log({ ...game, player: { ...game.player, gold: game.player.gold - 20, potions: game.player.potions + 1 } }, 'A fair trade. -20 gold, +1 healing tonic.', 'good'))
      }
      const [next, gold] = roll(game, 6, 12)
      return advance(gainXp(log(heal(
        { ...next, player: { ...next.player, gold: next.player.gold + gold } }, game.player.wisdom,
      ), `A shared story, a little rest, and ${gold} gold for the road. +4 XP.`, 'good'), 4))
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
        return advance(log({ ...next, player: { ...next.player, strength: next.player.strength + 1 } }, 'The well grants a blessing. +1 strength, -5 health.', 'good'))
      }
      if (direction === 'right') {
        if (game.player.gold < 10) return log(game, 'You need 10 gold to make an offering.', 'danger')
        return advance(gainXp(log(heal({ ...game, player: { ...game.player, gold: game.player.gold - 10 } }, 28), 'The well accepts your offering. -10 gold, up to +28 health.', 'good'), 5))
      }
      return advance(gainXp(log(heal(game, 16 + game.floor * 4), 'The quiet water restores your health. +3 XP.', 'good'), 3))
    }
    case 'boss': {
      if (direction === 'up') return fight(game)
      if (direction === 'left') return drinkPotion(game)
      if (game.studied) return log(game, 'You already found the weakness. Time to act.')
      const next = hurt(game, 5)
      if (next.status === 'dead') return next
      return log({ ...next, studied: true }, 'You spot a weakness. -5 health now, less damage in the fight.', 'good')
    }
  }
}
