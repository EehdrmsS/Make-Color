export function createBubbleSystem() {
  return {
    getRegionAt(gridRegions, row, col) {
      return gridRegions.find(region => region.cells.some(([r, c]) => r === row && c === col)) ?? null;
    },
    areAdjacentCells(a, b) {
      return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
    },
    key(row, col) {
      return `${row},${col}`;
    },
  };
}
