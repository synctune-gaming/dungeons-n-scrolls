import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUp, Backpack, BookOpen, Check,
  ChevronRight, Coins, Compass, DoorOpen, Ellipsis, Eye, Flame,
  FlaskConical, Heart, HelpCircle, Map, Moon, Plus, ScrollText, Search,
  Settings as SettingsIcon, Skull, Sparkles, Swords, UserRound, X,
  CircleHelp, WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from './components/Modal'
import { SPELL_ICONS } from './components/CombatControls'
import { Portrait } from './components/Portrait'
import { RelicList } from './components/CharacterDetails'
import { EncounterHistory, Timeline } from './components/Timeline'
import { HeroProfilePage, AdventurerProfilePage } from './components/Profiles'
import { StoriesStrip, StoryViewer } from './components/Stories'
import { ExplorePage, DestinationView } from './components/Explore'
import { GiftChat } from './components/GiftChat'
import { CLASSES, getDialogue, REGIONS, ROOMS, SPELLS } from './game/content'
import { createRun, experienceTarget, gameReducer, getRoom, npcResponseUnavailable, spellUnavailable } from './game/engine'
import { loadSave, writeSave } from './game/persistence'
import { CLASS_IDS, NPC_ROOM_IDS, SPELL_IDS } from './game/types'
import type { ClassId, Direction, GameAction, GameState, RoomKind, Rune, SavedGame } from './game/types'
import { useReducedMotion } from './useReducedMotion'
import { createSocialState } from './social/types'
import type { AdventurerId, SocialAction } from './social/types'
import { ADVENTURERS } from './social/content'
import { socialReducer } from './social/engine'

type Panel = 'inventory' | 'journal' | 'map' | 'help' | 'settings' | 'restart' | 'spells' | 'tools' | null
type MainScreen = 'timeline' | 'search' | 'profile'
type Screen = { type: 'timeline' } | { type: 'search' } | { type: 'profile' }
  | { type: 'adventurer' | 'chat'; id: AdventurerId; origin: MainScreen }
const PRIMARY_NAV: { type: MainScreen; label: string; icon: LucideIcon }[] = [
  { type: 'timeline', label: 'Timeline', icon: Compass },
  { type: 'search', label: 'Search', icon: Search },
  { type: 'profile', label: 'Profile', icon: UserRound },
]

const KIND_ICONS: Record<RoomKind, LucideIcon> = {
  passage: DoorOpen, combat: Swords, npc: UserRound, treasure: Backpack,
  shop: Coins, shrine: Sparkles, boss: Skull,
}
const RUNE_ICONS: Record<Rune, LucideIcon> = { moon: Moon, flame: Flame, eye: Eye }

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

function Journey({ game }: { game: GameState }) {
  return (
    <ol className="journey" aria-label="Current floor route">
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

function Journal({ game }: { game: GameState }) {
  const entries = [...game.journal].reverse().slice(0, 30)
  return (
    <ol className="journal">
      {entries.map((entry) => (
        <li key={entry.id} className={`journal-${entry.tone}`}>
          <span className="journal-marker">{entry.tone === 'good' ? <Sparkles size={13} /> : entry.tone === 'danger' ? <Swords size={13} /> : <ScrollText size={13} />}</span>
          <div><span className="eyebrow">Entry {entry.id}</span><p>{entry.text}</p></div>
        </li>
      ))}
    </ol>
  )
}

export default function App() {
  const [loaded] = useState(() => loadSave())
  const [session, setSession] = useState<{ save: SavedGame; error: string | null }>(() => ({ save: loaded.save ?? {
    version: 3,
    game: createRun(randomSeed()),
    social: createSocialState(),
    settings: { sound: false, hints: true },
    records: { bestFloor: 1, wins: 0 },
  }, error: null }))
  const save = session.save
  const setSave = useCallback((update: SetStateAction<SavedGame>) => {
    setSession((current) => ({ ...current, save: typeof update === 'function' ? update(current.save) : update }))
  }, [])
  const [notice, setNotice] = useState(loaded.error)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [screen, setScreen] = useState<Screen>({ type: 'timeline' })
  const [story, setStory] = useState<{ id: AdventurerId; index: number } | null>(null)
  const storyTrigger = useRef<HTMLElement | null>(null)
  const [nextClass, setNextClass] = useState<ClassId>(save.game.player.classId)
  const [lastDirection, setLastDirection] = useState<Direction>('up')
  const [animating, setAnimating] = useState(false)
  const reducedMotion = useReducedMotion()
  const audio = useRef<AudioContext | null>(null)
  const dialogTrigger = useRef<HTMLElement | null>(null)
  const game = save.game
  const player = game.player
  const room = getRoom(game)
  const gameplay = screen.type === 'timeline' && !game.visit
  const primaryScreen = screen.type === 'adventurer' || screen.type === 'chat' ? screen.origin : screen.type
  const interactionOpen = panel !== null || game.puzzle !== null || game.dialogue || game.omen !== null || story !== null
  const blocked = interactionOpen || screen.type !== 'timeline' || game.visit !== null || game.status !== 'active' || animating
  const inventoryBlocked = game.status !== 'active' || Boolean(game.puzzle || game.dialogue || game.omen || game.visit)

  useEffect(() => {
    window.scrollTo(0, 0)
    const target = screen.type === 'timeline' && game.combat?.result === 'fighting' ? 'room-title' : 'screen-heading'
    const frame = requestAnimationFrame(() => document.getElementById(target)?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [screen, game.visit?.destinationId, game.visit?.venueId, game.combat?.result])

  // Keep the animation lock in sync with visible controls before paint.
  useLayoutEffect(() => {
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
    const title = document.getElementById('room-title')
    const bounds = title?.getBoundingClientRect()
    if (title && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) title.scrollIntoView({ block: 'center' })
    setScreen((current) => current.type === 'timeline' ? current : { type: 'timeline' })
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
  }, [playSound, setSave])

  const socialAct = useCallback((action: SocialAction) => {
    setSession((current) => socialReducer(current.save, action))
  }, [])

  const choose = useCallback((direction: Direction, trigger?: HTMLElement) => {
    if (blocked) return
    const focused = document.activeElement
    dialogTrigger.current = trigger ?? (
      focused instanceof HTMLElement && focused !== document.body ? focused : document.getElementById('room-title')
    )
    setLastDirection(direction)
    act({ type: 'CHOOSE', direction })
  }, [act, blocked])

  useLayoutEffect(() => {
    if (blocked) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target
      if (target instanceof Element) {
        if (target.closest('input, textarea, select, dialog')) return
        if (target !== document.body && !target.closest('#live-encounter')) return
      }
      const bounds = document.getElementById('room-title')?.getBoundingClientRect()
      if (!bounds || bounds.top < 0 || bounds.bottom > window.innerHeight) return
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
    setStory(null)
    setScreen({ type: 'timeline' })
    setLastDirection('up')
    document.getElementById('adventure')?.focus()
  }

  function toggleSound() {
    setSave((current) => ({ ...current, settings: { ...current.settings, sound: !current.settings.sound } }))
  }

  const nav: { panel: Panel; label: string; icon: LucideIcon }[] = [
    { panel: 'inventory', label: 'Inventory', icon: Backpack },
    { panel: 'spells', label: 'Grimoire', icon: WandSparkles },
    { panel: 'journal', label: 'Journal', icon: BookOpen },
    { panel: 'map', label: 'Map', icon: Map },
  ]
  const warning = saveError ?? session.error ?? notice
  const npcId = NPC_ROOM_IDS.find((id) => id === room.id)

  function navigate(next: Screen) { setPanel(null); setStory(null); setScreen(next) }
  function openProfile(id: AdventurerId) { navigate({ type: 'adventurer', id, origin: primaryScreen }) }
  function openStory(id: AdventurerId) { storyTrigger.current = dialogTrigger.current; setPanel(null); setStory({ id, index: 0 }) }
  function restart() { setNextClass(player.classId); setPanel('restart') }

  return (
    <div className={`app-shell ${gameplay ? 'gameplay-shell' : ''}`} onClickCapture={(event) => {
      // Safari does not focus tapped buttons; remember the actual dialog opener.
      const trigger = event.target instanceof Element ? event.target.closest('button') : null
      if (trigger instanceof HTMLElement && !trigger.closest('.tools-modal')) dialogTrigger.current = trigger
    }}>
      <a className="skip-link" href={screen.type === 'timeline' && !game.visit ? '#adventure' : '#social-screen'}>Skip to main content</a>
      <aside className="sidebar">
        <a className="brand" href="#adventure" onClick={(event) => { event.preventDefault(); navigate({ type: 'timeline' }) }}>
          <BrandMark />
          <span>Dungeons<span className="brand-second">&amp; Scrolls</span></span>
        </a>
        <p className="brand-caption">A scrolling roguelike</p>
        <div className="sidebar-rule"><span /></div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Your story</p>
          {PRIMARY_NAV.map((item) => <button key={item.type} className={`nav-item ${primaryScreen === item.type ? 'active' : ''}`} aria-current={primaryScreen === item.type ? 'page' : undefined} onClick={() => navigate({ type: item.type })}><item.icon size={19} strokeWidth={1.6} />{item.label}</button>)}
        </nav>
        <nav aria-label="Adventure tools">
          <p className="nav-label tools-label">For the road</p>
          {nav.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${panel === item.panel ? 'active' : ''}`}
              aria-current={panel === item.panel ? 'page' : undefined}
              aria-haspopup={item.panel ? 'dialog' : undefined}
              onClick={() => setPanel(item.panel)}
            >
              <item.icon size={19} strokeWidth={1.6} />{item.label}
              {item.panel === 'inventory' && <span className="nav-count">{player.relics.length + player.potions + player.aether}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-run">
          <div className="run-label"><Flame size={14} /><span>Current run</span><span>#{String(game.runNumber).padStart(3, '0')}</span></div>
          <div className="run-floor"><span>Floor {String(game.floor).padStart(2, '0')}</span><span>of 03</span></div>
          <div className="floor-pips" aria-hidden="true">{REGIONS.map((entry) => <span key={entry.floor} className={entry.floor <= game.floor ? 'filled' : ''} />)}</div>
          <button className="new-run-button" onClick={restart}><Plus size={16} />New adventure</button>
        </div>
        <div className="sidebar-bottom">
          <button className="quiet-nav" onClick={() => setPanel('help')}><HelpCircle size={17} />How to play</button>
          <button className="quiet-nav" onClick={() => setPanel('settings')}><SettingsIcon size={17} />Settings</button>
          <button className="adventurer" onClick={() => navigate({ type: 'profile' })} title="View your character">
            <Portrait appearance={save.social.hero.appearance} />
            <span><strong>{save.social.hero.name}</strong><small>Level {player.level} {CLASSES[player.classId].name}</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="mobile-header">
          <a href="#adventure" className="mobile-brand" onClick={(event) => { event.preventDefault(); navigate({ type: 'timeline' }) }}><BrandMark small /><span>Dungeons<span className="mobile-brand-second">&amp; Scrolls</span></span></a>
          <div>
            <button className="icon-button" aria-label="View your character" onClick={() => navigate({ type: 'profile' })}><Portrait appearance={save.social.hero.appearance} /></button>
            <button className="icon-button" aria-label="Open settings" onClick={() => setPanel('settings')}><SettingsIcon size={19} /></button>
            <button className="icon-button" aria-label="How to play" onClick={() => setPanel('help')}><HelpCircle size={20} /></button>
          </div>
        </header>
        <header className="workspace-header">
          <div className="breadcrumb"><Compass size={14} /><span>{screen.type === 'timeline' ? game.visit ? 'Side trip' : 'Timeline' : screen.type === 'search' ? 'Search' : screen.type === 'profile' ? 'Your profile' : ADVENTURERS[screen.id].name}</span><ChevronRight size={12} /><span>Chapter {['I', 'II', 'III'][game.floor - 1]}</span></div>
          <div className="header-tools">
            <span className="live-run"><span />{game.status === 'active' ? 'Run in progress' : game.status === 'won' ? 'Adventure complete' : 'Run ended'}</span>
            <button className="icon-button" aria-label="Open settings" onClick={() => setPanel('settings')}><SettingsIcon size={18} /></button>
          </div>
        </header>

        {warning && <div className="notice" role="alert"><span>{warning}</span>{!saveError && <button className="icon-button" aria-label="Dismiss notice" onClick={() => { setNotice(null); setSession((current) => ({ ...current, error: null })) }}><X size={17} /></button>}</div>}

        <div className="workspace-content">
          {screen.type === 'timeline' && (game.visit ? <DestinationView game={game} reducedMotion={reducedMotion} onAction={act} /> : <Timeline save={save} blocked={blocked} interactionOpen={interactionOpen} lastDirection={lastDirection} reducedMotion={reducedMotion} onChoose={choose} onAction={act} onPanel={setPanel} onRestart={restart} />)}
          {screen.type === 'search' && <ExplorePage game={game} social={save.social} onVisit={(destinationId) => act({ type: 'START_VISIT', destinationId })} onProfile={openProfile} onResume={() => navigate({ type: 'timeline' })} />}
          {screen.type === 'profile' && <HeroProfilePage save={save} journal={<Journal game={game} />} onAction={socialAct} onOpenProfile={openProfile} onInventory={() => setPanel('inventory')} onRestart={restart} onSearch={() => navigate({ type: 'search' })} />}
          {screen.type === 'adventurer' && <AdventurerProfilePage social={save.social} id={screen.id} backLabel={`Back to ${screen.origin}`} onBack={() => navigate({ type: screen.origin })} onAction={socialAct} onChat={() => navigate({ ...screen, type: 'chat' })} onStories={() => openStory(screen.id)} />}
          {screen.type === 'chat' && <GiftChat save={save} id={screen.id} onBack={() => navigate({ ...screen, type: 'adventurer' })} onAction={socialAct} />}
        </div>
      </div>

      <nav className="mobile-navigation" aria-label="Primary navigation">{PRIMARY_NAV.map((item) => <button key={item.type} aria-current={primaryScreen === item.type ? 'page' : undefined} onClick={() => navigate({ type: item.type })}><item.icon size={20} strokeWidth={1.6} /><span>{item.label}</span></button>)}<button aria-haspopup="dialog" onClick={() => setPanel('tools')}><Ellipsis size={20} /><span>More</span></button></nav>
      {story && <StoryViewer id={story.id} index={story.index} social={save.social} reducedMotion={reducedMotion} restoreFocusTo={storyTrigger.current} onIndex={(index) => setStory((current) => current ? { ...current, index } : current)} onClose={() => setStory(null)} onProfile={() => openProfile(story.id)} />}

      {panel === 'tools' && <Modal restoreFocusTo={dialogTrigger.current} title="Adventure tools" eyebrow={`Floor ${game.floor} / Run #${String(game.runNumber).padStart(3, '0')}`} onClose={() => setPanel(null)} className="tools-modal">
        <div className="tool-stats"><span><Coins size={16} />{player.gold} gold</span><span><Sparkles size={16} />Level {player.level}</span><span>{player.level === 10 ? 'Maximum level' : `${player.xp} / ${experienceTarget(player.level)} XP`}</span></div>
        <nav className="tool-menu" aria-label="Adventure tools">{nav.map((item) => <button key={item.label} className="nav-item" aria-haspopup="dialog" onClick={() => setPanel(item.panel)}><item.icon size={19} />{item.label}</button>)}<button className="nav-item" aria-label="Open settings" aria-haspopup="dialog" onClick={() => setPanel('settings')}><SettingsIcon size={19} />Settings</button><button className="nav-item" aria-haspopup="dialog" onClick={() => setPanel('help')}><HelpCircle size={19} />How to play</button></nav>
        <button className="outline-button full-width" onClick={restart}><Plus size={16} />New adventure</button>
        <StoriesStrip social={save.social} onOpen={openStory} />
        <EncounterHistory game={game} />
        <p className="save-status"><span className={saveError ? 'unsaved-dot' : 'saved-dot'} />{saveError ? 'Progress is not saving' : 'Your adventure saves as you go'}</p>
      </Modal>}

      {game.dialogue && screen.type === 'timeline' && <Modal restoreFocusTo={dialogTrigger.current} title={room.name} eyebrow="A voice beside the fire" onClose={() => act({ type: 'CLOSE_DIALOGUE' })} className="dialogue-modal">
        <div className="dialogue-portrait"><Portrait large /><Flame size={19} /></div>
        <p className="dialogue-line">{getDialogue(room.id).opening}</p>
        <div className="dialogue-responses">{(['rumor', 'rest', 'trade'] as const).map((response) => {
          const option = getDialogue(room.id).responses[response]
          const reason = npcId ? npcResponseUnavailable(game, npcId, response) : 'This traveler is unavailable.'
          return <button className="dialogue-response" key={response} disabled={Boolean(reason)} onClick={() => act({ type: 'RESPOND_NPC', response })}><span><strong>{option.label}</strong><small>{reason ?? option.hint}</small></span><ArrowRight size={16} /></button>
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

      {panel === 'inventory' && <Modal restoreFocusTo={dialogTrigger.current} title="Your satchel" eyebrow="A few things between you and the dark" onClose={() => setPanel(null)}>
        <div className="inventory-item"><span className="item-icon"><FlaskConical size={24} /></span><div><h3>Healing tonic <span className="item-count">x{player.potions}</span></h3><p>Restores up to 24 health. A little courage in a bottle.</p></div><button className="outline-button" aria-label="Drink healing tonic" disabled={inventoryBlocked || player.potions === 0 || player.health === player.maxHealth} onClick={() => act({ type: 'DRINK_POTION' })}>Drink</button></div>
        <div className="inventory-item"><span className="item-icon aether-icon"><WandSparkles size={24} /></span><div><h3>Aether vial <span className="item-count">x{player.aether}</span></h3><p>Restores up to 14 mana. A stolen breath of starlight.</p></div><button className="outline-button" aria-label="Drink aether vial" disabled={inventoryBlocked || player.aether === 0 || player.mana === player.maxMana} onClick={() => act({ type: 'DRINK_AETHER' })}>Drink</button></div>
        {game.visit && <p className="modal-footnote" role="status">Finish your side trip before drinking supplies.</p>}
        <h3 className="inventory-heading">Equipped relics<span>{player.relics.length} / 3</span></h3>
        <RelicList relics={player.relics} />
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
        <p className="modal-description">New floors have twelve rooms and monsters of different toughness. Search opens playable side trips after every five completed dungeon rooms. Profiles and stories feature fictional adventurers; preset-only chats offer free gifts and up to three small return-gift boosts per run.</p>
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
        <p className="modal-description">{game.status === 'active' ? 'This ends your current run. Your gold, levels, relics, and gift boosts reset; your best floor and completed adventures stay.' : 'A fresh route, a full health bar, and another chance. Your best floor and completed adventures stay with you.'} Your profile, following, and conversations stay in this browser.</p>
        <fieldset className="class-picker"><legend>Choose your adventurer</legend>{CLASS_IDS.map((id) => <label key={id} className={nextClass === id ? 'selected' : ''}><input type="radio" name="class" value={id} checked={nextClass === id} onChange={() => setNextClass(id)} /><span><strong>{CLASSES[id].name}</strong><small>{CLASSES[id].title}</small><span className="class-numbers">HP {CLASSES[id].stats.maxHealth} <span>/</span> STR {CLASSES[id].stats.strength} <span>/</span> DEX {CLASSES[id].stats.dexterity}</span></span></label>)}</fieldset>
        <button className="gold-button full-width" onClick={newRun}>Begin a new adventure<ArrowRight size={17} /></button>
      </Modal>}
    </div>
  )
}
