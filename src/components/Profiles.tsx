import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Backpack, MapPin, MessageCircle, Pencil, UserPlus } from 'lucide-react'
import { CLASSES } from '../game/content'
import { experienceTarget } from '../game/engine'
import type { SavedGame } from '../game/types'
import { ADVENTURERS, boostedAdventurer } from '../social/content'
import type { Adventurer } from '../social/content'
import { heroProfileSchema, PORTRAIT_PALETTES, PORTRAIT_STYLES } from '../social/types'
import type { AdventurerId, HeroProfile, SocialAction, SocialState } from '../social/types'
import { CharacterAttributes, CharacterVitals, RelicList } from './CharacterDetails'
import { Portrait } from './Portrait'

const STYLE_NAMES = { hood: 'Hood', braids: 'Braids', helm: 'Helm' }
const PALETTE_NAMES = { sage: 'Sage', ember: 'Ember', aether: 'Aether' }

export function AdventurerLink({ adventurer, following = false, onOpen }: { adventurer: Adventurer; following?: boolean; onOpen: (id: AdventurerId) => void }) {
  return <button className="adventurer-result" title={`View ${adventurer.name} profile`} onClick={() => onOpen(adventurer.id)}><Portrait appearance={adventurer.appearance} /><span><strong>{adventurer.name}</strong><small>{CLASSES[adventurer.classId].name} / {adventurer.home}{following ? ' / Following' : ''}</small></span><ArrowRight size={16} /></button>
}

export function GiftHelp({ social, id }: { social: SocialState; id: AdventurerId }) {
  const boost = social.boosts[id]
  const effects = [
    boost.health ? `+${boost.health} health` : '',
    boost.mana ? `+${boost.mana} mana` : '',
    boost.strength ? `+${boost.strength} strength` : '',
  ].filter(Boolean)
  return <p className="gift-help">{effects.length ? `Gift help for their next fictional journey: ${effects.join(', ')}.` : 'Your gifts can give this fictional adventurer a little help on their next journey.'}</p>
}

function ProfileEditor({ profile, onSave, onCancel }: { profile: HeroProfile; onSave: (profile: HeroProfile) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(profile)
  const [error, setError] = useState<string | null>(null)
  const name = useRef<HTMLInputElement>(null)
  useEffect(() => { name.current?.focus() }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = heroProfileSchema.safeParse(draft)
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check your profile choices.'); name.current?.focus(); return }
    onSave(result.data)
  }
  return (
    <form className="profile-editor" onSubmit={submit}>
      <label htmlFor="hero-name">Adventurer name</label>
      <input ref={name} id="hero-name" type="text" value={draft.name} maxLength={32} aria-invalid={Boolean(error)} aria-describedby="name-help name-error" onChange={(event) => { setDraft({ ...draft, name: event.currentTarget.value }); setError(null) }} />
      <p id="name-help" className="field-hint">1-32 characters. Your class and stats stay unchanged.</p>
      <p id="name-error" className="field-error" role="alert">{error}</p>
      <fieldset className="appearance-picker"><legend>Portrait style</legend><div>{PORTRAIT_STYLES.map((style) => (
        <label key={style} className={`appearance-choice ${draft.appearance.style === style ? 'selected' : ''}`}>
          <input type="radio" name="portrait-style" checked={draft.appearance.style === style} onChange={() => setDraft({ ...draft, appearance: { ...draft.appearance, style } })} />
          <Portrait appearance={{ ...draft.appearance, style }} /><span>{STYLE_NAMES[style]}</span>
        </label>
      ))}</div></fieldset>
      <fieldset className="appearance-picker"><legend>Portrait colors</legend><div>{PORTRAIT_PALETTES.map((palette) => (
        <label key={palette} className={`appearance-choice ${draft.appearance.palette === palette ? 'selected' : ''}`}>
          <input type="radio" name="portrait-colors" checked={draft.appearance.palette === palette} onChange={() => setDraft({ ...draft, appearance: { ...draft.appearance, palette } })} />
          <Portrait appearance={{ ...draft.appearance, palette }} /><span>{PALETTE_NAMES[palette]}</span>
        </label>
      ))}</div></fieldset>
      <div className="profile-edit-actions"><button className="outline-button" type="button" onClick={onCancel} aria-label="Cancel profile edit">Cancel</button><button className="gold-button" type="submit">Save profile</button></div>
    </form>
  )
}

export function HeroProfilePage({ save, journal, onAction, onOpenProfile, onInventory, onRestart, onSearch }: {
  save: SavedGame
  journal: ReactNode
  onAction: (action: SocialAction) => void
  onOpenProfile: (id: AdventurerId) => void
  onInventory: () => void
  onRestart: () => void
  onSearch: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')
  const editButton = useRef<HTMLButtonElement>(null)
  const player = save.game.player
  function finishEdit() {
    setEditing(false)
    requestAnimationFrame(() => editButton.current?.focus())
  }
  return (
    <main id="social-screen" tabIndex={-1} className="social-page profile-page">
      <p className="eyebrow">Your profile / This browser</p>
      <header className="profile-header">
        <Portrait large appearance={save.social.hero.appearance} />
        <div><h1 id="screen-heading" tabIndex={-1}>{save.social.hero.name}</h1><p>{CLASSES[player.classId].name} / Level {player.level}</p></div>
        {!editing && <button ref={editButton} className="outline-button" onClick={() => { setEditing(true); setStatus('') }}><Pencil size={15} />Edit profile</button>}
      </header>
      {editing && <ProfileEditor profile={save.social.hero} onCancel={finishEdit} onSave={(profile) => { onAction({ type: 'CUSTOMIZE', profile }); setStatus('Profile updated.'); finishEdit() }} />}
      <p className="profile-status" role="status">{status}</p>
      <p className="profile-description">{CLASSES[player.classId].description}</p>
      <CharacterVitals player={player} />
      <CharacterAttributes player={player} />
      <div className="character-level"><span>Level {player.level}</span><span>{player.level === 10 ? 'Maximum level' : `${player.xp} / ${experienceTarget(player.level)} XP to the next level`}</span></div>
      <progress className="character-xp" aria-label="Character experience" max={player.level === 10 ? 1 : experienceTarget(player.level)} value={player.level === 10 ? 1 : player.xp} />
      <section className="profile-section"><header><h2>Equipment</h2><button className="text-button" onClick={onInventory}><Backpack size={15} />Open satchel</button></header><RelicList relics={player.relics} /></section>
      <section className="profile-section" aria-label="Followed adventurers"><header><h2>Following <span>{save.social.following.length}</span></h2><span className="fiction-label">Fictional adventurers</span></header>
        {save.social.following.length ? <div className="adventurer-list">{save.social.following.map((id) => {
          const adventurer = ADVENTURERS[id]
          return <AdventurerLink key={id} adventurer={adventurer} following onOpen={onOpenProfile} />
        })}</div> : <div className="social-empty"><UserPlus size={24} /><p>Find a few companions for the road.</p><button className="text-button" onClick={onSearch}>Discover adventurers<ArrowRight size={14} /></button></div>}
      </section>
      <section className="profile-section"><header><h2>Your adventure</h2><span className="eyebrow">Run {save.game.runNumber}</span></header>{journal}</section>
      <button className="outline-button full-width" onClick={onRestart}>Choose a class for a new adventure</button>
      <p className="modal-footnote">Your profile, following, and conversations stay with you. A new run resets gameplay stats and supplies, not your identity.</p>
    </main>
  )
}

export function AdventurerProfilePage({ social, id, backLabel, onBack, onAction, onChat, onStories }: {
  social: SocialState
  id: AdventurerId
  backLabel: string
  onBack: () => void
  onAction: (action: SocialAction) => void
  onChat: () => void
  onStories: () => void
}) {
  const adventurer = boostedAdventurer(id, social)
  const followed = social.following.includes(id)
  return (
    <main id="social-screen" tabIndex={-1} className="social-page profile-page">
      <button className="text-button page-back" onClick={onBack}><ArrowLeft size={16} />{backLabel}</button>
      <span className="fiction-label">Fictional adventurer</span>
      <header className="profile-header"><Portrait large appearance={adventurer.appearance} /><div><h1 id="screen-heading" tabIndex={-1}>{adventurer.name}</h1><p>{CLASSES[adventurer.classId].name} / Level {adventurer.level}</p></div></header>
      <p className="profile-location"><MapPin size={14} />{adventurer.home}</p>
      <p className="profile-description">{adventurer.description}</p>
      <div className="profile-actions"><button className={followed ? 'outline-button' : 'gold-button'} aria-pressed={followed} onClick={() => onAction({ type: followed ? 'UNFOLLOW' : 'FOLLOW', adventurerId: id })}><UserPlus size={16} />{followed ? 'Unfollow' : 'Follow'}</button><button className="outline-button" onClick={onChat}><MessageCircle size={16} />Chat with {adventurer.name}</button></div>
      <CharacterVitals player={adventurer} />
      <CharacterAttributes player={adventurer} />
      <GiftHelp social={social} id={id} />
      <section className="profile-section"><header><h2>Equipment</h2></header><RelicList relics={adventurer.relics} /></section>
      <section className="profile-section"><header><h2>Adventures</h2><button className="text-button" aria-haspopup="dialog" onClick={onStories}>Open {adventurer.name} stories<ArrowRight size={14} /></button></header>
        <ol className="profile-adventures">{adventurer.stories.map((story) => <li key={story.title}><h3>{story.title}</h3><p>{story.text}</p></li>)}</ol>
      </section>
      <p className="modal-footnote">An authored character, not a connected account. Following, chats, and gifts are simulated locally.</p>
    </main>
  )
}
