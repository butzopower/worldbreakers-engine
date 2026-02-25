import type {
  PlayerId,
  FilteredGameState,
  VisibleCard,
  InteractionMode,
  PlayerAction,
  ClientCardDefinition
} from '../types';
import { isVisible } from '../types';
import FollowerCard from './FollowerCard';
import LocationCard from './LocationCard';
import Hand from './Hand';
import { socket } from '../socket';
import { useCardDefinitions } from "../context/CardDefinitions";
import styles from './PlayerArea.module.css';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  interactionMode: InteractionMode;
  onCardClick: (card: VisibleCard) => void;
  legalActions: PlayerAction[];
}

export default function PlayerArea({ state, playerId, interactionMode, onCardClick, legalActions }: Props) {
  const cardDefs = useCardDefinitions();

  const player = state.players[playerId];
  const allCards = state.cards.filter(c => isVisible(c) && c.owner === playerId) as VisibleCard[];

  const worldbreaker = allCards.find(c => c.zone === 'worldbreaker');
  const followers = allCards.filter(c => c.zone === 'board' && isFollower(cardDefs[c.definitionId]));
  const locations = allCards.filter(c => c.zone === 'board' && isLocation(cardDefs[c.definitionId]));
  const hand = allCards.filter(c => c.zone === 'hand');

  const isActive = state.activePlayer === playerId;

  return (
    <div className={styles.playerArea}>
      <div className={styles.header}>
        <div className={`${styles.playerName} ${isActive ? styles['playerName--active'] : ''}`}>
          You ({playerId})
        </div>
        <div className={styles.resourceBar}>
          <span className={styles.mythium}>Mythium: {player.mythium}</span>
          <span className={styles.power}>Power: {player.power}/10</span>
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
              const isSelectedAttacker = interactionMode.type === 'select_attackers' &&
                interactionMode.selected.includes(card.instanceId);
              const isAssignedBlocker = interactionMode.type === 'select_blocker' &&
                interactionMode.selectedBlockerId === card.instanceId;
              const isTargetable = interactionMode.type === 'choose_target' &&
                interactionMode.validTargets.includes(card.instanceId);

              const canUse = legalActions.some(
                a => a.type === 'use_ability' && a.cardInstanceId === card.instanceId
              );

              return (
                <div key={card.instanceId} className={styles.cardWrapper}>
                  <FollowerCard
                    card={card}
                    selected={isSelectedAttacker || isAssignedBlocker}
                    highlighted={isTargetable}
                    onClick={() => onCardClick(card)}
                    lastingEffects={state.lastingEffects}
                  />
                  {canUse && interactionMode.type === 'none' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        socket.emit('submit_action', {
                          action: { type: 'use_ability', cardInstanceId: card.instanceId, abilityIndex: 0 },
                        });
                      }}
                      className={styles.abilityButton}
                    >
                      Ability
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.boardSection}>
          <div className={styles.sectionLabel}>Locations</div>
          <div className={styles.cardList}>
            {locations.length === 0 && <span className={styles.emptyLabel}>none</span>}
            {locations.map(card => {
              const canDev = legalActions.some(
                a => a.type === 'develop' && a.locationInstanceId === card.instanceId
              );
              const isBreachTarget = interactionMode.type === 'choose_breach_target' &&
                interactionMode.validLocations.includes(card.instanceId);

              return (
                <LocationCard
                  key={card.instanceId}
                  card={card}
                  canDevelop={canDev && interactionMode.type === 'none'}
                  highlighted={isBreachTarget}
                  onClick={() => onCardClick(card)}
                  onDevelop={() => {
                    socket.emit('submit_action', {
                      action: { type: 'develop', locationInstanceId: card.instanceId },
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <Hand
        cards={hand}
        interactionMode={interactionMode}
        legalActions={legalActions}
        onCardClick={onCardClick}
      />
    </div>
  );
}

function isFollower(card: ClientCardDefinition): boolean {
  return card.type === 'follower';
}

function isLocation(card: ClientCardDefinition): boolean {
  return card.type === 'location';
}
