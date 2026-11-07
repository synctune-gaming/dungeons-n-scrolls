import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react'
import { ADVENTURERS, orderedAdventurers } from '../social/content'
import type { AdventurerId, SocialState } from '../social/types'
import { ROOMS } from '../game/content'
import { Modal } from './Modal'
import { PixelScene } from './PixelScene'
import { Portrait } from './Portrait'
import { GiftHelp } from './Profiles'

export function StoriesStrip({ social, onOpen }: { social: SocialState; onOpen: (id: AdventurerId) => void }) {
  return (
    <section className="stories-strip" aria-label="Fictional adventurer stories">
      <header><span className="eyebrow">Stories from the road</span><span>Fictional journeys</span></header>
      <div className="story-trail">{orderedAdventurers(social).map((adventurer) => {
        const following = social.following.includes(adventurer.id)
        return <div key={adventurer.id} className={`story-item ${following ? 'story-following' : ''}`}><button className="story-button" aria-label={`Open ${adventurer.name} stories`} aria-haspopup="dialog" onClick={() => onOpen(adventurer.id)}>
          <span className="story-seal"><Portrait appearance={adventurer.appearance} /></span><strong>{adventurer.name}</strong>
        </button><small>{following ? 'Following' : 'Fictional'}</small></div>
      })}</div>
    </section>
  )
}

export function StoryViewer({ id, index, social, reducedMotion, restoreFocusTo, onIndex, onClose, onProfile }: {
  id: AdventurerId
  index: number
  social: SocialState
  reducedMotion: boolean
  restoreFocusTo: HTMLElement | null
  onIndex: (index: number) => void
  onClose: () => void
  onProfile: () => void
}) {
  const adventurer = ADVENTURERS[id]
  const story = adventurer.stories[index]
  if (!story) throw new Error('The selected fictional story does not exist.')
  return (
    <Modal title={`${adventurer.name}'s journey`} eyebrow="Fictional story / Local simulation" className="story-modal" restoreFocusTo={restoreFocusTo} onClose={onClose} onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === 'ArrowRight') { event.preventDefault(); onIndex(Math.min(adventurer.stories.length - 1, index + 1)) }
        if (event.key === 'ArrowLeft') { event.preventDefault(); onIndex(Math.max(0, index - 1)) }
      }}>
      <div>
        <div className="story-progress"><progress aria-label="Story progress" value={index + 1} max={adventurer.stories.length} /><span role="status">Story {index + 1} of {adventurer.stories.length}</span></div>
        <div className="story-scene"><PixelScene room={ROOMS[story.roomId]} floor={story.floor} seed={1907 + index} known={story.known ?? true} reducedMotion={reducedMotion} paused /></div>
        <article className="story-copy"><h3>{story.title}</h3><p>{story.text}</p></article>
        <GiftHelp social={social} id={id} />
        <div className="story-controls"><button className="outline-button" aria-label="Previous story" disabled={index === 0} onClick={() => onIndex(index - 1)}><ArrowLeft size={16} />Previous</button><button className="gold-button" aria-label="Next story" disabled={index === adventurer.stories.length - 1} onClick={() => onIndex(index + 1)}>Next<ArrowRight size={16} /></button></div>
        <button className="text-button full-width" aria-label={`View ${adventurer.name} profile`} onClick={onProfile}><UserRound size={15} />View {adventurer.name} profile</button>
      </div>
    </Modal>
  )
}
