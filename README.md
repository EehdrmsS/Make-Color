# Make Color!

Make Color! is a browser-based color mixing puzzle game built as a single-page web game.

Players drag connected color groups into adjacent groups to blend them, create mission colors, clear large regions, and keep the board under control.

## Current Goal

The project is being developed as a WebGame for release. The current direction is to keep the game lightweight enough for browser play and future ad-supported distribution.

## Game Modes

### Classic

Classic is a timed score mode.

- No special bubbles
- 120 second time limit
- Goal: score as much as possible before time runs out
- Level thresholds: 200, 350, 700, 1100, 1600

### Extreme

Extreme is the ongoing survival mode.

- Timer starts at 30 seconds
- Mission clears add time, capped by level
- Special bubbles enabled
- Goal: survive as long as possible while clearing missions
- Level thresholds: 200, 350, 700, 1100, 1600, 2500, 4000, 6500, 10000
- Every 5 mission clears queues one special bubble for future spawn
- Mud scores 0 points

## Core Rules

- The board is a 10 x 10 grid.
- Adjacent cells of the same color form a region.
- Drag one region onto an adjacent region to merge them.
- Color results are controlled by the `MIX` table in `src/main.js`.
- Regions matching active mission colors burst when they reach 5 or more cells.
- Over-mixed regions become Dead bubbles.
- Dead bubbles are removed when nearby mission regions burst.

## Special Bubble Rules

Special bubbles no longer appear through color mixing.

In Extreme mode, the UI shows the next special bubble. Every 5 mission clears, that displayed special is reserved for the next replacement cell.

Special bubbles can be triggered at any time by merging them with another region.

## Performance Work

Recent optimization work includes:

- Stopping the render loop when no animation is active
- Guarding delayed timers so old game sessions cannot mutate a new game
- Committing special bubble effects after their animation finishes
- Caching rendered bubble sprites instead of rebuilding gradients every frame
- Capping particle count
- Batching clear-effect particle timers
- Removing render-time randomness from the Laser special effect

## Files

- `index.html`: Vite HTML entry point.
- `src/main.js`: Main game loop, rendering, input, modes, and effects.
- `src/core/`: Game state and timer boundaries.
- `src/systems/`: Bubble and score system helpers.
- `src/ui/`: DOM-facing UI helpers.
- `src/ads/`: AdSense H5 ad integration.
- `src/utils/`: Shared utility helpers.
- `make-color.html`: Compatibility redirect to the Vite entry.
- `README.md`: Project overview and current development notes.

## Running

Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev
```

## Production Build

Install Node.js 20 or newer, then run:

```bash
npm run check
npm run build
```

Production assets are written to `dist/`. The build extracts CSS and JavaScript into separate files, avoids source maps, and supports deployment through Vercel or Netlify.

## Security

See `SECURITY.md` for deployment headers, environment variables, score validation, rate limiting, and AdSense safety notes.
