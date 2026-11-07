import { useState } from 'react'
import { ArrowLeft, ArrowRight, Coins, MapPin, Search, UserRound } from 'lucide-react'
import { CLASSES, getDialogue, ROOMS, SHOP_ITEMS } from '../game/content'
import { getVisitedDestination, npcResponseUnavailable, purchaseUnavailable, sideTripRemaining, visitUnavailable } from '../game/engine'
import { NPC_ROOM_IDS } from '../game/types'
import type { GameAction, GameState } from '../game/types'
import { DESTINATIONS, DESTINATION_IDS } from '../game/world'
import type { DestinationId } from '../game/world'
import { orderedAdventurers } from '../social/content'
import type { AdventurerId, SocialState } from '../social/types'
import { CharacterVitals } from './CharacterDetails'
import { PixelScene } from './PixelScene'
import { AdventurerLink } from './Profiles'

export function ExplorePage({ game, social, onVisit, onProfile, onResume }: {
  game: GameState
  social: SocialState
  onVisit: (id: DestinationId) => void
  onProfile: (id: AdventurerId) => void
  onResume: () => void
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const places = DESTINATION_IDS.map((id) => DESTINATIONS[id]).filter((place) => `${place.name} ${place.description}`.toLocaleLowerCase().includes(needle))
  const adventurers = orderedAdventurers(social).filter((adventurer) => `${adventurer.name} ${adventurer.home} ${CLASSES[adventurer.classId].name}`.toLocaleLowerCase().includes(needle))
  return (
    <main id="social-screen" tabIndex={-1} className="social-page explore-page">
      <p className="eyebrow">A world beyond the next room</p><h1 id="screen-heading" tabIndex={-1}>Search the world</h1>
      <p className="page-intro">Find a city, meet a traveler, or follow another adventurer's fictional journey.</p>
      <label className="world-search"><Search size={18} /><span className="sr-only">Search destinations and adventurers</span><input type="search" value={query} placeholder="Cities, travelers, adventurers..." onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <p className="trip-availability" role="status">{game.visit ? 'Your current side trip is waiting.' : sideTripRemaining(game) ? `Complete ${sideTripRemaining(game)} more room${sideTripRemaining(game) === 1 ? '' : 's'} before your next side trip.` : 'A side trip is ready when your current encounter is clear.'}</p>
      {game.visit && <button className="outline-button" onClick={onResume}>Resume side trip<ArrowRight size={15} /></button>}
      {!places.length && !adventurers.length && <div className="social-empty"><Search size={24} /><p>No destinations or adventurers found.</p><span>Try a place name, class, or a shorter search.</span></div>}
      {places.length > 0 && <section className="explore-section" aria-label="Destinations"><header><h2>Destinations</h2><span>Cities & NPC locations</span></header><div className="destination-list">{places.map((place) => {
        const reason = visitUnavailable(game, place.id)
        return <article className="destination-card" key={place.id}><div className="destination-heading"><span className={`destination-icon destination-${place.kind}`}>{place.kind === 'npc' ? <UserRound size={21} /> : place.kind === 'shop' ? <Coins size={21} /> : <MapPin size={21} />}</span><div><span className="eyebrow">{place.kind === 'city' ? 'City' : place.kind === 'npc' ? 'NPC location' : 'Market'}</span><h3>{place.name}</h3></div></div><p>{place.description}</p><div className="destination-visit"><button className="outline-button" aria-label={`Visit ${place.name}`} aria-describedby={`visit-reason-${place.id}`} disabled={Boolean(reason)} onClick={() => onVisit(place.id)}>Visit<ArrowRight size={14} /></button><span id={`visit-reason-${place.id}`}>{reason ?? 'Playable side trip / Return to the same encounter'}</span></div></article>
      })}</div></section>}
      {adventurers.length > 0 && <section className="explore-section" aria-label="Fictional adventurers"><header><h2>Adventurers</h2><span className="fiction-label">Fictional, not live players</span></header><div className="adventurer-list">{adventurers.map((adventurer) => <AdventurerLink key={adventurer.id} adventurer={adventurer} following={social.following.includes(adventurer.id)} onOpen={onProfile} />)}</div></section>}
    </main>
  )
}

export function DestinationView({ game, reducedMotion, onAction }: { game: GameState; reducedMotion: boolean; onAction: (action: GameAction) => void }) {
  const destination = getVisitedDestination(game)
  if (!destination) throw new Error('The side trip has no active destination.')
  const npcId = NPC_ROOM_IDS.find((id) => id === destination.roomId)
  const dialogue = destination.kind === 'npc' ? getDialogue(destination.roomId) : null
  return (
    <main id="social-screen" tabIndex={-1} className="social-page visit-page">
      <button className="text-button page-back" onClick={() => onAction({ type: 'END_VISIT' })}><ArrowLeft size={16} />Return to timeline</button>
      <p className="eyebrow">Side trip / Dungeon encounter paused</p><h1 id="screen-heading" tabIndex={-1}>{destination.name}</h1>
      <p className="page-intro">{destination.description}</p>
      <CharacterVitals player={game.player} />
      <p className="visit-gold"><Coins size={16} />{game.player.gold} gold in your satchel</p>
      <div className="visit-scene"><PixelScene room={ROOMS[destination.roomId]} floor={destination.floor} seed={game.seed} reducedMotion={reducedMotion} /></div>
      {destination.kind === 'city' && <section className="visit-options" aria-label="City exploration">
        <button className="gold-button full-width" disabled={game.worldExplored.includes(destination.id)} onClick={() => onAction({ type: 'EXPLORE_CITY' })}>Explore the streets<ArrowRight size={15} /></button>
        <p className="field-hint">{game.worldExplored.includes(destination.id) ? 'These streets are charted. You can still visit the local travelers and market.' : 'Chart the old roads for 2 XP, once per city per run.'}</p>
        <h2>Places in {destination.name}</h2><div className="venue-list">{destination.venues.map((id) => <button className="venue-button" key={id} onClick={() => onAction({ type: 'VISIT_VENUE', destinationId: id })}><span><strong>Visit {DESTINATIONS[id].name}</strong><small>{DESTINATIONS[id].description}</small></span><ArrowRight size={17} /></button>)}</div>
      </section>}
      {dialogue && npcId && <section className="visit-options" aria-label="Traveler interaction"><p className="dialogue-line">{dialogue.opening}</p><div className="dialogue-responses">{(['rumor', 'rest', 'trade'] as const).map((response) => {
        const option = dialogue.responses[response]
        const reason = npcResponseUnavailable(game, npcId, response)
        return <div className="visit-response" key={response}><button className="dialogue-response" disabled={Boolean(reason)} aria-describedby={`npc-reason-${response}`} onClick={() => onAction({ type: 'VISIT_RESPONSE', response })}><strong>{option.label}</strong><ArrowRight size={16} /></button><p id={`npc-reason-${response}`} className="field-hint">{reason ?? option.hint}</p></div>
      })}</div></section>}
      {destination.kind === 'shop' && <section className="visit-options" aria-label="Merchant supplies">{(['tonic', 'aether', 'iron-charm'] as const).map((id) => {
        const item = SHOP_ITEMS[id]
        const reason = purchaseUnavailable(game, id)
        return <div className="world-shop-item" key={id}><div><h2>{item.name}<span>{item.price} gold</span></h2><p>{item.effect}</p><small id={`shop-reason-${id}`}>{reason}</small></div><button className="outline-button" aria-label={`Buy ${item.name.toLowerCase()}`} aria-describedby={`shop-reason-${id}`} disabled={Boolean(reason)} onClick={() => onAction({ type: 'VISIT_BUY', item: id })}>Buy</button></div>
      })}</section>}
      {game.visit?.venueId && <button className="outline-button full-width" onClick={() => onAction({ type: 'RETURN_TO_CITY' })}><ArrowLeft size={15} />Back to the city</button>}
      <p className={`action-feedback feedback-${game.feedback.type}`} role="status">{game.feedback.text}</p>
      <p className="modal-footnote">This trip uses your current hero. It does not advance the dungeon or count toward another trip. Complete five more dungeon rooms after returning to travel again.</p>
    </main>
  )
}
