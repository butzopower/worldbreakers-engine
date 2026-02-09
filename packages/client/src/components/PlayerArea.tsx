import type { PlayerId, FilteredGameState, VisibleCard, InteractionMode, PlayerAction } from '../types.js';
import { isVisible } from '../types.js';
import FollowerCard from './FollowerCard.js';
import LocationCard from './LocationCard.js';
import Hand from './Hand.js';
import { socket } from '../socket.js';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  interactionMode: InteractionMode;
  onCardClick: (card: VisibleCard) => void;
  legalActions: PlayerAction[];
}

export default function PlayerArea({ state, playerId, interactionMode, onCardClick, legalActions }: Props) {
  const player = state.players[playerId];
  const allCards = state.cards.filter(c => isVisible(c) && c.owner === playerId) as VisibleCard[];

  const worldbreaker = allCards.find(c => c.zone === 'worldbreaker');
  const followers = allCards.filter(c => c.zone === 'board' && !isLocation(c));
  const locations = allCards.filter(c => c.zone === 'board' && isLocation(c));
  const hand = allCards.filter(c => c.zone === 'hand');

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: state.activePlayer === playerId ? '#00ff88' : '#888' }}>
          You ({playerId})
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <span style={{ color: '#00bcd4' }}>Mythium: {player.mythium}</span>
          <span style={{ color: '#ff9800' }}>Power: {player.power}/10</span>
          <span>Standing: E{player.standing.earth} M{player.standing.moon} V{player.standing.void} S{player.standing.stars}</span>
        </div>
      </div>

      {/* Worldbreaker */}
      {worldbreaker && (
        <div style={{ marginBottom: '8px' }}>
          <FollowerCard card={worldbreaker} />
        </div>
      )}

      {/* Board - followers and locations */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Followers</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {followers.length === 0 && <span style={{ color: '#555', fontSize: '11px' }}>none</span>}
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
                <div key={card.instanceId} style={{ position: 'relative' }}>
                  <FollowerCard
                    card={card}
                    selected={isSelectedAttacker || isAssignedBlocker}
                    highlighted={isTargetable}
                    onClick={() => onCardClick(card)}
                  />
                  {canUse && interactionMode.type === 'none' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        socket.emit('submit_action', {
                          action: { type: 'use_ability', cardInstanceId: card.instanceId, abilityIndex: 0 },
                        });
                      }}
                      style={{
                        position: 'absolute', bottom: '-8px', right: '-4px',
                        background: '#0f3460', color: 'white', border: 'none',
                        padding: '1px 4px', cursor: 'pointer', borderRadius: '3px',
                        fontSize: '9px',
                      }}
                    >
                      Ability
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Locations</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {locations.length === 0 && <span style={{ color: '#555', fontSize: '11px' }}>none</span>}
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

      {/* Hand */}
      <Hand
        cards={hand}
        interactionMode={interactionMode}
        legalActions={legalActions}
        onCardClick={onCardClick}
      />
    </div>
  );
}

function isLocation(card: VisibleCard): boolean {
  const locations = ['watchtower', 'void_nexus'];
  return locations.includes(card.definitionId);
}
