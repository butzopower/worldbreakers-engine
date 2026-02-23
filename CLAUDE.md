# Worldbreakers Engine

## Architecture

Monorepo with npm workspaces under `packages/`:

- **`engine`** — Pure state-machine game engine. Zero runtime dependencies. All functions are pure: `(state, input) → (state, events)`. No side effects, no mutation. This is the source of truth for game rules.
- **`server`** — Express + Socket.IO server. Wraps engine, manages game sessions, filters state per player (hides opponent hand). Authoritative — clients never run game logic.
- **`client`** — React + Vite frontend. Renders state received from server, sends player actions over socket. No game logic here.

Engine is imported by server as a workspace dependency. Client does NOT import engine — it receives filtered state over the wire.

### Key engine concepts

- `GameState` is immutable. Every mutation returns a new state + events array.
- `processAction(state, { player, action })` is the single entry point for all game actions.
- `getLegalActions(state)` returns every valid action for the current state.
- `PendingChoice` represents the engine waiting for player input (target selection, blocker assignment, discard, breach).
- `StandingGuild` (`earth | moon | void | stars`) is used for standing records and buy/gain standing. `Guild` adds `neutral` — cards can be neutral guild but you can't have neutral standing.

## Commands

```
npm run dev           # start server + client concurrently
npm run dev:server    # server only (port 3001)
npm run dev:client    # client only (port 5173)
npm run build         # build all packages
```

Engine tests: `npm run test --workspace=@worldbreakers/engine`

## Code Conventions

- TypeScript strict mode everywhere.
- ES modules (`"type": "module"`). Do NOT use `.js` extensions or `/index` suffixes in imports — tsdown resolves them at build time.
- Named exports only — no default exports in engine or server. Client components use default exports (React convention).
- Types that cross package boundaries go through engine's `src/index.ts` barrel export.
- Engine functions must remain pure. No `console.log`, no `Date.now()`, no randomness outside the seeded RNG.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and aliases.
- Try not to use `as` keyword in TypeScript - prefer `as const` for type literals over using plain `as`
- Use `Record<K, V>` for maps, not `{ [key: string]: V }`.
- Destructure function params when there are 3+ fields. Positional args are fine for 1-2 params.

## Testing

- Tests live in `packages/engine/tests/` organized as `unit/` and `integration/`.
- Use vitest with `describe`/`it`/`expect` (globals enabled).
- Test helpers: `buildState()` for constructing test game states, assertion helpers in `tests/helpers/`.
- Always call `clearRegistry()` + `registerTestCards()` in `beforeEach`.
- Engine changes must have tests. Server/client are tested manually via two browser tabs for now.
- Prefer to assert on visible / public board state instead of drilling deep into engine specific fields in the state
- Try to avoid using functions from the engine other than processAction
- Run tests before considering any engine change complete.
- If configured with `rtk` run tests via `rtk vitest run` otherwise use `npm run test`

### Test card set

13 test cards defined in `packages/engine/src/cards/test-cards/index.ts`:
- Worldbreakers: `stone_sentinel` (earth), `void_oracle` (void)
- Followers: `militia_scout`, `shield_bearer`, `night_raider`, `void_channeler`, `star_warden`, `earthshaker_giant`
- Events: `sudden_strike`, `void_rift`
- Locations: `watchtower`, `void_nexus`

Use these in tests. Add new test cards to that file when testing new mechanics. Never import real cards into unit and integration tests.

### Real card set

- Real card implementations live in `packages/engine/src/cards/sets/`:
- Organize cards into files by their type, e.g. `events.ts`, `followers.ts`, etc.
- Keep the implementations sorted by id alphabetically

- Tests for these cards live in `packages/engine/tests/cards/sets/`:
- Prefer to write tests for real cards using other real cards, but you can use test cards if there are no valid real cards to use
- Only write tests that test the specific keywords and abilities for the card
