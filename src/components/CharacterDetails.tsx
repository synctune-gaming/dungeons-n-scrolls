import { Backpack, Check, Eye, Feather, Shield, Swords, Flame } from 'lucide-react'
import { RELICS } from '../game/content'
import type { Player, RelicId } from '../game/types'

const RELIC_ICONS = { 'iron-charm': Shield, 'fleet-feather': Feather, 'ember-stone': Flame }

export function CharacterAttributes({ player }: { player: Pick<Player, 'strength' | 'dexterity' | 'wisdom'> }) {
  return (
    <div className="character-stats">
      <div><Swords /><strong>{player.strength}</strong><span>Strength</span></div>
      <div><Feather /><strong>{player.dexterity}</strong><span>Dexterity</span></div>
      <div><Eye /><strong>{player.wisdom}</strong><span>Wisdom</span></div>
    </div>
  )
}

export function CharacterVitals({ player }: { player: Pick<Player, 'health' | 'maxHealth' | 'mana' | 'maxMana'> }) {
  return (
    <div className="profile-vitals">
      <div><span>Health <strong>{player.health} / {player.maxHealth}</strong></span><progress aria-label="Health" value={player.health} max={player.maxHealth} /></div>
      <div className="mana-stat"><span>Mana <strong>{player.mana} / {player.maxMana}</strong></span><progress aria-label="Mana" value={player.mana} max={player.maxMana} /></div>
    </div>
  )
}

export function RelicList({ relics }: { relics: RelicId[] }) {
  return relics.length === 0 ? (
    <div className="empty-satchel"><Backpack size={30} strokeWidth={1.2} /><p>No relics. Yet.</p><span>Search chests and visit shops to find something worth carrying.</span></div>
  ) : relics.map((id) => {
    const Icon = RELIC_ICONS[id]
    return <div className="inventory-item relic-item" key={id}><span className="item-icon"><Icon size={24} /></span><div><h3>{RELICS[id].name}</h3><p>{RELICS[id].effect}</p><span className="relic-flavor">{RELICS[id].description}</span></div><span className="equipped-label"><Check size={12} />Equipped</span></div>
  })
}
