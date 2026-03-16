import type { InteractionMode, FilteredGameState, PlayerId, PlayerAction } from '../types';
import { isVisible } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
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

    case 'choose_trigger_order':
      return <TriggerOrderPanel mode={mode} state={state} onSubmitAction={onSubmitAction} />;

    case 'choose_cost_discount':
      return (
        <div className={styles.panel}>
          <div className={styles.instructions}>
            Select targets for cost discount (optional). Click highlighted cards to toggle.
            {mode.selected.length > 0 && ` (${mode.selected.length}/${mode.maxTargets} selected)`}
          </div>
          <button
            onClick={() => {
              onSubmitAction({ type: 'choose_cost_discount_targets', targetInstanceIds: mode.selected });
            }}
            className={styles.btn}
          >
            {mode.selected.length > 0 ? 'Confirm Discount' : 'Skip Discount'}
          </button>
        </div>
      );
  }
}

function TriggerOrderPanel({ mode, state, onSubmitAction }: {
  mode: Extract<InteractionMode, { type: 'choose_trigger_order' }>;
  state: FilteredGameState;
  onSubmitAction: (action: PlayerAction) => void;
}) {
  const cardDefs = useCardDefinitions();

  function getTriggerLabel(trigger: { sourceCardId: string; abilityIndex: number }) {
    const card = state.cards.find(c => isVisible(c) && c.instanceId === trigger.sourceCardId);
    if (!card || !isVisible(card)) return `Ability ${trigger.abilityIndex + 1}`;
    const def = cardDefs[card.definitionId];
    if (!def) return card.definitionId;
    return def.name;
  }

  const hasOptional = mode.triggers.some(t => !t.forced);

  return (
    <div className={styles.panel}>
      <div className={styles.instructions}>Choose which ability resolves next:</div>
      <div className={styles.triggerList}>
        {mode.triggers.map((t, i) => (
          <div key={i} className={styles.triggerRow}>
            <button
              onClick={() => onSubmitAction({ type: 'choose_trigger', triggerIndex: i })}
              className={styles.btn}
            >
              {getTriggerLabel(t)}
            </button>
            {!t.forced && (
              <button
                onClick={() => onSubmitAction({ type: 'skip_trigger', triggerIndex: i })}
                className={styles.btnCancel}
              >
                Skip
              </button>
            )}
            {t.forced && hasOptional && (
              <span className={styles.forcedLabel}>Forced</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
