export function createScoreSystem() {
  return {
    mudAwareCellScore(color, value) {
      return color === 'Dk' ? 0 : value;
    },
    formatScore(value) {
      return Number(value || 0).toLocaleString();
    },
  };
}
