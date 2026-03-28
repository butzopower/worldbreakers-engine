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
import DeckDiscard from './DeckDiscard';
import ResourceAdjuster from './ResourceAdjuster';
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
          <ResourceAdjuster player={playerId} resource="mythium" label="Mythium" value={player.mythium} className={styles.mythium} />
          <ResourceAdjuster player={playerId} resource="power" label="Power" value={player.power} className={styles.power} />
          <span>Standing:
            {' '}E<ResourceAdjuster player={playerId} resource="standing_earth" label="" value={player.standing.earth} />
            {' '}M<ResourceAdjuster player={playerId} resource="standing_moon" label="" value={player.standing.moon} />
            {' '}V<ResourceAdjuster player={playerId} resource="standing_void" label="" value={player.standing.void} />
            {' '}S<ResourceAdjuster player={playerId} resource="standing_stars" label="" value={player.standing.stars} />
          </span>
        </div>
      </div>

      {worldbreaker && (
        <div className={styles.worldbreaker}>
          <FollowerCard
            card={worldbreaker}
            allCards={state.cards}
            storedCardHighlighted={
              interactionMode.type === 'none'
                ? legalActions
                    .filter(a => a.type === 'play_card')
                    .map(a => a.type === 'play_card' ? a.cardInstanceId : '')
                    .filter(id => worldbreaker.storedCards.includes(id))
                : interactionMode.type === 'choose_stored_card_to_play' && interactionMode.hostInstanceId === worldbreaker.instanceId
                  ? interactionMode.validCardIds
                  : undefined
            }
            onStoredCardClick={onCardClick}
          />
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
              const isCostDiscountTarget = interactionMode.type === 'choose_cost_discount' &&
                interactionMode.validTargets.includes(card.instanceId);
              const isCostDiscountSelected = interactionMode.type === 'choose_cost_discount' &&
                interactionMode.selected.includes(card.instanceId);

              const canUse = legalActions.some(
                a => a.type === 'use_ability' && a.cardInstanceId === card.instanceId
              );

              const storedHighlighted = interactionMode.type === 'choose_stored_card_to_play' &&
                interactionMode.hostInstanceId === card.instanceId
                ? interactionMode.validCardIds
                : undefined;

              return (
                <div key={card.instanceId} className={styles.cardWrapper}>
                  <FollowerCard
                    card={card}
                    selected={isSelectedAttacker || isAssignedBlocker || isCostDiscountSelected}
                    highlighted={isTargetable || isCostDiscountTarget}
                    onClick={() => onCardClick(card)}
                    lastingEffects={state.lastingEffects}
                    allCards={state.cards}
                    storedCardHighlighted={storedHighlighted}
                    onStoredCardClick={storedHighlighted ? onCardClick : undefined}
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
              const isLocCostDiscountTarget = interactionMode.type === 'choose_cost_discount' &&
                interactionMode.validTargets.includes(card.instanceId);

              return (
                <LocationCard
                  key={card.instanceId}
                  card={card}
                  canDevelop={canDev && interactionMode.type === 'none'}
                  highlighted={isBreachTarget || isLocCostDiscountTarget}
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

      <DeckDiscard state={state} owner={playerId} />
    </div>
  );
}

function isFollower(card: ClientCardDefinition): boolean {
  return card.type === 'follower';
}

function isLocation(card: ClientCardDefinition): boolean {
  return card.type === 'location';
}
