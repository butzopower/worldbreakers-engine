import type { PlayerId, FilteredGameState, VisibleCard, InteractionMode, ClientCardDefinition } from '../types';
import { isVisible } from '../types';
import FollowerCard from './FollowerCard';
import LocationCard from './LocationCard';
import { useCardDefinitions } from "../context/CardDefinitions";
import styles from './OpponentArea.module.css';

interface Props {
  state: FilteredGameState;
  opponent: PlayerId;
  interactionMode: InteractionMode;
  onCardClick: (card: VisibleCard) => void;
}

export default function OpponentArea({ state, opponent, interactionMode, onCardClick }: Props) {
  const cardDefs = useCardDefinitions();

  const player = state.players[opponent];
  const allCards = state.cards.filter(c => isVisible(c) && c.owner === opponent) as VisibleCard[];
  const hiddenHandCount = state.cards.filter(c => 'hidden' in c && c.owner === opponent).length;

  const worldbreaker = allCards.find(c => c.zone === 'worldbreaker');
  const followers = allCards.filter(c => c.zone === 'board' && isFollower(cardDefs[c.definitionId]));
  const locations = allCards.filter(c => c.zone === 'board' && isLocation(cardDefs[c.definitionId]));

  const isActive = state.activePlayer === opponent;

  return (
    <div className={styles.opponentArea}>
      <div className={styles.header}>
        <div className={`${styles.opponentName} ${isActive ? styles['opponentName--active'] : ''}`}>
          Opponent ({opponent})
        </div>
        <div className={styles.resourceBar}>
          <span className={styles.mythium}>Mythium: {player.mythium}</span>
          <span className={styles.power}>Power: {player.power}/10</span>
          <span>Hand: {hiddenHandCount}</span>
          <span>Standing: E{player.standing.earth} M{player.standing.moon} V{player.standing.void} S{player.standing.stars}</span>
        </div>
      </div>

      {worldbreaker && (
        <div className={styles.worldbreaker}>
          <FollowerCard card={worldbreaker} />
        </div>
      )}

      <div className={styles.board}>
        <div className={styles.boardSection}>
          <div className={styles.sectionLabel}>Followers</div>
          <div className={styles.cardList}>
            {followers.length === 0 && <span className={styles.emptyLabel}>none</span>}
            {followers.map(card => {
              const isTargetable = interactionMode.type === 'choose_target' &&
                interactionMode.validTargets.includes(card.instanceId);
              const isAttacker = state.combat?.attackerIds.includes(card.instanceId);

              return (
                <FollowerCard
                  key={card.instanceId}
                  card={card}
                  highlighted={isTargetable || isAttacker}
                  onClick={() => onCardClick(card)}
                  lastingEffects={state.lastingEffects}
                />
              );
            })}
          </div>
        </div>

        <div className={styles.boardSection}>
          <div className={styles.sectionLabel}>Locations</div>
          <div className={styles.cardList}>
            {locations.length === 0 && <span className={styles.emptyLabel}>none</span>}
            {locations.map(card => {
              const isBreachTarget = interactionMode.type === 'choose_breach_target' &&
                interactionMode.validLocations.includes(card.instanceId);

              return (
                <LocationCard
                  key={card.instanceId}
                  card={card}
                  canDevelop={false}
                  highlighted={isBreachTarget}
                  onClick={() => onCardClick(card)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function isFollower(card: ClientCardDefinition): boolean {
  return card.type === 'follower';
}

function isLocation(card: ClientCardDefinition): boolean {
  return card.type === 'location';
}
