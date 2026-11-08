import { useEffect, useRef } from 'react'
import { ArrowLeft, Gift, MessageCircle } from 'lucide-react'
import { giftUnavailable } from '../game/engine'
import type { SavedGame } from '../game/types'
import { ADVENTURERS, GIFTS, MESSAGES } from '../social/content'
import { GIFT_IDS, PRESET_IDS } from '../social/types'
import type { AdventurerId, SocialAction } from '../social/types'
import { Portrait } from './Portrait'

export function GiftChat({ save, id, onBack, onAction }: {
  save: SavedGame
  id: AdventurerId
  onBack: () => void
  onAction: (action: SocialAction) => void
}) {
  const adventurer = ADVENTURERS[id]
  const entries = save.social.messages.filter((entry) => entry.adventurerId === id)
  const log = useRef<HTMLDivElement>(null)
  const latest = entries.at(-1)?.id
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [latest])
  return (
    <main id="social-screen" tabIndex={-1} className="social-page chat-page">
      <button className="text-button page-back" onClick={onBack}><ArrowLeft size={16} />Back to {adventurer.name} profile</button>
      <header className="chat-header"><Portrait appearance={adventurer.appearance} /><div><span className="fiction-label">Simulated chat</span><h1 id="screen-heading" tabIndex={-1}>{adventurer.name}</h1></div><MessageCircle size={23} /></header>
      <p className="page-intro">A fictional traveler, not a connected player. Choose a message or give a little help. Everything happens in this browser.</p>
      <div ref={log} className="conversation" role="log" aria-label={`Conversation with ${adventurer.name}`} aria-live="polite" aria-relevant="additions text">
        {!entries.length && <p className="conversation-empty">Start with a greeting or a gift for the road.</p>}
        {entries.map((entry) => {
          const outgoing = entry.kind === 'sent-gift' || (entry.kind === 'preset' && entry.sender === 'hero')
          return <article className={`chat-bubble ${outgoing ? 'outgoing' : 'incoming'}`} key={entry.id}>
            <span className="message-sender">{outgoing ? save.social.hero.name : adventurer.name}</span>
            {entry.kind === 'preset' ? <p>{MESSAGES[entry.presetId]}</p> : entry.kind === 'sent-gift' ? <>
              <strong><Gift size={16} />{GIFTS[entry.giftId].name} given</strong>
              <p>{entry.boosted ? `${GIFTS[entry.giftId].effect} for their next fictional journey.` : 'They already have this boost. The gift is delivered locally without stacking more help.'}</p>
              <small>Free / No resources taken from you</small>
            </> : (() => {
              const expired = entry.runNumber !== save.game.runNumber
              const reason = !entry.claimed && !expired ? giftUnavailable(save.game, id, entry.giftId) : null
              return <><strong><Gift size={16} />{GIFTS[entry.giftId].name} from {adventurer.name}</strong><p>{GIFTS[entry.giftId].effect}.</p>
                {entry.claimed ? <span className="gift-receipt">Claimed</span> : expired ? <span className="gift-receipt">Expired / Previous run</span> : <><button className="gold-button" aria-label={`Claim ${GIFTS[entry.giftId].name.toLowerCase()} from ${adventurer.name}`} disabled={Boolean(reason)} aria-describedby={`gift-reason-${entry.id}`} onClick={() => onAction({ type: 'CLAIM_GIFT', messageId: entry.id })}>Claim {GIFTS[entry.giftId].name.toLowerCase()}</button><small id={`gift-reason-${entry.id}`}>{reason ?? 'A small boost for your active adventure.'}</small></>}
              </>
            })()}
          </article>
        })}
      </div>
      <p className="chat-hero-status" role="status">{save.social.hero.name}: {save.game.player.health} / {save.game.player.maxHealth} health, {save.game.player.mana} / {save.game.player.maxMana} mana. Gift boosts claimed: {save.game.giftClaims.length} / 3.</p>
      <section className="preset-composer" aria-label="Predefined messages"><h2>Say something</h2><p>Preset messages only. No custom text or notes.</p><div className="preset-buttons">{PRESET_IDS.map((presetId) => <button className="outline-button" key={presetId} onClick={() => onAction({ type: 'SEND_PRESET', adventurerId: id, presetId })}>{MESSAGES[presetId]}</button>)}</div></section>
      <section className="gift-catalogue" aria-label="Free gifts"><header><h2>Give a little help</h2><span>Always free</span></header><div>{GIFT_IDS.map((giftId) => <div className="gift-option" key={giftId}><span className={`gift-icon gift-${giftId}`}><Gift size={20} /></span><div><h3>{GIFTS[giftId].name}</h3><p>{GIFTS[giftId].effect}.</p></div><button className="outline-button" aria-label={`Give ${GIFTS[giftId].name.toLowerCase()}`} onClick={() => onAction({ type: 'GIVE_GIFT', adventurerId: id, giftId })}>Give</button></div>)}</div></section>
      <p className="modal-footnote">The first gift to a traveler can bring a return gift. At most three returns per run, claimed outside fights and unresolved interactions. Extra gifts remain free but cannot create extra returns or stack unlimited recipient boosts.</p>
    </main>
  )
}
