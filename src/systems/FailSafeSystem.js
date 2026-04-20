export function createFailSafeSystem({
  rows,
  cols,
  deadThreshold,
  baseColors,
  mix,
  recipe,
  isSpecialColor,
  randomFrom,
}) {
  let uses = 0;
  let cooldown = 0;

  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function mixColors(a, b) {
    if (a === b) return a;
    return mix[`${a}+${b}`] || mix[`${b}+${a}`] || 'Dk';
  }

  function isDead(cellMixMap, r, c) {
    return cellMixMap[r][c] >= deadThreshold;
  }

  function hasMeaningfulMove({ grid, cellMixMap, missions }) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = grid[r][c];
        const dead = isDead(cellMixMap, r, c);

        for (const [dr, dc] of [[1, 0], [0, 1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;

          const other = grid[nr][nc];
          if (color === other && dead === isDead(cellMixMap, nr, nc)) continue;
          if (isSpecialColor(color) || isSpecialColor(other)) return true;
          if (dead || isDead(cellMixMap, nr, nc)) continue;

          const result = mixColors(color, other);
          if (result !== 'Dk') return true;
        }
      }
    }
    return false;
  }

  function missionPairs(missions) {
    return missions
      .filter(m => !m.completed)
      .flatMap(m => {
        const ingredients = recipe[m.color];
        return ingredients ? [{ target: m.color, a: ingredients[0], b: ingredients[1] }] : [];
      });
  }

  function boardColorCounts(grid, cellMixMap) {
    const counts = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isDead(cellMixMap, r, c)) continue;
        const color = grid[r][c];
        counts.set(color, (counts.get(color) || 0) + 1);
      }
    }
    return counts;
  }

  function findPlacementForPair({ grid, cellMixMap }, pair, counts) {
    const aCount = counts.get(pair.a) || 0;
    const bCount = counts.get(pair.b) || 0;
    const candidates = aCount >= bCount
      ? [[pair.b, pair.a], [pair.a, pair.b]]
      : [[pair.a, pair.b], [pair.b, pair.a]];

    for (const [helperColor, anchorColor] of candidates) {
      const anchors = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] === anchorColor && !isDead(cellMixMap, r, c)) anchors.push([r, c]);
        }
      }

      const shuffledAnchors = anchors.sort(() => Math.random() - 0.5);
      for (const [r, c] of shuffledAnchors) {
        const adjacent = [[-1,0], [1,0], [0,-1], [0,1]]
          .map(([dr, dc]) => [r + dr, c + dc])
          .filter(([nr, nc]) => inBounds(nr, nc));
        const shuffledAdjacent = adjacent.sort(() => Math.random() - 0.5);

        for (const [nr, nc] of shuffledAdjacent) {
          if (isSpecialColor(grid[nr][nc])) continue;
          if (grid[nr][nc] === anchorColor) continue;
          return { r: nr, c: nc, color: helperColor, target: pair.target };
        }
      }
    }
    return null;
  }

  function findFallbackPlacement({ grid, cellMixMap }, missions) {
    const relevant = missionPairs(missions).flatMap(pair => [pair.a, pair.b]);
    const color = relevant.length ? randomFrom(relevant) : randomFrom(baseColors);
    const cells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isSpecialColor(grid[r][c])) continue;
        cells.push([r, c]);
      }
    }

    if (!cells.length) return null;
    const [r, c] = randomFrom(cells);
    return { r, c, color, target: null };
  }

  function maybeCreateHelper({ grid, cellMixMap, missions, maxUses = 3 }) {
    if (cooldown > 0) {
      cooldown -= 1;
      return null;
    }
    if (uses >= maxUses) return null;
    if (hasMeaningfulMove({ grid, cellMixMap, missions })) return null;

    const pairs = missionPairs(missions);
    const counts = boardColorCounts(grid, cellMixMap);
    const preferredPairs = pairs
      .filter(pair => counts.has(pair.a) || counts.has(pair.b))
      .sort(() => Math.random() - 0.5);

    let helper = null;
    for (const pair of preferredPairs) {
      helper = findPlacementForPair({ grid, cellMixMap }, pair, counts);
      if (helper) break;
    }
    helper ??= findFallbackPlacement({ grid, cellMixMap }, missions);

    if (!helper) return null;
    uses += 1;
    cooldown = 2;
    return helper;
  }

  function reset() {
    uses = 0;
    cooldown = 0;
  }

  return {
    hasMeaningfulMove,
    maybeCreateHelper,
    reset,
  };
}
