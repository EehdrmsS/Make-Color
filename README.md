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
- Level thresholds: 300, 500, 1000, 1500, 2000

### Extreme

Extreme is the ongoing survival mode.

- No time limit
- Special bubbles enabled
- Goal: survive as long as possible while clearing missions
- Every 5 mission clears queues one special bubble for future spawn
- Mud can be cleared when 5 or more Mud cells connect

## Core Rules

- The board is a 10 x 10 grid.
- Adjacent cells of the same color form a region.
- Drag one region onto an adjacent region to merge them.
- Color results are controlled by the `MIX` table in `make-color.html`.
- Regions matching active mission colors burst when they reach 5 or more cells.
- Over-mixed regions become Dead bubbles.
- Dead bubbles are removed when nearby mission regions burst.

## Special Bubble Rules

Special bubbles no longer appear through color mixing.

In Extreme mode, the UI shows the next special bubble. Every 5 mission clears, that displayed special is queued into the spawn queue. The next replacement cell spawns that special bubble.

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

- `make-color.html`: Full game implementation, including UI, rules, rendering, input, modes, and effects.
- `README.md`: Project overview and current development notes.

## Running

Open `make-color.html` directly in a browser.
