const INTERSTITIAL_EVERY = 3;

let initialized = false;
let completedRounds = 0;
let adInProgress = false;

function safeCall(fn) {
  if (typeof fn === 'function') fn();
}

function initAds() {
  if (initialized) return;
  initialized = true;
  if (typeof window.adConfig === 'function') {
    window.adConfig({
      preloadAdBreaks: 'on',
      sound: 'on',
    });
  }
}

function trackAdFrequency() {
  completedRounds += 1;
  return completedRounds % INTERSTITIAL_EVERY === 0;
}

function runBreak(options, callback) {
  initAds();
  if (adInProgress) return;
  adInProgress = true;
  let settled = false;

  const done = () => {
    if (settled) return;
    settled = true;
    adInProgress = false;
    safeCall(callback);
  };

  if (typeof window.adBreak !== 'function') {
    done();
    return;
  }

  window.adBreak({
    ...options,
    beforeAd: () => {
      if (typeof options.beforeAd === 'function') options.beforeAd();
    },
    afterAd: () => {
      if (typeof options.afterAd === 'function') options.afterAd();
      done();
    },
    adBreakDone: done,
  });
}

function showInterstitial(callback) {
  runBreak({
    type: 'next',
    name: 'extreme_round_break',
  }, callback);
}

function showRewarded(callback) {
  initAds();
  if (adInProgress) return;
  adInProgress = true;
  let rewarded = false;
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    adInProgress = false;
    if (rewarded) safeCall(callback);
  };

  if (typeof window.adBreak !== 'function') {
    rewarded = true;
    finish();
    return;
  }

  window.adBreak({
    type: 'reward',
    name: 'extreme_revive',
    beforeReward: showAdFn => {
      if (typeof showAdFn === 'function') showAdFn();
    },
    adViewed: () => {
      rewarded = true;
    },
    adDismissed: () => {
      rewarded = false;
    },
    afterAd: finish,
    adBreakDone: finish,
  });
}

export const AdManager = {
  initAds,
  showInterstitial,
  showRewarded,
  trackAdFrequency,
};
