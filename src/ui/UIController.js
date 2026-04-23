export function createUIController(doc = document) {
  const byId = id => doc.getElementById(id);

  return {
    byId,
    show(id) {
      byId(id)?.classList.remove('hidden');
    },
    hide(id) {
      byId(id)?.classList.add('hidden');
    },
    setText(id, value) {
      const el = byId(id);
      if (el) el.textContent = String(value);
    },
    updateTimer(timeLeft) {
      const timer = byId('timer');
      const modeStat = byId('mode-stat');
      if (modeStat) modeStat.classList.toggle('timer-low', timeLeft <= 5);
      if (!timer) return;
      timer.classList.remove('timer-low');
    },
    showRoundResult({ round, score, timeLeft }) {
      this.setText('result-round', round);
      this.setText('result-score', Number(score || 0).toLocaleString());
      this.setText('result-time', `${timeLeft}s`);
      this.show('result-screen');
    },
    hideResultScreen() {
      this.hide('result-screen');
    },
    showReviveOffer(score) {
      this.setText('revive-score', Number(score || 0).toLocaleString());
      this.show('ad-offer');
    },
    hideAdOffer() {
      this.hide('ad-offer');
    },
    hideRunOverlays() {
      this.hide('ad-offer');
      this.hide('result-screen');
    },
    showExtremeGameOver(score) {
      this.hideRunOverlays();
      this.setText('final-score', Number(score || 0).toLocaleString());
      const copy = doc.querySelector('#game-over .menu-copy');
      const startButton = doc.querySelector('#game-over [data-action="start"]');
      const startDesc = doc.querySelector('#game-over [data-action="start"] .mode-desc');
      if (copy) copy.textContent = 'Extreme score';
      if (startButton) startButton.dataset.mode = 'extreme';
      if (startDesc) startDesc.textContent = 'Start another survival run.';
      this.show('game-over');
    },
  };
}
