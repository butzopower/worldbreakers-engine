import type { PlayerId, FilteredGameState, VisibleCard, InteractionMode, ClientCardDefinition } from '../types';
import { isVisible } from '../types';
import FollowerCard from './FollowerCard';
import LocationCard from './LocationCard';
import { useCardDefinitions } from "../context/CardDefinitions";

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

  return (
    <div style={{ opacity: 0.9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: state.activePlayer === opponent ? '#ff6b6b' : '#888' }}>
          Opponent ({opponent})
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <span style={{ color: '#00bcd4' }}>Mythium: {player.mythium}</span>
          <span style={{ color: '#ff9800' }}>Power: {player.power}/10</span>
          <span>Hand: {hiddenHandCount}</span>
          <span>Standing: E{player.standing.earth} M{player.standing.moon} V{player.standing.void} S{player.standing.stars}</span>
        </div>
      </div>

      {/* Worldbreaker */}
      {worldbreaker && (
        <div style={{ marginBottom: '8px' }}>
          <FollowerCard card={worldbreaker} />
        </div>
      )}

      {/* Board */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Followers</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {followers.length === 0 && <span style={{ color: '#555', fontSize: '11px' }}>none</span>}
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

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Locations</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {locations.length === 0 && <span style={{ color: '#555', fontSize: '11px' }}>none</span>}
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

