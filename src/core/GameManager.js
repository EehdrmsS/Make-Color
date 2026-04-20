export const GAME_STATES = Object.freeze({
  PLAYING: 'PLAYING',
  AD_OFFER: 'AD_OFFER',
  GAME_OVER: 'GAME_OVER',
});

export function createGameState(initialState = GAME_STATES.GAME_OVER) {
  return {
    state: initialState,
    extremeRounds: 0,
    pendingRoundBreak: false,
    reviveUsed: false,
  };
}

export function createGameManager(deps) {
  const state = createGameState();

  return {
    get state() {
      return state.state;
    },
    set state(nextState) {
      state.state = nextState;
    },
    get extremeRounds() {
      return state.extremeRounds;
    },
    set extremeRounds(rounds) {
      state.extremeRounds = rounds;
    },
    get pendingRoundBreak() {
      return state.pendingRoundBreak;
    },
    set pendingRoundBreak(pending) {
      state.pendingRoundBreak = pending;
    },
    get reviveUsed() {
      return state.reviveUsed;
    },
    set reviveUsed(used) {
      state.reviveUsed = used;
    },

    reset(mode) {
      this.state = GAME_STATES.PLAYING;
      this.extremeRounds = 0;
      this.pendingRoundBreak = false;
      this.reviveUsed = false;
      this.stopTimer();
      deps.setTimeLeft(mode === 'classic' ? deps.CLASSIC_TIME_LIMIT : deps.EXTREME_TIME_LIMIT);
      this.updateTimerUi();
    },

    isPlaying() {
      return this.state === GAME_STATES.PLAYING;
    },

    stopTimer() {
      const timerId = deps.getTimerTimeoutId();
      if (!timerId) return;
      clearTimeout(timerId);
      deps.gameTimers.delete(timerId);
      deps.setTimerTimeoutId(null);
    },

    startTimer() {
      this.stopTimer();
      if (!deps.getGameStarted() || deps.getGameEnded() || !this.isPlaying()) return;
      const timerId = deps.scheduleGameTimeout(() => {
        deps.setTimerTimeoutId(null);
        this.tickTimer();
      }, 1000);
      deps.setTimerTimeoutId(timerId);
    },

    tickTimer() {
      if (!deps.getGameStarted() || deps.getGameEnded() || !this.isPlaying()) return;
      deps.setTimeLeft(Math.max(0, deps.getTimeLeft() - 1));
      this.updateTimerUi();
      deps.updateModeUi();
      if (deps.getTimeLeft() <= 0) {
        if (deps.getCurrentMode() === 'classic') deps.endClassicGame();
        else this.showReviveOffer();
        return;
      }
      this.startTimer();
    },

    updateTimerUi() {
      deps.ui.updateTimer(deps.getTimeLeft());
    },

    onMissionClear() {
      if (deps.getCurrentMode() !== 'extreme' || deps.getGameEnded()) return;
      deps.setTimeLeft(Math.min(
        deps.getTimeLeft() + deps.EXTREME_MISSION_TIME_BONUS,
        deps.getExtremeTimerCap(),
      ));
      this.extremeRounds += 1;
      this.updateTimerUi();
      deps.updateModeUi();
      this.pendingRoundBreak = false;
    },

    consumeRoundBreakRequest() {
      if (!this.pendingRoundBreak || deps.getCurrentMode() !== 'extreme') return false;
      this.pendingRoundBreak = false;
      return true;
    },

    showRoundResult() {
      this.state = GAME_STATES.AD_OFFER;
      this.stopTimer();
      deps.ui.showRoundResult({
        round: this.extremeRounds,
        score: deps.getScore(),
        timeLeft: deps.getTimeLeft(),
      });
      deps.renderFrame();
    },

    continueAfterResult() {
      deps.ui.hideResultScreen();
      const resume = () => {
        this.state = GAME_STATES.PLAYING;
        this.startTimer();
        requestAnimationFrame(() => deps.triggerRemovals());
        deps.renderFrame();
      };
      if (deps.ads?.showInterstitial) deps.ads.showInterstitial(resume);
      else resume();
    },

    showReviveOffer() {
      this.stopTimer();
      this.state = this.reviveUsed ? GAME_STATES.GAME_OVER : GAME_STATES.AD_OFFER;
      deps.setGameEnded(this.reviveUsed);
      deps.setIsDragging(false);
      deps.setDragStart(null);
      deps.setHoverCell(null);
      if (this.reviveUsed) {
        this.finishExtremeGame();
        return;
      }
      deps.ui.showReviveOffer(deps.getScore());
      deps.renderFrame();
    },

    watchReviveAd() {
      if (deps.getCurrentMode() !== 'extreme' || this.reviveUsed || this.state !== GAME_STATES.AD_OFFER) return;
      if (deps.ads?.showRewarded) deps.ads.showRewarded(() => this.revive());
      else this.revive();
    },

    revive() {
      deps.ui.hideAdOffer();
      this.reviveUsed = true;
      deps.setGameEnded(false);
      this.state = GAME_STATES.PLAYING;
      deps.setTimeLeft(deps.EXTREME_REVIVE_TIME);
      deps.spawnReviveSpecialBubble();
      this.updateTimerUi();
      deps.updateModeUi();
      deps.addLog('Revived with 10 seconds and a special bubble.', 'merge');
      this.startTimer();
      requestAnimationFrame(() => deps.triggerRemovals());
      deps.renderFrame();
    },

    finishExtremeGame() {
      this.state = GAME_STATES.GAME_OVER;
      deps.setGameEnded(true);
      deps.clearGameTimers();
      deps.setIsAnimating(false);
      deps.setIsDragging(false);
      deps.setDragStart(null);
      deps.setHoverCell(null);
      deps.ui.showExtremeGameOver(deps.getScore());
      deps.submitScore('extreme');
      deps.hideTooltip();
      deps.stopLoop();
      deps.renderFrame();
    },
  };
}
