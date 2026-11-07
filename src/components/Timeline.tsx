import { ArrowLeft, ArrowRight, ArrowUp, Backpack, Coins, Compass, Crown, DoorOpen, Eye, Flame, FlaskConical, Heart, Map, Mouse, Sparkles, UserRound, Volume2, VolumeX, WandSparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getRegion, ROOMS, ROOM_LABELS } from '../game/content'
import { experienceTarget, getChoices, getRoom, getRoomPresentation } from '../game/engine'
import { INSCRIPTION_ROOM_IDS } from '../game/types'
import type { Direction, GameAction, GameState, SavedGame } from '../game/types'
import type { AdventurerId } from '../social/types'
import { useRoomGestures } from '../useRoomGestures'
import { CombatStatus, SpellBar } from './CombatControls'
import { PixelScene } from './PixelScene'
import { StoriesStrip } from './Stories'

const DIRECTIONS = { left: ArrowLeft, up: ArrowUp, right: ArrowRight }
const OUTCOMES = { explored: 'Explored', passed: 'Moved onward', victory: 'Victory', retreated: 'Retreated' }

function EncounterHistory({ game }: { game: GameState }) {
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

export function Timeline({ save, blocked, interactionOpen, lastDirection, reducedMotion, saveError, encounterIcon: EncounterIcon, onChoose, onAction, onPanel, onRestart, onToggleSound, onStory }: {
  save: SavedGame
  blocked: boolean
  interactionOpen: boolean
  lastDirection: Direction
  reducedMotion: boolean
  saveError: string | null
  encounterIcon: LucideIcon
  onChoose: (direction: Direction, trigger?: HTMLElement) => void
  onAction: (action: GameAction) => void
  onPanel: (panel: 'inventory' | 'spells' | 'map') => void
  onRestart: () => void
  onToggleSound: () => void
  onStory: (id: AdventurerId) => void
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
  return (
    <main id="adventure" tabIndex={-1} className={fighting ? 'combat-active' : victorious ? 'combat-won' : ''}>
      <StoriesStrip social={save.social} onOpen={onStory} />
      <div id="live-encounter">
        <header className="adventure-header"><div><h1 id="screen-heading" tabIndex={-1}>{region.name}</h1><p className="region-subtitle">{region.subtitle}</p><span className="floor-number">Floor {String(game.floor).padStart(2, '0')}</span></div><button className="floor-badge" onClick={() => onPanel('map')} aria-label="View journey map"><Map size={17} /><span>Map</span></button></header>
        <section className="player-stats" aria-label="Adventurer status">
          <div className="health-stat"><div className="stat-top"><span><Heart size={15} />Health</span><strong>{player.health}<span> / {player.maxHealth}</span></strong></div><progress aria-label="Health" max={player.maxHealth} value={player.health} className={player.health <= player.maxHealth * 0.25 ? 'critical' : ''} /><div className="mana-stat"><div className="stat-top"><span><WandSparkles size={13} />Mana</span><strong>{player.mana}<span> / {player.maxMana}</span></strong></div><progress aria-label="Mana" max={player.maxMana} value={player.mana} /></div></div>
          <div className="gold-stat"><Coins size={20} /><div><span className="stat-label">Gold</span><strong>{player.gold}<small>g</small></strong></div></div>
          <div className="level-stat"><Sparkles size={19} /><div><div className="stat-top"><span className="stat-label">Level</span><strong>{player.level}</strong></div><progress aria-label="Experience" value={player.level === 10 ? 1 : player.xp} max={player.level === 10 ? 1 : experienceTarget(player.level)} /></div></div>
        </section>
        <div className="room-stage">
          <div ref={gestures.element} className={`room-card ${gestures.drag.x || gestures.drag.y ? 'dragging' : ''}`} style={{ transform: `translate(${gestures.drag.x}px, ${gestures.drag.y}px) rotate(${gestures.drag.x / 22}deg)` }} {...gestures.handlers}>
            <div className={`room-content room-enter-${lastDirection}`} key={`${game.runNumber}-${game.floor}-${game.roomIndex}`}>
              <div className="scene-frame">
                <PixelScene room={room} floor={game.floor} seed={game.seed + game.roomIndex} known={presentation.known} combat={game.combat} feedback={game.feedback} reducedMotion={reducedMotion} paused={interactionOpen || game.status !== 'active'} />
                <div className="scene-shade" />
                <div className="scene-header"><span><Compass size={12} />{room.zone === 'overworld' ? 'The overworld' : region.dungeon}</span><span>{String(game.roomIndex + 1).padStart(2, '0')}<span className="room-total"> / {game.deck.length}</span></span></div>
                <div className="scene-footer"><span className={`encounter-tag ${presentation.known && room.kind === 'boss' ? 'boss-tag' : ''}`}><EncounterIcon size={12} />{presentation.known ? ROOM_LABELS[room.kind] : 'Unseen presence'}</span><span className="pixel-label">{fighting ? 'Steel is not your only answer.' : 'A place yet to be remembered'}</span></div>
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
              <div className="room-copy"><div className="room-title-row"><h2 id="room-title" tabIndex={-1}>{presentation.name}</h2>{presentation.known && (room.kind === 'combat' || room.kind === 'boss') && <span className={`enemy-weakness weakness-${room.enemy.weakness}`}>Weak to {room.enemy.weakness}</span>}</div>
                {game.combat ? <CombatStatus game={game} /> : <p>{presentation.description}</p>}
                {!game.combat && <div className="room-copy-footer"><span><span className="small-diamond" />{game.status === 'active' ? 'Your next move is yours.' : 'The story of this run is written.'}</span><span>{room.zone === 'overworld' ? 'Outside' : 'Inside'}<DoorOpen size={12} /></span></div>}
              </div>
            </div>
            <span className="frame-corner top-left" /><span className="frame-corner top-right" /><span className="frame-corner bottom-left" /><span className="frame-corner bottom-right" />
          </div>
          <div className="action-rail" role="group" aria-label="Quick actions">
            <div className="potion-rail"><button className="rail-button potion-button" aria-label="Drink a healing tonic" aria-describedby="tonic-count" disabled={blocked || player.potions === 0 || player.health === player.maxHealth} onClick={() => onAction({ type: 'DRINK_POTION' })}><FlaskConical size={21} /><span>Tonic</span></button><span id="tonic-count" className="rail-count"><span className="sr-only">Tonics remaining: </span>{player.potions}</span></div>
            <button className="rail-button" aria-label="Open your satchel" onClick={() => onPanel('inventory')}><Backpack size={21} /><span>Satchel</span></button>
            <button className="rail-button magic-rail" aria-label="Open your grimoire" onClick={() => onPanel('spells')}><WandSparkles size={21} /><span>Grimoire</span></button>
            <button className="rail-button map-rail" aria-label="View your journey" onClick={() => onPanel('map')}><Map size={21} /><span>Journey</span></button>
            <button className={`rail-button sound-rail ${save.settings.sound ? 'sound-active' : ''}`} aria-label={save.settings.sound ? 'Mute sound' : 'Enable sound'} aria-pressed={save.settings.sound} onClick={onToggleSound}>{save.settings.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}<span>Sound</span></button>
          </div>
        </div>
        {game.status === 'active' ? <div className={`encounter-actions ${fighting ? 'fighting-actions' : ''}`}>
          <div className={`choice-buttons ${choices.length === 1 ? 'single-choice' : ''}`} role="group" aria-label="Choose your next move">{choices.map((choice) => {
            const Icon = DIRECTIONS[choice.direction]
            return <div key={choice.direction} className={`choice-option ${choice.direction === 'up' ? 'primary-option' : ''}`}><button className={`choice-button ${choice.direction === 'up' ? 'primary-choice' : ''}`} aria-describedby={`choice-key-${choice.direction} choice-hint-${choice.direction}`} disabled={choice.disabled || blocked} onClick={(event) => onChoose(choice.direction, event.currentTarget)}><strong>{choice.label}</strong></button><span id={`choice-key-${choice.direction}`} className="choice-key"><Icon size={15} /><span>{choice.direction === 'up' ? 'Swipe up' : `Swipe ${choice.direction}`}</span></span><small id={`choice-hint-${choice.direction}`} className="choice-hint">{choice.hint}</small></div>
          })}</div>
          {fighting && <SpellBar game={game} disabled={blocked} onAction={onAction} />}
        </div> : <section className={`run-summary ${game.status === 'won' ? 'victory' : ''}`} aria-label="Run summary">{game.status === 'won' ? <Crown size={27} /> : <Flame size={27} />}<div><h2>{game.status === 'won' ? 'You lived to tell the tale.' : 'Every ending is a beginning.'}</h2><p>{game.roomsCleared} rooms explored. {player.gold} gold found. {game.status === 'dead' ? 'A new path is waiting.' : 'The three guardians have fallen.'}</p></div><button className="gold-button" onClick={onRestart}>Try a new adventure<ArrowRight size={16} /></button></section>}
        {room.kind === 'shop' && <button className="outline-button merchant-extra" disabled={blocked || player.gold < 12 || player.aether >= 1000} onClick={() => onAction({ type: 'BUY_AETHER' })}><WandSparkles size={15} />Buy an aether vial / 12 gold</button>}
        {game.feedback.id > 0 && <p className={`action-feedback feedback-${game.feedback.type}`} key={`feedback-${game.feedback.id}`} role="status">{game.feedback.text || (victorious ? 'The way is clear. Continue when you are ready.' : 'Your next move is yours.')}</p>}
        {save.settings.hints && !fighting && <div className="gesture-hint"><Mouse size={14} /><span>Scroll or swipe to explore</span><span className="hint-separator" /><span className="keyboard-hint">Arrow keys work, too</span><span className="mobile-key-hint">Tap a choice below the room</span></div>}
        <div className="save-status"><span className={saveError ? 'unsaved-dot' : 'saved-dot'} />{saveError ? 'Progress is not saving' : 'Your adventure saves as you go'}<span className="save-status-rule" /><span>Run #{String(game.runNumber).padStart(3, '0')}</span></div>
        <p className="sr-only" role="status" aria-atomic="true">{presentation.name}. Health {player.health} of {player.maxHealth}. Mana {player.mana} of {player.maxMana}. {player.gold} gold.</p>
      </div>
      <EncounterHistory game={game} />
    </main>
  )
}
