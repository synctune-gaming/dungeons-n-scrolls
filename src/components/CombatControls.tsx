import { Flame, Shield, Snowflake, Sparkles, Swords, WandSparkles, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getBossPattern, INTENTS, SPELLS } from '../game/content'
import { getRoom, spellUnavailable } from '../game/engine'
import { SPELL_IDS } from '../game/types'
import type { GameAction, GameState, SpellId } from '../game/types'

export const SPELL_ICONS: Record<SpellId, LucideIcon> = {
  'ember-bolt': Flame, 'frost-bind': Snowflake, 'storm-lance': Zap,
  'arcane-ward': Shield, 'mending-light': Sparkles,
}

export function CombatStatus({ game }: { game: GameState }) {
  const combat = game.combat
  if (!combat) return null
  const room = getRoom(game)
  const intent = INTENTS[combat.intent]
  return (
    <div className="combat-status">
      <div className="enemy-health-label">
        <span>{combat.result === 'victory' ? 'Defeated' : room.kind === 'boss' ? getBossPattern(room.id).phases[combat.phase === 1 ? 0 : 1] : room.kind === 'combat' && room.enemy.tough ? 'Tough foe / Enemy health' : 'Enemy health'}</span>
        <strong>{combat.health}<span> / {combat.maxHealth}</span></strong>
      </div>
      <progress className="enemy-health" aria-label="Enemy health" max={combat.maxHealth} value={combat.health} />
      {combat.result === 'fighting' && (
        <>
          <div className={`enemy-intent intent-${combat.intent}`} role="group" aria-label="Enemy intention">
            <span className="intent-icon">{combat.frozenTurns ? <Snowflake size={17} /> : <Swords size={17} />}</span>
            <div><strong>{combat.frozenTurns ? 'Held by frost' : intent.name}</strong><p>{combat.frozenTurns ? `${combat.frozenTurns} enemy action frozen. You have an opening.` : intent.hint}</p></div>
            <span className="turn-counter">Turn {combat.turn + 1}</span>
          </div>
          <div className="combat-conditions">
            {combat.burnTurns > 0 && <span className="condition-burning"><Flame size={11} />Burning / {combat.burnTurns}</span>}
            {combat.frozenTurns > 0 && <span className="condition-frozen"><Snowflake size={11} />Frozen / {combat.frozenTurns}</span>}
            {combat.ward > 0 && <span className="condition-ward"><Shield size={11} />Ward / {combat.ward}</span>}
            {combat.opening > 0 && <span className="condition-counter"><Swords size={11} />Counter ready</span>}
          </div>
        </>
      )}
    </div>
  )
}

export function SpellBar({ game, disabled, onAction }: {
  game: GameState
  disabled: boolean
  onAction: (action: GameAction) => void
}) {
  return (
    <section className="spell-bar" aria-label="Combat spells">
      <div className="spell-buttons">
        {SPELL_IDS.map((id) => {
          const spell = SPELLS[id]
          const Icon = SPELL_ICONS[id]
          const reason = spellUnavailable(game, id)
          return <button
            key={id}
            className={`spell-button spell-${id}`}
            disabled={disabled || Boolean(reason)}
            aria-label={`Cast ${spell.name.toLowerCase()}`}
            title={reason ?? spell.description}
            onClick={() => onAction({ type: 'CAST_SPELL', spell: id })}
          ><Icon size={19} /><strong>{spell.shortName}</strong><small>{spell.cost} mana</small></button>
        })}
        <button
          className="spell-button spell-aether"
          disabled={disabled || game.player.aether === 0 || game.player.mana === game.player.maxMana}
          aria-label="Drink aether vial"
          title="Restore up to 14 mana. Drinking spends your turn."
          onClick={() => onAction({ type: 'DRINK_AETHER' })}
        ><WandSparkles size={19} /><strong>Refill</strong><small>x{game.player.aether} vial</small></button>
      </div>
    </section>
  )
}
