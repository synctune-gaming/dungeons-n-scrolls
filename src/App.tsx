import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUp, Backpack, BookOpen, Check,
  ChevronRight, Coins, Compass, Crown, DoorOpen, Eye, Feather, Flame,
  FlaskConical, Heart, HelpCircle, Map, Moon, Mouse, Plus, ScrollText,
  Settings as SettingsIcon, Shield, Skull, Sparkles, Swords, UserRound,
  Volume2, VolumeX, X,
  CircleHelp, WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from './components/Modal'
import { PixelScene } from './components/PixelScene'
import { CombatStatus, SpellBar, SPELL_ICONS } from './components/CombatControls'
import { CLASSES, getDialogue, getRegion, REGIONS, RELICS, ROOM_LABELS, ROOMS, SPELLS } from './game/content'
import { createRun, experienceTarget, gameReducer, getChoices, getRoom, getRoomPresentation, spellUnavailable } from './game/engine'
import { loadSave, writeSave } from './game/persistence'
import { CLASS_IDS, INSCRIPTION_ROOM_IDS, SPELL_IDS } from './game/types'
import type { ClassId, Direction, GameAction, GameState, RoomKind, Rune, SavedGame } from './game/types'
import { useRoomGestures } from './useRoomGestures'
import { useReducedMotion } from './useReducedMotion'
import { createSocialState } from './social/types'

type Panel = 'character' | 'inventory' | 'journal' | 'map' | 'help' | 'settings' | 'restart' | 'spells' | null

const KIND_ICONS: Record<RoomKind, LucideIcon> = {
  passage: DoorOpen, combat: Swords, npc: UserRound, treasure: Backpack,
  shop: Coins, shrine: Sparkles, boss: Skull,
}
const RUNE_ICONS: Record<Rune, LucideIcon> = { moon: Moon, flame: Flame, eye: Eye }
const RELIC_ICONS = { 'iron-charm': Shield, 'fleet-feather': Feather, 'ember-stone': Flame }
const DIRECTIONS = { left: ArrowLeft, up: ArrowUp, right: ArrowRight }
const ADVICE: Record<RoomKind, string> = {
  passage: 'Every path has a story. Some have teeth.',
  combat: 'Read the next move. A well-timed ward can be worth more than a sharp blade.',
  npc: 'Not every encounter needs a blade. Try a conversation.',
  treasure: 'Dexterity 8 opens locks. Below that, you will need to match the runes.',
  shop: 'Tonics restore 24 health. Keep one for the boss.',
  shrine: 'A quiet room can be worth more than a full purse.',
  boss: 'A guardian has more than one face. Save a little magic for what wakes next.',
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 44 52" className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <path d="M4 48V22L9 10L22 3L35 10L40 22V48H30V24L27 18H17L14 24V48Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 30H13M5 39H13M31 30H39M31 39H39M13 10L17 17M31 10L27 17M22 4V17" stroke="currentColor" />
      <path d="M19 41L22 28L25 41L22 45Z" fill="currentColor" />
      <path d="M16 43H28M22 45V49" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function Portrait({ large = false }: { large?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={`portrait ${large ? 'large' : ''}`} aria-hidden="true" shapeRendering="crispEdges">
      <rect width="48" height="48" fill="#353039" />
      <path d="M8 48V36H12V28H16V12H20V8H32V12H36V28H40V36H44V48Z" fill="#6c6950" />
      <path d="M16 24V16H20V12H32V16H36V24Z" fill="#939077" />
      <path d="M20 20H32V32H28V36H24V32H20Z" fill="#b7a081" />
      <path d="M16 20H36V24H16Z" fill="#343339" />
      <path d="M22 26H24V28H22ZM29 26H31V28H29Z" fill="#e2cf99" />
      <path d="M12 40H40V44H12Z" fill="#4b463e" />
      <path d="M26 40H30V44H26Z" fill="#bea372" />
      <path d="M5 36H9V16H11V10H13V22H11V40H5Z" fill="#b7b9ad" />
    </svg>
  )
}

function Journey({ game, compact = false }: { game: GameState; compact?: boolean }) {
  return (
    <ol className={`journey ${compact ? 'compact' : ''}`} aria-label="Current floor route">
      {game.deck.map((id, index) => {
        const room = ROOMS[id]
        const visible = game.discovered.includes(id)
        const complete = index < game.roomIndex || game.status === 'won'
        const current = index === game.roomIndex && game.status === 'active'
        const Icon = complete && visible ? Check : visible ? KIND_ICONS[room.kind] : CircleHelp
        return (
          <li key={id} className={`${complete ? 'complete' : ''} ${current ? 'current' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className="journey-node"><Icon size={13} strokeWidth={1.6} /></span>
            <div>
              <span className={`journey-name ${visible ? 'room-discovered' : 'room-unknown'}`}>{visible ? room.name : <><span aria-hidden="true">???</span><span className="sr-only">Unidentified room {index + 1}</span></>}</span>
              <span className="journey-detail">{current ? visible ? 'You are here' : 'Something waits here' : complete ? visible ? 'Explored' : 'Passed unseen' : 'A story still unwritten'}</span>
            </div>
            {current && <span className="current-dot" />}
          </li>
        )
      })}
    </ol>
  )
}

function Journal({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const entries = [...game.journal].reverse().slice(0, compact ? 3 : 30)
  return (
    <ol className={`journal ${compact ? 'compact' : ''}`}>
      {entries.map((entry, index) => (
        <li key={entry.id} className={`journal-${entry.tone}`}>
          <span className="journal-marker">{entry.tone === 'good' ? <Sparkles size={13} /> : entry.tone === 'danger' ? <Swords size={13} /> : <ScrollText size={13} />}</span>
          <div>{!compact && <span className="eyebrow">Entry {entry.id}</span>}<p>{entry.text}</p>{compact && index === 0 && <span className="journal-latest">Your latest step</span>}</div>
        </li>
      ))}
    </ol>
  )
}

export default function App() {
  const [loaded] = useState(() => loadSave())
  const [save, setSave] = useState<SavedGame>(() => loaded.save ?? {
    version: 3,
    game: createRun(randomSeed()),
    social: createSocialState(),
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  })
  const [notice, setNotice] = useState(loaded.error)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [nextClass, setNextClass] = useState<ClassId>(save.game.player.classId)
  const [lastDirection, setLastDirection] = useState<Direction>('up')
  const [animating, setAnimating] = useState(false)
  const reducedMotion = useReducedMotion()
  const audio = useRef<AudioContext | null>(null)
  const dialogTrigger = useRef<HTMLElement | null>(null)
  const game = save.game
  const player = game.player
  const room = getRoom(game)
  const presentation = getRoomPresentation(game)
  const region = getRegion(game.floor)
  const choices = getChoices(game)
  const interactionOpen = panel !== null || game.puzzle !== null || game.dialogue || game.omen !== null
  const blocked = interactionOpen || game.status !== 'active' || animating

  useEffect(() => {
    if (reducedMotion || game.feedback.id === 0 || game.feedback.type === 'info') { setAnimating(false); return }
    setAnimating(true)
    const timer = window.setTimeout(() => setAnimating(false), 450)
    return () => window.clearTimeout(timer)
  }, [game.feedback.id, game.feedback.type, reducedMotion])

  useEffect(() => { setSaveError(writeSave(save)) }, [save])
  useEffect(() => () => {
    if (audio.current && audio.current.state !== 'closed') {
      void audio.current.close().catch((error: unknown) => console.error('Cannot close game audio:', error))
    }
  }, [])

  const playSound = useCallback((action: GameAction) => {
    if (!save.settings.sound || game.status !== 'active') return
    if (action.type === 'CAST_SPELL' && spellUnavailable(game, action.spell)) return
    if (action.type === 'DRINK_POTION' && (player.potions === 0 || player.health === player.maxHealth)) return
    if (action.type === 'DRINK_AETHER' && (player.aether === 0 || player.mana === player.maxMana)) return
    const start = async () => {
      try {
        audio.current ??= new AudioContext()
        const context = audio.current
        if (context.state === 'suspended') await context.resume()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = action.type === 'CAST_SPELL' && action.spell === 'storm-lance' ? 'sawtooth' : 'triangle'
        const frequency = action.type === 'CAST_SPELL' ? 440 + SPELL_IDS.indexOf(action.spell) * 95 : room.kind === 'combat' || room.kind === 'boss' ? 140 : 330
        oscillator.frequency.setValueAtTime(frequency, context.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(90, context.currentTime + 0.12)
        gain.gain.setValueAtTime(0.035, context.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.17)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      } catch (error) {
        console.error('Game sound could not play:', error)
        setNotice('Sound is unavailable in this browser. The adventure still works with sound off.')
        setSave((current) => ({ ...current, settings: { ...current.settings, sound: false } }))
      }
    }
    void start()
  }, [save.settings.sound, room.kind, game, player])

  const act = useCallback((action: GameAction) => {
    setSave((current) => {
      const next = gameReducer(current.game, action)
      return {
        ...current, game: next,
        records: {
          bestFloor: Math.max(current.records.bestFloor, next.floor),
          wins: current.records.wins + (current.game.status !== 'won' && next.status === 'won' ? 1 : 0),
        },
      }
    })
    playSound(action)
  }, [playSound])

  const choose = useCallback((direction: Direction, trigger?: HTMLElement) => {
    if (blocked) return
    const focused = document.activeElement
    dialogTrigger.current = trigger ?? (
      focused instanceof HTMLElement && focused !== document.body ? focused : document.getElementById('room-title')
    )
    setLastDirection(direction)
    act({ type: 'CHOOSE', direction })
  }, [act, blocked])

  const gestures = useRoomGestures(choose, !blocked)

  useEffect(() => {
    if (blocked) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target
      if (target instanceof Element) {
        if (target.closest('input, textarea, select, dialog')) return
        if (target !== document.body && !target.closest('#adventure')) return
      }
      const direction = event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null
      if (direction) {
        event.preventDefault()
        choose(direction)
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        act({ type: 'DRINK_POTION' })
      } else if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        act({ type: 'DRINK_AETHER' })
      } else if (/^[1-5]$/.test(event.key)) {
        const spell = SPELL_IDS[Number(event.key) - 1]
        if (spell) { event.preventDefault(); act({ type: 'CAST_SPELL', spell }) }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [act, blocked, choose])

  function newRun() {
    const seed = randomSeed()
    setSave((current) => ({
      ...current,
      game: createRun(seed, nextClass, current.game.runNumber + 1),
    }))
    setPanel(null)
    setLastDirection('up')
    document.getElementById('adventure')?.focus()
  }

  function toggleSound() {
    setSave((current) => ({ ...current, settings: { ...current.settings, sound: !current.settings.sound } }))
  }

  const nav: { panel: Panel; label: string; icon: LucideIcon }[] = [
    { panel: null, label: 'Adventure', icon: Compass },
    { panel: 'character', label: 'Character', icon: UserRound },
    { panel: 'inventory', label: 'Inventory', icon: Backpack },
    { panel: 'spells', label: 'Grimoire', icon: WandSparkles },
    { panel: 'journal', label: 'Journal', icon: BookOpen },
  ]
  const EncounterIcon = presentation.known ? KIND_ICONS[room.kind] : CircleHelp
  const warning = saveError ?? notice
  const fighting = game.combat?.result === 'fighting'
  const victorious = game.combat?.result === 'victory'
  const inscription = INSCRIPTION_ROOM_IDS.some((id) => id === room.id)
  const readInscription = game.searched.some((id) => id === room.id)

  return (
    <div className="app-shell" onClickCapture={(event) => {
      // Safari does not focus tapped buttons; remember the actual dialog opener.
      const trigger = event.target instanceof Element ? event.target.closest('button') : null
      if (trigger instanceof HTMLElement) dialogTrigger.current = trigger
    }}>
      <a className="skip-link" href="#adventure">Skip to adventure</a>
      <aside className="sidebar">
        <a className="brand" href="#adventure" aria-label="Dungeons and Scrolls adventure">
          <BrandMark />
          <span>Dungeons<span className="brand-second">&amp; Scrolls</span></span>
        </a>
        <p className="brand-caption">A scrolling roguelike</p>
        <div className="sidebar-rule"><span /></div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Your story</p>
          {nav.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${panel === item.panel ? 'active' : ''}`}
              aria-current={panel === item.panel ? 'page' : undefined}
              aria-haspopup={item.panel ? 'dialog' : undefined}
              onClick={() => setPanel(item.panel)}
            >
              <item.icon size={19} strokeWidth={1.6} />{item.label}
              {item.panel === null && <span className="nav-active-dot" />}
              {item.panel === 'inventory' && <span className="nav-count">{player.relics.length + player.potions + player.aether}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-run">
          <div className="run-label"><Flame size={14} /><span>Current run</span><span>#{String(game.runNumber).padStart(3, '0')}</span></div>
          <div className="run-floor"><span>Floor {String(game.floor).padStart(2, '0')}</span><span>of 03</span></div>
          <div className="floor-pips" aria-hidden="true">{REGIONS.map((entry) => <span key={entry.floor} className={entry.floor <= game.floor ? 'filled' : ''} />)}</div>
          <button className="new-run-button" onClick={() => { setNextClass(player.classId); setPanel('restart') }}><Plus size={16} />New adventure</button>
        </div>
        <div className="sidebar-bottom">
          <button className="quiet-nav" onClick={() => setPanel('help')}><HelpCircle size={17} />How to play</button>
          <button className="quiet-nav" onClick={() => setPanel('settings')}><SettingsIcon size={17} />Settings</button>
          <button className="adventurer" onClick={() => setPanel('character')} aria-label="View your character">
            <Portrait />
            <span><strong>The {CLASSES[player.classId].name}</strong><small>Level {player.level} adventurer</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="mobile-header">
          <a href="#adventure" className="mobile-brand"><BrandMark small /><span>Dungeons<span className="mobile-brand-second">&amp; Scrolls</span></span></a>
          <div>
            <button className="icon-button" aria-label="View your character" onClick={() => setPanel('character')}><Portrait /></button>
            <button className="icon-button" aria-label="Open settings" onClick={() => setPanel('settings')}><SettingsIcon size={19} /></button>
            <button className="icon-button" aria-label="How to play" onClick={() => setPanel('help')}><HelpCircle size={20} /></button>
          </div>
        </header>
        <header className="workspace-header">
          <div className="breadcrumb"><Compass size={14} /><span>The adventure</span><ChevronRight size={12} /><span>Chapter {['I', 'II', 'III'][game.floor - 1]}</span></div>
          <div className="header-tools">
            <span className="live-run"><span />{game.status === 'active' ? 'Run in progress' : game.status === 'won' ? 'Adventure complete' : 'Run ended'}</span>
            <button className="icon-button" aria-label="Open settings" onClick={() => setPanel('settings')}><SettingsIcon size={18} /></button>
          </div>
        </header>

        {warning && <div className="notice" role="alert"><span>{warning}</span>{!saveError && <button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={17} /></button>}</div>}

        <div className="workspace-content">
          <main id="adventure" tabIndex={-1} className={fighting ? 'combat-active' : victorious ? 'combat-won' : ''}>
            <header className="adventure-header">
              <div><h1>{region.name}</h1><p className="region-subtitle">{region.subtitle}</p></div>
              <button className="floor-badge" onClick={() => setPanel('map')} aria-label="View journey map"><Map size={17} /><span>Floor<strong>{String(game.floor).padStart(2, '0')}</strong></span></button>
            </header>

            <section className="player-stats" aria-label="Adventurer status">
              <div className="health-stat"><div className="stat-top"><span><Heart size={15} />Health</span><strong>{player.health}<span> / {player.maxHealth}</span></strong></div><progress aria-label="Health" max={player.maxHealth} value={player.health} className={player.health <= player.maxHealth * 0.25 ? 'critical' : ''} /><div className="mana-stat"><div className="stat-top"><span><WandSparkles size={13} />Mana</span><strong>{player.mana}<span> / {player.maxMana}</span></strong></div><progress aria-label="Mana" max={player.maxMana} value={player.mana} /></div></div>
              <div className="gold-stat"><Coins size={20} /><div><span className="stat-label">Gold</span><strong>{player.gold}<small>g</small></strong></div></div>
              <div className="level-stat"><Sparkles size={19} /><div><div className="stat-top"><span className="stat-label">Level</span><strong>{player.level}</strong></div><progress aria-label="Experience" value={player.level === 10 ? 1 : player.xp} max={player.level === 10 ? 1 : experienceTarget(player.level)} /></div></div>
            </section>

            <div className="room-stage">
              <div
                ref={gestures.element}
                className={`room-card ${gestures.drag.x || gestures.drag.y ? 'dragging' : ''}`}
                style={{ transform: `translate(${gestures.drag.x}px, ${gestures.drag.y}px) rotate(${gestures.drag.x / 22}deg)` }}
                {...gestures.handlers}
              >
                <div className={`room-content room-enter-${lastDirection}`} key={`${game.runNumber}-${game.floor}-${game.roomIndex}`}>
                  <div className="scene-frame">
                    <PixelScene room={room} floor={game.floor} seed={game.seed + game.roomIndex} known={presentation.known} combat={game.combat} feedback={game.feedback} reducedMotion={reducedMotion} paused={interactionOpen || game.status !== 'active'} />
                    <div className="scene-shade" />
                    <div className="scene-header"><span><Compass size={12} />{room.zone === 'overworld' ? 'The overworld' : region.dungeon}</span><span>{String(game.roomIndex + 1).padStart(2, '0')}<span className="room-total"> / {game.deck.length}</span></span></div>
                    <div className="scene-footer"><span className={`encounter-tag ${presentation.known && room.kind === 'boss' ? 'boss-tag' : ''}`}><EncounterIcon size={12} />{presentation.known ? ROOM_LABELS[room.kind] : 'Unseen presence'}</span><span className="pixel-label">{fighting ? 'Steel is not your only answer.' : 'A place yet to be remembered'}</span></div>
                    {game.feedback.type === 'reveal' && <div className="discovery-flare" key={`reveal-${game.feedback.id}`} aria-hidden="true"><span>Discovered</span></div>}
                    {game.feedback.type === 'phase' && <div className="phase-flare" key={`phase-${game.feedback.id}`} aria-hidden="true"><span>Something else awakens</span></div>}
                    {!victorious && game.status === 'active' && <div className="scene-hotspots">
                      {!fighting && inscription && <button className={`scene-hotspot inscription-hotspot ${readInscription ? 'spent' : ''}`} aria-label="Inspect the hidden inscription" disabled={blocked || readInscription} onClick={() => act({ type: 'INSPECT_INSCRIPTION' })}><Eye size={16} /><span>{readInscription ? 'Read' : 'Inspect'}</span></button>}
                      {!fighting && room.kind === 'npc' && <button className="scene-hotspot person-hotspot" aria-label="Speak to the stranger" disabled={blocked} onClick={() => choose('left')}><UserRound size={16} /><span>Talk</span></button>}
                      {!fighting && room.kind === 'treasure' && <button className="scene-hotspot treasure-hotspot" aria-label="Examine the chest" disabled={blocked} onClick={() => choose('up')}><Backpack size={16} /><span>Open</span></button>}
                      {(room.kind === 'combat' || room.kind === 'boss') && !presentation.known && <button className="scene-hotspot lantern-hotspot" aria-label="Reveal the hidden presence" disabled={blocked || player.mana < 2} onClick={() => choose('right')}><Flame size={16} /><span>Reveal</span></button>}
                      {fighting && <button className={`scene-hotspot lantern-hotspot ${game.studied ? 'spent' : ''}`} aria-label="Study enemy" disabled={blocked || game.studied || player.mana < 3} onClick={() => act({ type: 'STUDY_ENEMY' })}><Eye size={16} /><span>{game.studied ? 'Known' : '3 mana'}</span></button>}
                      {fighting && room.kind === 'combat' && <button className="scene-hotspot retreat-hotspot" aria-label="Retreat" disabled={blocked} onClick={() => act({ type: 'FLEE' })}><DoorOpen size={16} /><span>Retreat</span></button>}
                    </div>}
                    {victorious && <div className="victory-reveal"><Crown size={23} /><strong>{room.kind === 'boss' ? 'The passage opens.' : 'The path is clear.'}</strong><span>Gold and experience collected</span></div>}
                  </div>
                  <div className="room-copy">
                    <div className="room-title-row"><h2 id="room-title" tabIndex={-1}>{presentation.name}</h2>{presentation.known && (room.kind === 'combat' || room.kind === 'boss') && <span className={`enemy-weakness weakness-${room.enemy.weakness}`}>Weak to {room.enemy.weakness}</span>}</div>
                    {game.combat ? <CombatStatus game={game} /> : <p>{presentation.description}</p>}
                    {!game.combat && <div className="room-copy-footer"><span><span className="small-diamond" />{game.status === 'active' ? 'Your next move is yours.' : 'The story of this run is written.'}</span><span>{room.zone === 'overworld' ? 'Outside' : 'Inside'}<DoorOpen size={12} /></span></div>}
                  </div>
                </div>
                <span className="frame-corner top-left" /><span className="frame-corner top-right" /><span className="frame-corner bottom-left" /><span className="frame-corner bottom-right" />
              </div>
              <div className="action-rail" role="group" aria-label="Quick actions">
                <button className="rail-button potion-button" aria-label="Drink a healing tonic" disabled={blocked || player.potions === 0 || player.health === player.maxHealth} onClick={() => act({ type: 'DRINK_POTION' })}><FlaskConical size={21} /><span>{player.potions}</span></button>
                <button className="rail-button" aria-label="Open your satchel" onClick={() => setPanel('inventory')}><Backpack size={21} /><span>Items</span></button>
                <button className="rail-button magic-rail" aria-label="Open your grimoire" onClick={() => setPanel('spells')}><WandSparkles size={21} /><span>Spells</span></button>
                <button className="rail-button map-rail" aria-label="View your journey" onClick={() => setPanel('map')}><Map size={21} /><span>Map</span></button>
                <button className={`rail-button sound-rail ${save.settings.sound ? 'sound-active' : ''}`} aria-label={save.settings.sound ? 'Mute sound' : 'Enable sound'} aria-pressed={save.settings.sound} onClick={toggleSound}>{save.settings.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}<span>Sound</span></button>
              </div>
            </div>

            {game.status === 'active' ? (
              <div className={`choice-buttons ${choices.length === 1 ? 'single-choice' : ''}`} role="group" aria-label="Choose your next move">
                {choices.map((choice) => {
                  const Icon = DIRECTIONS[choice.direction]
                  return <button key={choice.direction} className={`choice-button ${choice.direction === 'up' ? 'primary-choice' : ''}`} aria-label={choice.label} disabled={choice.disabled || blocked} onClick={(event) => choose(choice.direction, event.currentTarget)}>
                    <span className="choice-key"><Icon size={15} /><span>{choice.direction === 'up' ? 'Swipe up' : `Swipe ${choice.direction}`}</span></span><strong>{choice.label}</strong><small>{choice.hint}</small>
                  </button>
                })}
              </div>
            ) : (
              <section className={`run-summary ${game.status === 'won' ? 'victory' : ''}`} aria-label="Run summary">
                {game.status === 'won' ? <Crown size={27} /> : <Flame size={27} />}
                <div><h2>{game.status === 'won' ? 'You lived to tell the tale.' : 'Every ending is a beginning.'}</h2><p>{game.roomsCleared} rooms explored. {player.gold} gold found. {game.status === 'dead' ? 'A new path is waiting.' : 'The three guardians have fallen.'}</p></div>
                <button className="gold-button" onClick={() => { setNextClass(player.classId); setPanel('restart') }}>Try a new adventure<ArrowRight size={16} /></button>
              </section>
            )}
            {fighting && <SpellBar game={game} disabled={blocked} onAction={act} />}
            {room.kind === 'shop' && <button className="outline-button merchant-extra" disabled={blocked || player.gold < 12 || player.aether >= 1000} onClick={() => act({ type: 'BUY_AETHER' })}><WandSparkles size={15} />Buy an aether vial / 12 gold</button>}
            {game.feedback.id > 0 && <p className={`action-feedback feedback-${game.feedback.type}`} key={`feedback-${game.feedback.id}`} role="status">{game.feedback.text || (victorious ? 'The way is clear. Continue when you are ready.' : 'Your next move is yours.')}</p>}
            {save.settings.hints && !fighting && <div className="gesture-hint"><Mouse size={14} /><span>Scroll or swipe to explore</span><span className="hint-separator" /><span className="keyboard-hint">Arrow keys work, too</span><span className="mobile-key-hint">Tap a choice below the room</span></div>}
            <div className="save-status"><span className={saveError ? 'unsaved-dot' : 'saved-dot'} />{saveError ? 'Progress is not saving' : 'Your adventure saves as you go'}<span className="save-status-rule" /><span>Run #{String(game.runNumber).padStart(3, '0')}</span></div>
            <p className="sr-only" role="status" aria-atomic="true">{presentation.name}. Health {player.health} of {player.maxHealth}. Mana {player.mana} of {player.maxMana}. {player.gold} gold.</p>
          </main>

          <aside className="journey-panel" aria-label="Adventure overview">
            <header className="panel-heading"><h2>Your journey</h2><span>Chapter {['I', 'II', 'III'][game.floor - 1]}</span></header>
            <div className="journey-location"><span className="location-icon"><Map size={18} /></span><div><strong>{game.roomIndex === 0 ? 'An uncharted path' : region.dungeon}</strong><span>{game.deck.length} rooms to discover</span></div></div>
            <Journey game={game} compact />
            <button className="text-button map-link" onClick={() => setPanel('map')}>View the full map<ArrowRight size={13} /></button>
            <div className="aside-divider" />
            <header className="panel-heading notes-heading"><h2>Field notes</h2><BookOpen size={16} /></header>
            <Journal game={game} compact />
            <button className="text-button" onClick={() => setPanel('journal')}>Open your journal<ArrowRight size={13} /></button>
            <div className="advice-card"><ScrollText size={21} strokeWidth={1.2} /><p>{presentation.known ? ADVICE[room.kind] : 'Keep your blade close. The darkness is not empty.'}</p><span>A word to the wanderer</span></div>
          </aside>
        </div>
      </div>

      {game.dialogue && <Modal restoreFocusTo={dialogTrigger.current} title={room.name} eyebrow="A voice beside the fire" onClose={() => act({ type: 'CLOSE_DIALOGUE' })} className="dialogue-modal">
        <div className="dialogue-portrait"><Portrait large /><Flame size={19} /></div>
        <p className="dialogue-line">{getDialogue(room.id).opening}</p>
        <div className="dialogue-responses">{(['rumor', 'rest', 'trade'] as const).map((response) => {
          const option = getDialogue(room.id).responses[response]
          return <button className="dialogue-response" key={response} disabled={response === 'trade' && (player.gold < 20 || player.potions >= 1000)} onClick={() => act({ type: 'RESPOND_NPC', response })}><span><strong>{option.label}</strong><small>{option.hint}</small></span><ArrowRight size={16} /></button>
        })}</div>
        <p className="modal-footnote">A shared story can change how you face what waits ahead.</p>
      </Modal>}

      {game.omen && <Modal restoreFocusTo={dialogTrigger.current} title="Something answers." eyebrow="The hidden inscription" onClose={() => act({ type: 'RESOLVE_OMEN', accept: false })} className="omen-modal">
        <div className="omen-glyph" aria-hidden="true"><span /><Eye size={45} /><span /></div>
        <p className="dialogue-line">The letters move when you look away. A whisper offers strength, insight, or something it refuses to name.</p>
        <p className="omen-price"><Heart size={15} />Offer 4 health. A curse may take 10 more.</p>
        <div className="omen-choices"><button className="outline-button" onClick={() => act({ type: 'RESOLVE_OMEN', accept: false })}>Leave it untouched</button><button className="gold-button" onClick={() => act({ type: 'RESOLVE_OMEN', accept: true })}>Accept the bargain<ArrowRight size={15} /></button></div>
        <p className="modal-footnote">A blessing may grant strength, wisdom, gold, or mana. This inscription offers its bargain only once.</p>
      </Modal>}

      {game.puzzle && <Modal restoreFocusTo={dialogTrigger.current} title="The rune lock" eyebrow="A little dexterity. A little patience." onClose={() => act({ type: 'CLOSE_PUZZLE' })} className="puzzle-modal">
        <p className="modal-description">Match the symbols from left to right. A wrong symbol costs 4 health. Three mistakes jam the lock.</p>
        <ol className="rune-sequence" aria-label="Rune combination">
          {game.puzzle.combination.map((rune, index) => { const Icon = RUNE_ICONS[rune]; return <li key={rune} className={index < (game.puzzle?.progress ?? 0) ? 'matched' : ''}><span>{index + 1}</span><Icon size={29} /><span>{rune}</span>{index < (game.puzzle?.progress ?? 0) && <Check size={12} />}</li> })}
        </ol>
        <p className="puzzle-progress" role="status">{game.puzzle.progress} of 3 matched. {game.puzzle.mistakes} of 3 mistakes. {player.health} health.</p>
        <div className="rune-buttons">{(['eye', 'flame', 'moon'] as const).map((rune) => { const Icon = RUNE_ICONS[rune]; return <button key={rune} aria-label={`Choose ${rune} rune`} onClick={() => act({ type: 'PICK_RUNE', rune })}><Icon size={24} /><span>{rune}</span></button> })}</div>
        <button className="text-button puzzle-cancel" onClick={() => act({ type: 'CLOSE_PUZZLE' })}>Leave the lock for now<ArrowRight size={14} /></button>
      </Modal>}

      {panel === 'character' && <Modal restoreFocusTo={dialogTrigger.current} title={`The ${CLASSES[player.classId].name}`} eyebrow="Your adventurer" onClose={() => setPanel(null)}>
        <div className="character-profile"><Portrait large /><div><p className="character-motto">{CLASSES[player.classId].title}</p><p className="modal-description">{CLASSES[player.classId].description}</p></div></div>
        <div className="character-stats"><div><Swords /><strong>{player.strength}</strong><span>Strength</span></div><div><Feather /><strong>{player.dexterity}</strong><span>Dexterity</span></div><div><Eye /><strong>{player.wisdom}</strong><span>Wisdom</span></div></div>
        <div className="character-level"><span>Level {player.level}</span><span>{player.level === 10 ? 'Maximum level' : `${player.xp} / ${experienceTarget(player.level)} XP to the next level`}</span></div>
        <progress className="character-xp" aria-label="Character experience" max={player.level === 10 ? 1 : experienceTarget(player.level)} value={player.level === 10 ? 1 : player.xp} />
        <p className="modal-footnote">Strength makes your strikes stronger. Dexterity helps you dodge, sneak, and unlock chests. Wisdom fuels your spells and the strength of your wards.</p>
        <button className="outline-button full-width" onClick={() => { setNextClass(player.classId); setPanel('restart') }}><UserRound size={16} />Choose a class for a new adventure</button>
      </Modal>}

      {panel === 'inventory' && <Modal restoreFocusTo={dialogTrigger.current} title="Your satchel" eyebrow="A few things between you and the dark" onClose={() => setPanel(null)}>
        <div className="inventory-item"><span className="item-icon"><FlaskConical size={24} /></span><div><h3>Healing tonic <span className="item-count">x{player.potions}</span></h3><p>Restores up to 24 health. A little courage in a bottle.</p></div><button className="outline-button" aria-label="Drink healing tonic" disabled={game.status !== 'active' || game.puzzle !== null || player.potions === 0 || player.health === player.maxHealth} onClick={() => act({ type: 'DRINK_POTION' })}>Drink</button></div>
        <div className="inventory-item"><span className="item-icon aether-icon"><WandSparkles size={24} /></span><div><h3>Aether vial <span className="item-count">x{player.aether}</span></h3><p>Restores up to 14 mana. A stolen breath of starlight.</p></div><button className="outline-button" aria-label="Drink aether vial" disabled={game.status !== 'active' || game.puzzle !== null || player.aether === 0 || player.mana === player.maxMana} onClick={() => act({ type: 'DRINK_AETHER' })}>Drink</button></div>
        <h3 className="inventory-heading">Equipped relics<span>{player.relics.length} / 3</span></h3>
        {player.relics.length === 0 ? <div className="empty-satchel"><Backpack size={30} strokeWidth={1.2} /><p>No relics. Yet.</p><span>Search chests and visit shops to find something worth carrying.</span></div> : player.relics.map((id) => { const Icon = RELIC_ICONS[id]; return <div className="inventory-item relic-item" key={id}><span className="item-icon"><Icon size={24} /></span><div><h3>{RELICS[id].name}</h3><p>{RELICS[id].effect}</p><span className="relic-flavor">{RELICS[id].description}</span></div><span className="equipped-label"><Check size={12} />Equipped</span></div> })}
        <p className="modal-footnote">Drinking in battle spends your turn. Relics apply automatically and last for this run. A new adventure starts with a fresh satchel.</p>
      </Modal>}

      {panel === 'spells' && <Modal restoreFocusTo={dialogTrigger.current} title="Your grimoire" eyebrow={`${player.mana} / ${player.maxMana} mana`} onClose={() => setPanel(null)} className="grimoire-modal">
        <p className="modal-description">Five words the darkness would rather you forgot. Wisdom strengthens your magic; every spell spends mana.</p>
        <div className="grimoire-spells">{SPELL_IDS.map((id) => {
          const definition = SPELLS[id]
          const Icon = SPELL_ICONS[id]
          const reason = spellUnavailable(game, id)
          return <div className={`grimoire-spell spell-${id}`} key={id}><span className="grimoire-icon"><Icon size={23} /></span><div><h3>{definition.name}<span>{definition.cost} mana</span></h3><p>{definition.description}</p></div><button className="outline-button" aria-label={`Cast ${definition.name.toLowerCase()}`} disabled={animating || Boolean(reason)} title={reason ?? definition.description} onClick={() => { setPanel(null); act({ type: 'CAST_SPELL', spell: id }) }}>Cast</button></div>
        })}</div>
        <p className="modal-footnote">Offensive spells and wards need an active fight. Mending works on the road, too. In battle, keys 1-5 cast; P drinks a tonic and A drinks aether.</p>
      </Modal>}

      {panel === 'journal' && <Modal restoreFocusTo={dialogTrigger.current} title="The story so far" eyebrow={`Field notes / Run #${String(game.runNumber).padStart(3, '0')}`} onClose={() => setPanel(null)}>
        <Journal game={game} />
        <p className="modal-footnote">Your journal keeps the 30 most recent entries from this adventure.</p>
      </Modal>}

      {panel === 'map' && <Modal restoreFocusTo={dialogTrigger.current} title="A road into the unknown" eyebrow="Your journey" onClose={() => setPanel(null)} className="map-modal">
        <div className="region-list">{REGIONS.map((entry) => <div className={`map-region ${entry.floor === game.floor ? 'active' : ''}`} key={entry.floor}><span>{entry.floor < game.floor || game.status === 'won' ? <Check size={18} /> : entry.floor === game.floor ? <Compass size={18} /> : <CircleHelp size={18} />}</span><div><h3>{entry.floor <= game.floor ? entry.name : 'Uncharted region'}</h3><p>{entry.floor <= game.floor ? entry.dungeon : '???'}</p></div><small>{entry.floor < game.floor || game.status === 'won' ? 'Cleared' : entry.floor === game.floor ? 'Exploring' : 'Undiscovered'}</small></div>)}</div>
        <h3 className="inventory-heading">Your current path<span>{game.roomIndex + 1} / {game.deck.length}</span></h3><Journey game={game} />
        <div className="map-records"><span>Best floor<strong>{save.records.bestFloor} / 3</strong></span><span>Completed adventures<strong>{save.records.wins}</strong></span><span>Run seed<strong>{game.seed.toString(16).toUpperCase()}</strong></span></div>
      </Modal>}

      {panel === 'help' && <Modal restoreFocusTo={dialogTrigger.current} title="One more scroll." eyebrow="How to play" onClose={() => setPanel(null)}>
        <p className="modal-description">A dungeon crawler that moves like your feed. Make a choice, meet the next room, and see how far you get.</p>
        <div className="help-controls"><div><ArrowUp /><span><strong>Swipe up or scroll down</strong>Explore, approach a foe, or strike in battle.</span></div><div><ArrowLeft /><span><strong>Swipe left</strong>Talk, sneak past, or guard in battle.</span></div><div><ArrowRight /><span><strong>Swipe right</strong>Reveal, trade, escape, or dodge in battle.</span></div></div>
        <p className="modal-description">Every room has its own choices. Tap glowing discoveries to talk, inspect an inscription, or open a chest. Arrow keys work too; keys 1-5 cast spells, P drinks a tonic, and A drinks aether.</p>
        <div className="help-rules"><p><Heart size={17} /><span><strong>Keep your light alive.</strong> At zero health, your run ends. Tonics and spells restore health, but drinking in battle spends a turn.</span></p><p><Swords size={17} /><span><strong>Read the enemy's next move.</strong> Guard to soften blows and regain mana. Dodge physical attacks. Use wards against curses and spells against raised guards.</span></p><p><Skull size={17} /><span><strong>A guardian has a second face.</strong> Bosses awaken into another phase at half health. No single attack can finish both phases.</span></p><p><Backpack size={17} /><span><strong>Leave room for the unknown.</strong> Unidentified rooms stay hidden on your map, even if you sneak past them. Relics and levels last for one run.</span></p><p><Eye size={17} /><span><strong>Chests like nimble fingers.</strong> Dexterity 8 bypasses rune locks. Otherwise, solve the three-symbol puzzle.</span></p></div>
        <button className="gold-button full-width" onClick={() => setPanel(null)}>Back to the adventure<ArrowRight size={16} /></button>
      </Modal>}

      {panel === 'settings' && <Modal restoreFocusTo={dialogTrigger.current} title="Make yourself at home" eyebrow="Settings" onClose={() => setPanel(null)}>
        <label className="setting-row"><span><strong>Sound effects</strong><small>Quiet, retro tones for your choices.</small></span><input type="checkbox" checked={save.settings.sound} onChange={toggleSound} /></label>
        <label className="setting-row"><span><strong>Gesture hints</strong><small>Show the scrolling and keyboard guide.</small></span><input type="checkbox" checked={save.settings.hints} onChange={(event) => { const hints = event.currentTarget.checked; setSave((current) => ({ ...current, settings: { ...current.settings, hints } })) }} /></label>
        <p className="modal-footnote">Atmosphere, creature movement, and spell effects follow your device's reduced-motion setting. Background animation pauses in hidden tabs and behind dialogs. Progress stays in this browser.</p>
        <button className="outline-button full-width" onClick={() => { setNextClass(player.classId); setPanel('restart') }}><Plus size={16} />Start a new adventure</button>
      </Modal>}

      {panel === 'restart' && <Modal restoreFocusTo={dialogTrigger.current} title={game.status === 'active' ? 'A different path awaits.' : 'Your next story starts here.'} eyebrow="New adventure" onClose={() => setPanel(null)}>
        <p className="modal-description">{game.status === 'active' ? 'This ends your current run. Your gold, levels, and relics will reset; your best floor and completed adventures will stay.' : 'A fresh route, a full health bar, and another chance. Your best floor and completed adventures stay with you.'}</p>
        <fieldset className="class-picker"><legend>Choose your adventurer</legend>{CLASS_IDS.map((id) => <label key={id} className={nextClass === id ? 'selected' : ''}><input type="radio" name="class" value={id} checked={nextClass === id} onChange={() => setNextClass(id)} /><span><strong>{CLASSES[id].name}</strong><small>{CLASSES[id].title}</small><span className="class-numbers">HP {CLASSES[id].stats.maxHealth} <span>/</span> STR {CLASSES[id].stats.strength} <span>/</span> DEX {CLASSES[id].stats.dexterity}</span></span></label>)}</fieldset>
        <button className="gold-button full-width" onClick={newRun}>Begin a new adventure<ArrowRight size={17} /></button>
      </Modal>}
    </div>
  )
}
