import type { InteractionMode, FilteredGameState, PlayerId, PlayerAction } from '../types';

interface Props {
  mode: InteractionMode;
  state: FilteredGameState;
  playerId: PlayerId;
  onSubmitAction: (action: PlayerAction) => void;
  onCancel: () => void;
}

export default function InteractionOverlay({ mode, state, playerId, onSubmitAction, onCancel }: Props) {
  if (mode.type === 'none') return null;

  const panelStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '10px',
    background: '#0f3460',
    borderRadius: '6px',
    border: '1px solid #e94560',
  };

  const btnStyle: React.CSSProperties = {
    background: '#e94560', color: 'white', border: 'none',
    padding: '6px 12px', cursor: 'pointer', borderRadius: '4px',
    fontSize: '12px', marginRight: '8px',
  };

  const cancelStyle: React.CSSProperties = {
    ...btnStyle, background: '#555',
  };

  switch (mode.type) {
    case 'select_attackers':
      return (
        <div style={panelStyle}>
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            Select attackers by clicking followers, then confirm.
            {mode.selected.length > 0 && ` (${mode.selected.length} selected)`}
          </div>
          <button
            onClick={() => {
              if (mode.selected.length > 0) {
                if (state.pendingChoice?.type === 'choose_attackers') {
                  onSubmitAction({ type: 'choose_attackers', attackerIds: mode.selected });
                } else {
                  onSubmitAction({ type: 'attack', attackerIds: mode.selected });
                }
              }
            }}
            disabled={mode.selected.length === 0}
            style={{ ...btnStyle, opacity: mode.selected.length === 0 ? 0.5 : 1 }}
          >
            Confirm Attack
          </button>
          <button onClick={onCancel} style={cancelStyle}>Cancel</button>
        </div>
      );

    case 'select_blocker':
      return (
        <div style={panelStyle}>
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            {mode.selectedBlockerId
              ? `Blocker selected. ${mode.attackerIds.length > 1 ? 'Click an attacker to block.' : ''}`
              : 'Click a ready follower to block with.'
            }
            {` (${mode.attackerIds.length} attacker${mode.attackerIds.length !== 1 ? 's' : ''} remaining)`}
          </div>
          <button
            onClick={() => onSubmitAction({ type: 'pass_block' })}
            style={cancelStyle}
          >
            Pass (No Block)
          </button>
        </div>
      );

    case 'choose_target':
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: '12px' }}>
            Choose a target (click a highlighted card). {mode.validTargets.length} valid target(s).
          </div>
        </div>
      );

    case 'choose_discard':
      return (
        <div style={panelStyle}>
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            Select {mode.count} card(s) to discard from hand.
            {mode.selected.length > 0 && ` (${mode.selected.length}/${mode.count} selected)`}
          </div>
          <button
            onClick={() => {
              if (mode.selected.length === mode.count) {
                onSubmitAction({ type: 'choose_discard', cardInstanceIds: mode.selected });
              }
            }}
            disabled={mode.selected.length !== mode.count}
            style={{ ...btnStyle, opacity: mode.selected.length !== mode.count ? 0.5 : 1 }}
          >
            Confirm Discard
          </button>
        </div>
      );

    case 'choose_breach_target':
      return (
        <div style={panelStyle}>
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            Choose a location to breach (click a highlighted location), or skip.
          </div>
          <button
            onClick={() => onSubmitAction({ type: 'skip_breach_damage' })}
            style={cancelStyle}
          >
            Skip Breach
          </button>
        </div>
      );

    case 'choose_mode':
      return (
        <div style={panelStyle}>
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            Choose one:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {mode.modes.map((m, i) => (
              <button
                key={i}
                onClick={() => onSubmitAction({ type: 'choose_mode', modeIndex: i })}
                style={btnStyle}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      );

  }
}
