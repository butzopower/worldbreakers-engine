import { useState } from 'react';
import type { PlayerId, FilteredGameState, VisibleCard } from '../types';
import { isVisible } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import { GUILD_COLORS } from './FollowerCard';
import CardTooltip from './CardTooltip';
import styles from './DeckDiscard.module.css';

interface Props {
  state: FilteredGameState;
  owner: PlayerId;
}

export default function DeckDiscard({ state, owner }: Props) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const cardDefs = useCardDefinitions();

  const deckCount = state.cards.filter(c => !isVisible(c) && c.owner === owner && c.zone === 'deck').length;
  const discardCards = state.cards.filter(c => isVisible(c) && c.owner === owner && c.zone === 'discard') as VisibleCard[];

  return (
    <div className={styles.container}>
      <div className={styles.pileRow}>
        <div className={styles.pile}>
          <div className={styles.pileIcon}>
            <div className={styles.deckStack} />
          </div>
          <span className={styles.pileLabel}>Deck: {deckCount}</span>
        </div>

        <button
          className={styles.pile}
          onClick={() => setDiscardOpen(prev => !prev)}
        >
          <div className={styles.pileIcon}>
            <div className={styles.discardStack} />
          </div>
          <span className={styles.pileLabel}>
            Discard: {discardCards.length}
            {discardCards.length > 0 && (
              <span className={styles.expandIcon}>{discardOpen ? ' \u25B2' : ' \u25BC'}</span>
            )}
          </span>
        </button>
      </div>

      {discardOpen && discardCards.length > 0 && (
        <div className={styles.discardList}>
          {discardCards.map(card => {
            const def = cardDefs[card.definitionId] ?? { id: card.definitionId, name: card.definitionId, type: 'follower', guild: 'neutral', cost: 0 };
            const guildColor = GUILD_COLORS[def.guild] ?? '#777';
            return (
              <CardTooltip key={card.instanceId} cardDef={def} card={card}>
                <div
                  className={styles.discardTile}
                  style={{ borderColor: guildColor }}
                >
                  <span className={styles.tileCost}>{def.cost}</span>
                  <span className={styles.tileName} style={{ color: guildColor }}>{def.name}</span>
                </div>
              </CardTooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
