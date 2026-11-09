import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Backpack, Crown, DoorOpen, Eye, Flame, FlaskConical, Heart, Map, UserRound, WandSparkles } from 'lucide-react'
import { getRegion, ROOMS } from '../game/content'
import { getChoices, getRoom, getRoomPresentation } from '../game/engine'
import { INSCRIPTION_ROOM_IDS } from '../game/types'
import type { Direction, GameAction, GameState, SavedGame } from '../game/types'
import { useRoomGestures } from '../useRoomGestures'
import { CombatStatus, SpellBar } from './CombatControls'
import { PixelScene } from './PixelScene'

const DIRECTIONS = {
  left: { icon: ArrowLeft, shortcut: 'ArrowLeft' },
  up: { icon: ArrowUp, shortcut: 'ArrowUp' },
  right: { icon: ArrowRight, shortcut: 'ArrowRight' },
}
const OUTCOMES = { explored: 'Explored', passed: 'Moved onward', victory: 'Victory', retreated: 'Retreated' }

export function EncounterHistory({ game }: { game: GameState }) {
  const entries = [...game.history].reverse().filter((entry) => entry.roomId !== getRoom(game).id)
  if (!entries.length) return null
  return (
    <section className="encounter-history" aria-label="Past encounters">
      <header><h2>The road behind you</h2><span>Read-only field notes</span></header>
      {entries.map((entry) => {
        const room = ROOMS[entry.roomId]
        return <article className={`history-post ${entry.known ? '' : 'history-unknown'}`} key={entry.sequence}>
          <div className="history-scene"><PixelScene room={room} floor={entry.floor} seed={game.seed + entry.sequence} known={entry.known} paused reducedMotion /></div>
          <div><span className="eyebrow">Floor {entry.floor} / {entry.known ? OUTCOMES[entry.outcome] : 'Passed unseen'}</span><h3>{entry.known ? room.name : 'An unidentified presence'}</h3><p>{entry.known ? room.description : 'You left this encounter without uncovering its identity. Its secrets stay in the dark.'}</p></div>
        </article>
      })}
    </section>
  )
}

export function Timeline({ save, blocked, interactionOpen, lastDirection, reducedMotion, onChoose, onAction, onPanel, onRestart }: {
  save: SavedGame
  blocked: boolean
  interactionOpen: boolean
  lastDirection: Direction
  reducedMotion: boolean
  onChoose: (direction: Direction, trigger?: HTMLElement) => void
  onAction: (action: GameAction) => void
  onPanel: (panel: 'inventory' | 'spells' | 'map') => void
  onRestart: () => void
}) {
  const game = save.game
  const player = game.player
  const room = getRoom(game)
  const region = getRegion(game.floor)
  const presentation = getRoomPresentation(game)
  const choices = getChoices(game)
  const gestures = useRoomGestures(onChoose, !blocked)
  const fighting = game.combat?.result === 'fighting'
  const victorious = game.combat?.result === 'victory'
  const inscription = INSCRIPTION_ROOM_IDS.some((id) => id === room.id)
  const readInscription = game.searched.some((id) => id === room.id)
  const dock = useRef<HTMLDivElement>(null)
  const status = useRef<HTMLElement>(null)
  const [foregroundInsets, setForegroundInsets] = useState({ top: 0, bottom: 0 })
  useLayoutEffect(() => {
    const encounter = gestures.element.current
    const controls = dock.current
    const vitals = status.current
    if (!encounter || !controls || !vitals) throw new Error('The fullscreen encounter is missing its scene or controls.')
    const measure = () => {
      const bounds = encounter.getBoundingClientRect()
      const next = {
        top: vitals.getBoundingClientRect().bottom - bounds.top + 12,
        bottom: bounds.bottom - controls.getBoundingClientRect().top + 12,
      }
      setForegroundInsets((current) => current.top === next.top && current.bottom === next.bottom ? current : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(encounter)
    observer.observe(controls)
    observer.observe(vitals)
    measure()
    return () => observer.disconnect()
  }, [gestures.element])
  return (
    <main id="adventure" tabIndex={-1}>
      <div id="live-encounter" ref={gestures.element} {...gestures.handlers}>
        <div className="room-stage">
          <div className={`room-card ${gestures.drag.x || gestures.drag.y ? 'dragging' : ''}`} style={{ transform: `translate(${gestures.drag.x}px, ${gestures.drag.y}px)` }}>
            <div className={`room-content room-enter-${lastDirection}`} key={`${game.runNumber}-${game.floor}-${game.roomIndex}`}>
              <div className="scene-frame">
                <PixelScene room={room} floor={game.floor} seed={game.seed + game.roomIndex} known={presentation.known} combat={game.combat} feedback={game.feedback} reducedMotion={reducedMotion} paused={interactionOpen || game.status !== 'active'} foregroundInsets={foregroundInsets} />
                <div className="scene-shade" />
                <div className="scene-interactions" style={foregroundInsets}>
                {game.feedback.type === 'reveal' && <div className="discovery-flare" key={`reveal-${game.feedback.id}`} aria-hidden="true"><span>Discovered</span></div>}
                {game.feedback.type === 'phase' && <div className="phase-flare" key={`phase-${game.feedback.id}`} aria-hidden="true"><span>Something else awakens</span></div>}
                {!victorious && game.status === 'active' && <div className="scene-hotspots">
                  {!fighting && inscription && <button className={`scene-hotspot inscription-hotspot ${readInscription ? 'spent' : ''}`} aria-label="Inspect the hidden inscription" disabled={blocked || readInscription} onClick={() => onAction({ type: 'INSPECT_INSCRIPTION' })}><Eye size={16} /><span>{readInscription ? 'Read' : 'Inspect'}</span></button>}
                  {!fighting && room.kind === 'npc' && <button className="scene-hotspot person-hotspot" aria-label="Speak to the stranger" disabled={blocked} onClick={() => onChoose('left')}><UserRound size={16} /><span>Talk</span></button>}
                  {!fighting && room.kind === 'treasure' && <button className="scene-hotspot treasure-hotspot" aria-label="Examine the chest" disabled={blocked} onClick={() => onChoose('up')}><Backpack size={16} /><span>Open</span></button>}
                  {(room.kind === 'combat' || room.kind === 'boss') && !presentation.known && <button className="scene-hotspot lantern-hotspot" aria-label="Reveal the hidden presence" disabled={blocked || player.mana < 2} onClick={() => onChoose('right')}><Flame size={16} /><span>Reveal</span></button>}
                  {fighting && <button className={`scene-hotspot lantern-hotspot ${game.studied ? 'spent' : ''}`} aria-label="Study enemy" disabled={blocked || game.studied || player.mana < 3} onClick={() => onAction({ type: 'STUDY_ENEMY' })}><Eye size={16} /><span>{game.studied ? 'Known' : '3 mana'}</span></button>}
                  {fighting && room.kind === 'combat' && <button className="scene-hotspot retreat-hotspot" aria-label="Retreat" disabled={blocked} onClick={() => onAction({ type: 'FLEE' })}><DoorOpen size={16} /><span>Retreat</span></button>}
                </div>}
                {victorious && <div className="victory-reveal"><Crown size={23} /><strong>{room.kind === 'boss' ? 'The passage opens.' : 'The path is clear.'}</strong><span>Gold and experience collected</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
        <header className="adventure-header">
          <h1 id="screen-heading" tabIndex={-1} className="sr-only">{region.name}</h1>
          <button className="floor-badge" onClick={() => onPanel('map')}><span className="sr-only">View journey map. </span><Map size={17} /><span>Floor {String(game.floor).padStart(2, '0')}<small>Room {game.roomIndex + 1} / {game.deck.length}</small></span></button>
          <div className="action-rail" role="group" aria-label="Quick actions">
            <div className="potion-rail"><button className="rail-button potion-button" aria-label="Drink a healing tonic" aria-describedby="tonic-count" disabled={blocked || player.potions === 0 || player.health === player.maxHealth} onClick={() => onAction({ type: 'DRINK_POTION' })}><FlaskConical size={21} /></button><span id="tonic-count" className="rail-count"><span className="sr-only">Tonics remaining: </span>{player.potions}</span></div>
            <button className="rail-button" aria-label="Open your satchel" aria-haspopup="dialog" onClick={() => onPanel('inventory')}><Backpack size={21} /></button>
            <button className="rail-button magic-rail" aria-label="Open your grimoire" aria-haspopup="dialog" onClick={() => onPanel('spells')}><WandSparkles size={21} /></button>
          </div>
        </header>
        <section ref={status} className="player-stats" aria-label="Adventurer status">
          <div className="health-stat"><div className="stat-top"><span><Heart size={13} /><span className="sr-only">Health</span></span><strong>{player.health}<span> / {player.maxHealth}</span></strong></div><progress aria-label="Health" max={player.maxHealth} value={player.health} className={player.health <= player.maxHealth * 0.25 ? 'critical' : ''} /></div>
          <div className="mana-stat"><div className="stat-top"><span><WandSparkles size={13} /><span className="sr-only">Mana</span></span><strong>{player.mana}<span> / {player.maxMana}</span></strong></div><progress aria-label="Mana" max={player.maxMana} value={player.mana} /></div>
        </section>
        <div ref={dock} className="encounter-dock">
          {game.status === 'active' && <div className="room-copy">
            <div className="room-title-row"><h2 id="room-title" tabIndex={-1}>{presentation.name}</h2>{presentation.known && (room.kind === 'combat' || room.kind === 'boss') && <span className={`enemy-weakness weakness-${room.enemy.weakness}`}>Weak to {room.enemy.weakness}</span>}</div>
            {game.combat ? <CombatStatus game={game} /> : <p>{presentation.description}</p>}
          </div>}
          {game.status === 'active' ? <div className="encounter-actions">
            <div className={`choice-buttons ${choices.length === 1 ? 'single-choice' : ''}`} role="group" aria-label="Choose your next move">{choices.map((choice) => {
              const { icon: Icon, shortcut } = DIRECTIONS[choice.direction]
              return (
                <div key={choice.direction} className={`choice-option ${choice.direction === 'up' ? 'primary-option' : ''}`}>
                  <button className={`choice-button ${choice.direction === 'up' ? 'primary-choice' : ''}`} aria-describedby={`choice-hint-${choice.direction}`} aria-keyshortcuts={shortcut} disabled={choice.disabled || blocked} onClick={(event) => onChoose(choice.direction, event.currentTarget)}>
                    {save.settings.hints && <Icon size={16} aria-hidden="true" />}
                    <strong>{choice.label}</strong>
                  </button>
                  <small id={`choice-hint-${choice.direction}`} className="choice-hint">{choice.hint}</small>
                </div>
              )
            })}</div>
            {fighting && <SpellBar game={game} disabled={blocked} onAction={onAction} />}
          </div> : <section className={`run-summary ${game.status === 'won' ? 'victory' : ''}`} aria-label="Run summary">{game.status === 'won' ? <Crown size={27} /> : <Flame size={27} />}<div><h2>{game.status === 'won' ? 'You lived to tell the tale.' : 'Every ending is a beginning.'}</h2><p>{game.roomsCleared} rooms explored. {player.gold} gold found. {game.status === 'dead' ? 'A new path is waiting.' : 'The three guardians have fallen.'}</p></div><button className="gold-button" onClick={onRestart}>Try a new adventure<ArrowRight size={16} /></button></section>}
          {room.kind === 'shop' && game.status === 'active' && <button className="outline-button merchant-extra" disabled={blocked || player.gold < 12 || player.aether >= 1000} onClick={() => onAction({ type: 'BUY_AETHER' })}><WandSparkles size={15} />Buy an aether vial / 12 gold</button>}
          {game.feedback.id > 0 && <p className={`action-feedback feedback-${game.feedback.type}`} key={`feedback-${game.feedback.id}`} role="status">{game.feedback.text || (victorious ? 'The way is clear. Continue when you are ready.' : 'Your next move is yours.')}</p>}
        </div>
        <p className="sr-only" role="status" aria-atomic="true">{presentation.name}. Health {player.health} of {player.maxHealth}. Mana {player.mana} of {player.maxMana}. {player.gold} gold.</p>
      </div>
    </main>
  )
}
