import type { InteractionMode, FilteredGameState, PlayerId, PlayerAction } from '../types';
import styles from './InteractionOverlay.module.css';

interface Props {
  mode: InteractionMode;
  state: FilteredGameState;
  playerId: PlayerId;
  onSubmitAction: (action: PlayerAction) => void;
  onCancel: () => void;
}

export default function InteractionOverlay({ mode, state, playerId, onSubmitAction, onCancel }: Props) {
  if (mode.type === 'none') return null;

  switch (mode.type) {
    case 'select_attackers':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>
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
            className={`${styles.btn} ${mode.selected.length === 0 ? styles['btn--disabled'] : ''}`}
          >
            Confirm Attack
          </button>
          <button onClick={onCancel} className={styles.btnCancel}>Cancel</button>
        </div>
      );

    case 'select_blocker':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>
            {mode.selectedBlockerId
              ? `Blocker selected. ${mode.attackerIds.length > 1 ? 'Click an attacker to block.' : ''}`
              : 'Click a ready follower to block with.'
            }
            {` (${mode.attackerIds.length} attacker${mode.attackerIds.length !== 1 ? 's' : ''} remaining)`}
          </div>
          <button onClick={() => onSubmitAction({ type: 'pass_block' })} className={styles.btnCancel}>
            Pass (No Block)
          </button>
        </div>
      );

    case 'choose_target':
      return (
        <div className={styles.panel}>
          <div className={styles.instructionsNoMargin}>
            Choose a target (click a highlighted card). {mode.validTargets.length} valid target(s).
          </div>
        </div>
      );

    case 'choose_discard':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>
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
            className={`${styles.btn} ${mode.selected.length !== mode.count ? styles['btn--disabled'] : ''}`}
          >
            Confirm Discard
          </button>
        </div>
      );

    case 'choose_breach_target':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>
            Choose a location to breach (click a highlighted location), or skip.
          </div>
          <button onClick={() => onSubmitAction({ type: 'skip_breach_damage' })} className={styles.btnCancel}>
            Skip Breach
          </button>
        </div>
      );

    case 'choose_mode':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>Choose one:</div>
          <div className={styles.btnRow}>
            {mode.modes.map((m, i) => (
              <button
                key={i}
                onClick={() => onSubmitAction({ type: 'choose_mode', modeIndex: i })}
                className={styles.btn}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      );
  }
}
