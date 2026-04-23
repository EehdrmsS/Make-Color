import './styles.css';
import './contentPages.js';
import { AdManager } from './ads/adManager.js';
import { randomFrom as helperRandomFrom, formatTime as helperFormatTime } from './utils/helpers.js';
import { GAME_STATES, createGameManager } from './core/GameManager.js';
import { createTimerState } from './core/Timer.js';
import { createBubbleSystem } from './systems/BubbleSystem.js';
import { createScoreSystem } from './systems/ScoreSystem.js';
import { createFailSafeSystem } from './systems/FailSafeSystem.js';
import { createUIController } from './ui/UIController.js';

// ═══════════════════════════════════════════════
// [COLOR SYSTEM] 색상 정의
// ═══════════════════════════════════════════════
// 기본 5색 선정 원칙:
//   - 서로 섞인 결과(2차색)가 기본 5색과 겹치지 않아야 함
//   - 따라서 자연 스폰된 버블끼리 섞여도 연쇄 제거 불가
// 기본색: Red, Yellow, Blue, Green, Purple
//   R+Y=O(주황), R+B=Pk(분홍), Y+B=Tl(청록), R+G=Br(갈색),
//   R+P=Dp(진보라), Y+G=Lm(라임), Y+P=O2(황보라→주황계),
//   B+G=Cy(청녹), B+P=Ib(남색), G+P=Gy(회색)
// → 모든 2차 결과가 기본 5색(R,Y,B,G,P)과 다른 색이 됨
//
// ★ 색을 추가/수정하려면 COLORS, MIX, RECIPE 세 곳을 함께 수정하세요.

// ── 1차색(스폰 가능) ──────────────────────────
// ★ rgb 값을 바꾸면 게임 내 버블 색이 바뀝니다.
const COLORS = {
  R:  { name:'Red',      rgb:[218,  52,  52] },
  Y:  { name:'Yellow',   rgb:[238, 196,  28] },
  B:  { name:'Blue',     rgb:[ 48,  88, 205] },
  G:  { name:'Green',    rgb:[ 55, 155,  65] },
  P:  { name:'Purple',   rgb:[140,  55, 180] },
  // ── 2차색(merge 결과만, 직접 스폰 불가) ─────
  O:  { name:'Orange',   rgb:[228, 122,  30] }, // R+Y
  Pk: { name:'Pink',     rgb:[210,  80, 130] }, // R+B (레거시)
  Tl: { name:'Teal',     rgb:[ 45, 168, 148] }, // Y+B (레거시)
  Br: { name:'Brown',    rgb:[148,  82,  28] }, // O+G
  Lm: { name:'Lime',     rgb:[140, 190,  40] }, // Y+G
  Cy: { name:'Cyan',     rgb:[ 40, 155, 190] }, // B+G
  Dp: { name:'Indigo',   rgb:[ 75,  40, 170] }, // B+P
  Mg: { name:'Magenta',  rgb:[195,  45, 160] }, // R+P
  Gy: { name:'Gray',     rgb:[128, 128, 128] }, // 레거시 — MIX에서 더 이상 생성 안 됨
  // ── 탁색(3차: 2차색끼리 섞이면 탁해짐) ──────
  Dk: { name:'Mud',      rgb:[ 90,  70,  55] }, // 탁한 갈색계
  // ── 스페셜 버블 (미션 5회마다 생성 큐에 예약됨) ─
  Bm: { name:'Bomb',     rgb:[210,  40,   0], special:true },
  Rc: { name:'Recycle',  rgb:[  0, 200, 120], special:true },
  Gc: { name:'Lucky',    rgb:[255,  20, 140], special:true },
  Ls: { name:'Laser',    rgb:[  0, 230, 255], special:true },
  Cl: { name:'Clean',    rgb:[130, 210, 255], special:true },
  Rb: { name:'Rainbow',  rgb:[200,  80, 255], special:true },
};

// ── 혼합표: 두 색 키를 '+' 로 연결하면 결과 색이 나옴 ──────────
// 키 순서(알파벳 순 a+b)는 mixColors()에서 양방향으로 탐색하므로
// 'A+B' 만 등록해도 'B+A' 도 자동 처리됩니다.
// ★ 새 색을 추가하려면 이 테이블에 항목을 추가하세요.
const MIX = {
  // 기본색 조합 → 선명한 2차색
  'R+Y':'O',  'R+B':'P',  'R+G':'Br', 'R+P':'Mg',
  'Y+B':'G',  'Y+G':'Lm',
  'B+G':'Cy', 'B+P':'Dp',
  'G+P':'Dk', // Gray 삭제 → Mud로 처리
  // 기본색 + 2차색 → 탁색
  'R+O':'Dk','R+Br':'Dk','R+Lm':'Dk','R+Cy':'Dk','R+Dp':'Dk','R+Mg':'Dk','R+Yw':'Dk',
  'Y+O':'Dk','Y+Br':'Dk','Y+Lm':'Dk','Y+Cy':'Dk','Y+Dp':'Dk','Y+Mg':'Dk','Y+Yw':'Dk',
  'B+O':'Dk','B+Br':'Dk','B+Lm':'Dk','B+Cy':'Dk','B+Dp':'Dk','B+Mg':'Dk','B+Yw':'Dk',
  'G+O':'Br', 'G+Br':'Dk','G+Lm':'Dk','G+Cy':'Dk','G+Dp':'Dk','G+Mg':'Dk','G+Yw':'Dk',
  'P+O':'Dk','P+Br':'Dk','P+Lm':'Dk','P+Cy':'Dk','P+Dp':'Dk','P+Mg':'Dk','P+Yw':'Dk',
  // 2차색끼리 → 탁색
  'O+Br':'Dk','O+Lm':'Dk','O+Cy':'Dk','O+Dp':'Dk','O+Mg':'Dk','O+Yw':'Dk',
  'Br+Lm':'Dk','Br+Cy':'Dk','Br+Dp':'Dk','Br+Mg':'Dk','Br+Yw':'Dk',
  'Lm+Cy':'Dk','Lm+Dp':'Dk','Lm+Mg':'Dk','Lm+Yw':'Dk',
  'Cy+Dp':'Dk','Cy+Mg':'Dk','Cy+Yw':'Dk',
  'Dp+Mg':'Dk','Dp+Yw':'Dk',
  'Mg+Yw':'Dk',
  // Mud는 더 이상 스페셜을 만들지 않음. 다른 색과 섞이면 계속 Mud가 됩니다.
  'R+Dk':'Dk','Y+Dk':'Dk','B+Dk':'Dk','G+Dk':'Dk','P+Dk':'Dk','O+Dk':'Dk',
  'Br+Dk':'Dk','Lm+Dk':'Dk','Cy+Dk':'Dk','Dp+Dk':'Dk','Mg+Dk':'Dk','Yw+Dk':'Dk','Dk+Dk':'Dk',
  // 레거시 Gy 조합 (Gy 가 필드에 남아있을 경우 대비)
  'R+Gy':'Dk','Y+Gy':'Dk','B+Gy':'Dk','G+Gy':'Dk','P+Gy':'Dk','Gy+Dk':'Dk','Gy+Gy':'Dk',
};

// ★ 스폰 가능한 기본 색상 목록 — 버블 터진 후 리스폰 색상 (3원색만)
// G, P 는 조합으로만 만들 수 있음 (이단 조합 설계)
const BASE_COLORS = ['R','Y','B'];

// ★ 게임 시작 시 초기 그리드에만 사용하는 색 — 3원색으로 제한해 초반 난이도를 낮춤
const INIT_COLORS = ['R','Y','B'];

// ★ mixCount 가 이 값 이상이면 해당 region 은 Dead(검게 굳음) 처리됨
// Dead 버블은 미션 region 터질 때 주변 1칸만 같이 사라짐
const DEAD_THRESHOLD = 3;

// ═══════════════════════════════════════════════
// [MISSION SYSTEM] 미션 시스템
// ═══════════════════════════════════════════════
// 미션 설계 방향: "어떤 색을 만들어라!" — 조합 힌트 없이 목표 색만 제시
// 플레이어가 Mix Guide(사이드바)를 보며 스스로 조합을 추론해야 합니다.
//
// ★ 미션 후보색: 반드시 merge 로만 만들 수 있는 2차색 목록
//   (여기서 제거하면 해당 색은 미션으로 출제되지 않음)
const MISSION_COLORS     = ['O','G','P','Br','Lm','Cy','Dp','Mg']; // 일반 미션 풀
const SPECIAL_COLORS = ['Bm','Rc','Gc','Ls','Cl','Rb'];    // 스페셜 생성 후보
const SPECIAL_READY_INTERVAL = 5;
const CLASSIC_TIME_LIMIT = 120;
const EXTREME_TIME_LIMIT = 30;
const EXTREME_MISSION_TIME_BONUS = 10;
const EXTREME_REVIVE_TIME = 10;
const EXTREME_TIMER_CAP = 60;
const MISSION_COLORS_LV12 = ['O','G','P']; // 레벨 1~2 전용 — 1차 조합색만

// 2차색 → 기본색 조합 역추적 테이블 (내부 로직용)
const RECIPE = {
  O:  ['R','Y'], G:  ['Y','B'], P:  ['R','B'],
  Br: ['O','G'], Lm: ['Y','G'], Cy: ['B','G'],
  Dp: ['B','P'], Mg: ['R','P'],
};
const MIX_GUIDE_RECIPES = [
  ['R','Y','O'],
  ['R','B','P'],
  ['Y','B','G'],
  ['R','G','Br'],
  ['Y','G','Lm'],
  ['B','G','Cy'],
  ['B','P','Dp'],
  ['R','P','Mg'],
];

// 스페셜 버블 캔버스 표시 레이블
const SPECIAL_LABELS = { Bm:'BOMB', Rc:'REC', Gc:'LUCK', Ls:'LZR', Cl:'CLN', Rb:'RBW' };
const SPECIAL_GUIDE = {
  Bm: 'Clears every bubble matching the merged target color. Cannot target Dead bubbles.',
  Rc: 'Refreshes mixed and Dead bubbles by resetting their mix state.',
  Gc: 'Gives 1000 bonus points.',
  Ls: 'Clears the row and column crossing the Laser bubble.',
  Cl: 'Revives Dead bubbles back into playable colors.',
  Rb: 'Changes every bubble matching the merged target color into a mission color. Cannot target Dead bubbles.',
};
const SPECIAL_CLEAR_SCORE_PER_CELL = 10;
const LUCKY_SCORE_BONUS = 1000;

let missions = [];    // 현재 활성 미션 슬롯: [{color, completed}, ...]
let specialMission = null; // UI에 표시되는 다음 스페셜 버블
let missionScore = 0;
let pendingSpecialSpawns = [];
let tutorialShown = false;
let currentMode = 'extreme';
let gameStarted = false;
let gameEnded = false;
let timeLeft = CLASSIC_TIME_LIMIT;
let timerWaitingForTutorial = false;
let scoreSession = null;
let manualMobileMode = null;
let timerTimeoutId = null;

function setSpecialMission(color) {
  specialMission = { color: color ?? randomFrom(SPECIAL_COLORS), completed:false };
}

function isValidMode(mode) {
  return mode === 'classic' || mode === 'extreme';
}

function formatTime(sec) {
  return helperFormatTime(sec);
}

function getExtremeTimerCap(lv = level) {
  void lv;
  return EXTREME_TIMER_CAP;
}

function clampExtremeTimer() {
  if (currentMode !== 'extreme') return;
  timeLeft = Math.min(timeLeft, getExtremeTimerCap());
}

function shouldUseMobileMode() {
  return window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
}

function shouldUseTabletMode() {
  return window.matchMedia('(pointer: coarse) and (min-width: 700px)').matches;
}

function isCompactTouchMode() {
  return window.matchMedia('(pointer: coarse) and (max-width: 640px)').matches;
}

function setMobileMode(enabled, manual = false) {
  if (manual) manualMobileMode = enabled;
  const active = manualMobileMode ?? enabled;
  document.body.classList.toggle('mobile-game', active);
  document.body.classList.toggle('tablet-game', active && shouldUseTabletMode());
  const toggle = document.getElementById('mobile-mode-toggle');
  if (toggle) toggle.textContent = active ? 'Desktop View' : 'Mobile View';
  if (typeof renderFrame === 'function') renderFrame();
}

function syncMobileMode() {
  setMobileMode(shouldUseMobileMode());
}

function toggleMobileMode() {
  const active = document.body.classList.contains('mobile-game');
  setMobileMode(!active, true);
}

let GameManager;

function updateModeUi() {
  const isClassic = currentMode === 'classic';
  document.getElementById('mode-stat-label').textContent = isClassic ? 'Time' : 'Timer';
  document.getElementById('mode-stat').textContent = formatTime(timeLeft);
  document.getElementById('mode-stat-sub').textContent = isClassic ? 'Classic' : 'Extreme';
  GameManager.updateTimerUi();
  document.querySelector('.gold-mission-wrap').style.display = isClassic ? 'none' : 'flex';
  const spawnQueueWrap = document.getElementById('spawn-queue-wrap');
  if (spawnQueueWrap) spawnQueueWrap.style.display = isClassic ? 'none' : 'block';
}

function tickClassicTimer() {
  GameManager.tickTimer();
}

function startClassicTimer() {
  GameManager.startTimer();
}

function endClassicGame() {
  GameManager.state = GAME_STATES.GAME_OVER;
  GameManager.stopTimer();
  gameEnded = true;
  clearGameTimers();
  isAnimating = false;
  isDragging = false;
  dragStart = null;
  hoverCell = null;
  document.getElementById('final-score').textContent = score.toLocaleString();
  document.querySelector('#game-over .menu-copy').textContent = 'Classic score';
  document.querySelector('#game-over [data-action="start"]').dataset.mode = 'classic';
  document.querySelector('#game-over [data-action="start"] .mode-desc').textContent = 'Start another timed run.';
  document.getElementById('game-over').classList.remove('hidden');
  submitScore('classic');
  hideTooltip();
  stopLoop();
  renderFrame();
}

function startGame(mode) {
  if (!isValidMode(mode)) {
    logSecurityEvent('invalid_mode', { mode });
    return;
  }
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('ad-offer').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  initGame(mode);
}

function restartGame() {
  startGame(currentMode);
}

function showMainMenu() {
  GameManager.state = GAME_STATES.GAME_OVER;
  GameManager.stopTimer();
  gameStarted = false;
  gameEnded = true;
  timerWaitingForTutorial = false;
  clearGameTimers();
  stopLoop();
  hideTooltip();
  document.getElementById('tutorial-overlay').classList.add('hidden');
  document.getElementById('ad-offer').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

function setupUiActions() {
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'start') startGame(btn.dataset.mode);
    else if (action === 'restart') restartGame();
    else if (action === 'menu') showMainMenu();
    else if (action === 'close-tutorial') closeTutorial();
    else if (action === 'open-recipe-popover') showRecipePopover();
    else if (action === 'close-recipe-popover') hideRecipePopover();
    else if (action === 'mobile-mode') toggleMobileMode();
    else if (action === 'continue-round') GameManager.continueAfterResult();
    else if (action === 'watch-revive-ad') GameManager.watchReviveAd();
    else if (action === 'quit-extreme') GameManager.finishExtremeGame();
    else logSecurityEvent('unknown_ui_action', { action });
  });
}

function logSecurityEvent(type, details = {}) {
  const safeType = String(type).slice(0, 80);
  const payload = {
    type: safeType,
    details,
    mode: currentMode,
    score,
    timeLeft,
    ts: Date.now(),
  };
  console.warn('[security]', payload);
  if (navigator.sendBeacon) {
    const body = JSON.stringify(payload);
    navigator.sendBeacon('/api/log-event', new Blob([body], { type: 'application/json' }));
  }
}

async function createScoreChecksum(payload) {
  if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('web_crypto_unavailable');
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(scoreSession.token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const canonical = `${payload.score}:${payload.elapsedSeconds}:${payload.mode}:${payload.sessionId}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  const bytes = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startScoreSession(mode) {
  scoreSession = null;
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`session ${res.status}`);
    const data = await res.json();
    if (typeof data.sessionId === 'string' && typeof data.token === 'string') {
      scoreSession = data;
      scoreSession.localStartedAt = performance.now();
    }
  } catch (err) {
    logSecurityEvent('score_session_failed', { message: err.message });
  }
}

async function submitScore(mode) {
  if (!scoreSession || !isValidMode(mode)) return;
  const payload = {
    mode,
    score: Number(score),
    level: Number(level),
    merges: Number(mergeCount),
    elapsedSeconds: mode === 'classic'
      ? CLASSIC_TIME_LIMIT - timeLeft
      : Math.max(0, Math.floor((performance.now() - scoreSession.localStartedAt) / 1000)),
    sessionId: scoreSession.sessionId,
    token: scoreSession.token,
  };

  try {
    payload.checksum = await createScoreChecksum(payload);
    const res = await fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
    if (!res.ok) logSecurityEvent('score_submit_rejected', { status: res.status });
  } catch (err) {
    logSecurityEvent('score_submit_failed', { message: err.message });
  }
}

// ── 유틸리티 함수 ────────────────────────────────────────────────
// 두 색 키를 섞어 결과 색 키를 반환. 테이블에 없으면 Dk(탁색)
function mixColors(a, b) {
  if (a === b) return a;
  return MIX[`${a}+${b}`] || MIX[`${b}+${a}`] || 'Dk';
}

function randomFrom(arr) { return helperRandomFrom(arr); }
function toRgb(key)       { return COLORS[key].rgb; }
// alpha: 0~1 (투명도)
function toCss(key, alpha=1) {
  const [r,g,b] = toRgb(key);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════
// [GAME STATE] 게임 상태 변수
// ═══════════════════════════════════════════════
// ★ 그리드 크기: COLS × ROWS 칸, CELL = 한 칸의 픽셀 크기
const COLS = 10, ROWS = 10;
const CELL = 52;   // ★ 칸 크기(px) — 바꾸면 캔버스 전체 크기가 변함
const PAD  = 10;   // 캔버스 여백(px)
const W = COLS*CELL + PAD*2;  // 캔버스 가로 픽셀
const H = ROWS*CELL + PAD*2;  // 캔버스 세로 픽셀
const FAIL_SAFE_MAX_USES = 3;

let grid = [];       // grid[r][c] = 색 키 문자열 (e.g. 'R', 'O', ...)
let regions = [];    // 연결된 같은 색 셀들의 묶음 배열 (BFS 로 구성)
let gridRegion = []; // gridRegion[r][c] = 해당 셀이 속한 region 객체
// cellMixMap: 셀별 mixCount 를 별도 저장 — region 재빌드 시 정확한 값 유지
let cellMixMap = []; // cellMixMap[r][c] = 해당 셀의 혼합 횟수

let score = 0, mergeCount = 0;
let dragStart = null;
let touchStartPoint = null;
let touchDragActivated = false;
let hoverCell = null;
let isDragging = false;
let isAnimating = false;

let burstCells       = [];
let particles        = [];
let ripples          = [];
let appearCells      = [];
let specialTriggers  = [];

let rafId = null;
let lastTs = 0;
let gameRunId = 0;
let gameTimers = new Set();
let bubbleSpriteCache = new Map();
let frameBurstMap = null;
let frameAppearMap = null;
const MAX_PARTICLES = 360;
const COMPACT_MAX_PARTICLES = 160;
const failSafeSystem = createFailSafeSystem({
  rows: ROWS,
  cols: COLS,
  deadThreshold: DEAD_THRESHOLD,
  baseColors: BASE_COLORS,
  mix: MIX,
  recipe: RECIPE,
  isSpecialColor: color => Boolean(COLORS[color]?.special),
  randomFrom,
});

function maxParticlesForDevice() {
  return isCompactTouchMode() ? COMPACT_MAX_PARTICLES : MAX_PARTICLES;
}

function clearGameTimers() {
  gameTimers.forEach(id => clearTimeout(id));
  gameTimers.clear();
  timerTimeoutId = null;
}

function scheduleGameTimeout(fn, delay) {
  const runId = gameRunId;
  const id = setTimeout(() => {
    gameTimers.delete(id);
    if (runId !== gameRunId) return;
    fn();
  }, delay);
  gameTimers.add(id);
  return id;
}

const timerState = createTimerState();
const bubbleSystem = createBubbleSystem();
const scoreSystem = createScoreSystem();
const uiController = createUIController(document);
void timerState;
void bubbleSystem;
void scoreSystem;

GameManager = createGameManager({
  CLASSIC_TIME_LIMIT,
  EXTREME_TIME_LIMIT,
  EXTREME_MISSION_TIME_BONUS,
  EXTREME_REVIVE_TIME,
  ui: uiController,
  ads: AdManager,
  gameTimers,
  getCurrentMode: () => currentMode,
  getGameStarted: () => gameStarted,
  getGameEnded: () => gameEnded,
  setGameEnded: value => { gameEnded = value; },
  getTimeLeft: () => timeLeft,
  setTimeLeft: value => { timeLeft = value; },
  getScore: () => score,
  getExtremeTimerCap,
  updateModeUi,
  endClassicGame,
  scheduleGameTimeout,
  getTimerTimeoutId: () => timerTimeoutId,
  setTimerTimeoutId: value => { timerTimeoutId = value; },
  clearGameTimers,
  setIsAnimating: value => { isAnimating = value; },
  setIsDragging: value => { isDragging = value; },
  setDragStart: value => { dragStart = value; },
  setHoverCell: value => { hoverCell = value; },
  spawnReviveSpecialBubble,
  triggerRemovals,
  renderFrame,
  addLog,
  submitScore,
  hideTooltip,
  stopLoop,
});

function getBubbleSprite(colorKey, dead=false, special=false) {
  const key = `${colorKey}:${dead ? 'dead' : special ? 'special' : 'normal'}`;
  if (bubbleSpriteCache.has(key)) return bubbleSpriteCache.get(key);

  const size = Math.ceil(CELL * 1.02);
  const r = CELL * 0.44;
  const cx = size / 2;
  const cy = size / 2;
  const cnv = document.createElement('canvas');
  cnv.width = size;
  cnv.height = size;
  const g = cnv.getContext('2d');
  const [r0,g0,b0] = toRgb(colorKey);

  let fill;
  if (dead) {
    fill = g.createRadialGradient(cx-r*0.3, cy-r*0.3, 0, cx, cy, r);
    fill.addColorStop(0,'rgba(55,50,70,0.95)');
    fill.addColorStop(0.5,'rgba(28,25,40,0.98)');
    fill.addColorStop(1,'rgba(15,12,22,1)');
  } else if (special) {
    fill = g.createRadialGradient(cx-r*0.3, cy-r*0.35, 0, cx, cy, r*1.1);
    fill.addColorStop(0, 'rgba(255,255,255,0.85)');
    fill.addColorStop(0.3, `rgba(${Math.min(255,r0+80)},${Math.min(255,g0+70)},${Math.min(255,b0+60)},1)`);
    fill.addColorStop(0.7, `rgba(${r0},${g0},${b0},1)`);
    fill.addColorStop(1, `rgba(${Math.max(0,r0-40)},${Math.max(0,g0-40)},${Math.max(0,b0-40)},0.95)`);
  } else {
    fill = g.createRadialGradient(cx-r*0.35, cy-r*0.38, 0, cx, cy, r*1.1);
    fill.addColorStop(0, `rgba(${Math.min(255,r0+60)},${Math.min(255,g0+50)},${Math.min(255,b0+40)},1)`);
    fill.addColorStop(0.45, `rgba(${r0},${g0},${b0},1)`);
    fill.addColorStop(0.8, `rgba(${Math.max(0,r0-30)},${Math.max(0,g0-30)},${Math.max(0,b0-25)},1)`);
    fill.addColorStop(1, `rgba(${Math.max(0,r0-55)},${Math.max(0,g0-55)},${Math.max(0,b0-50)},0.9)`);
  }

  g.fillStyle = fill;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  if (!dead) {
    const hl = g.createRadialGradient(cx-r*0.25, cy-r*0.3, 0, cx-r*0.1, cy-r*0.15, r*0.55);
    hl.addColorStop(0,'rgba(255,255,255,0.45)');
    hl.addColorStop(0.6,'rgba(255,255,255,0.08)');
    hl.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  bubbleSpriteCache.set(key, cnv);
  return cnv;
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

// ═══════════════════════════════════════════════
// [REGION MANAGEMENT] 연결 영역 관리
// ═══════════════════════════════════════════════
// region: 같은 색으로 인접 연결된 셀 묶음
//   { id, cells: [[r,c],...], color, mixCount, isDead }
let _rid = 0; // region 고유 ID 카운터
function makeRegion(cells, color, mixCount=0) {
  return { id: _rid++, cells: cells.map(c=>[...c]), color, mixCount, isDead: mixCount >= DEAD_THRESHOLD };
}

// grid 전체를 BFS로 순회하여 regions 와 gridRegion 을 다시 구성
// cellMixMap 을 기준으로 mixCount 를 복원하므로 merge 후에도 정확한 값 유지
function rebuildRegions() {
  const visited = Array.from({length:ROWS},()=>Array(COLS).fill(false));
  regions = [];
  gridRegion = Array.from({length:ROWS},()=>Array(COLS).fill(null));

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (visited[r][c]) continue;
    const color = grid[r][c];
    const startDead = cellMixMap[r][c] >= DEAD_THRESHOLD; // 시작 셀의 dead 상태
    const cells = [];
    const queue = [[r,c]];
    visited[r][c] = true;
    while (queue.length) {
      const [cr,cc] = queue.shift();
      cells.push([cr,cc]);
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=cr+dr, nc=cc+dc;
        if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&grid[nr][nc]===color) {
          // dead 상태가 다른 셀은 별도 region으로 분리 (오염 방지)
          const neighborDead = cellMixMap[nr][nc] >= DEAD_THRESHOLD;
          if (neighborDead !== startDead) continue;
          visited[nr][nc]=true;
          queue.push([nr,nc]);
        }
      }
    }
    // 첫 번째 셀의 mixCount를 region 대표값으로 사용
    // (merge 시 모든 셀에 동일한 newMix를 씌우므로 일관성 보장)
    const regionMix = cellMixMap[cells[0][0]][cells[0][1]];
    const reg = makeRegion(cells, color, regionMix);
    regions.push(reg);
    cells.forEach(([rr,cc]) => gridRegion[rr][cc] = reg);
  }
}

function getRegionAt(r,c) { return gridRegion[r][c] || null; }

function adjacentRegions(reg) {
  const seen = new Set(), result = [];
  for (const [r,c] of reg.cells) {
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr=r+dr, nc=c+dc;
      if (nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
      const nb = gridRegion[nr][nc];
      if (nb && nb!==reg && !seen.has(nb.id)) { seen.add(nb.id); result.push(nb); }
    }
  }
  return result;
}

function areRegionsAdjacent(a,b) {
  for (const [r,c] of a.cells)
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr=r+dr, nc=c+dc;
      if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&gridRegion[nr][nc]===b) return true;
    }
  return false;
}

// ═══════════════════════════════════════════════
// [MERGE LOGIC] 버블 병합 처리
// ═══════════════════════════════════════════════
// 두 인접 region 을 드래그로 연결하면 doMerge 가 호출됨
function doMerge(regA, regB) {
  if (!gameStarted || gameEnded) return;
  if (isAnimating) return;

  // 스페셜 버블 처리 — 일반 merge 로직보다 우선
  const isSpecialA = COLORS[regA.color]?.special;
  const isSpecialB = COLORS[regB.color]?.special;
  if (isSpecialA || isSpecialB) {
    const specialReg = isSpecialA ? regA : regB;
    const targetReg  = isSpecialA ? regB : regA;
    triggerSpecial(specialReg, targetReg);
    return;
  }

  const newColor = mixColors(regA.color, regB.color);
  // 스페셜 버블 생성 시 mixCount = 1 (dead 판정 방지)
  const newMix = COLORS[newColor]?.special
    ? 1
    : Math.max(regA.mixCount, regB.mixCount) + 1;
  const newCells = [...regA.cells, ...regB.cells];

  newCells.forEach(([r,c]) => {
    grid[r][c] = newColor;
    cellMixMap[r][c] = newMix;
  });

  mergeCount++;
  document.getElementById('merges').textContent = mergeCount;
  addLog(`${COLORS[regA.color].name} + ${COLORS[regB.color].name} → ${COLORS[newColor].name}  mix:${newMix}`, 'merge');

  rebuildRegions();
  triggerRemovals();
}

function canSpecialTarget(specialReg, targetReg) {
  if (!specialReg || !targetReg) return false;
  const blocksDeadTarget = specialReg.color === 'Bm' || specialReg.color === 'Rb';
  return !(blocksDeadTarget && targetReg.isDead);
}

// ═══════════════════════════════════════════════
// [SPECIAL BUBBLES] 스페셜 버블 효과 처리
// ═══════════════════════════════════════════════
function triggerSpecial(specialReg, targetReg) {
  if (currentMode === 'classic') return;
  if (isAnimating) return;
  if (!canSpecialTarget(specialReg, targetReg)) {
    addLog(`${COLORS[specialReg.color].name} cannot merge with Dead bubbles.`, 'dead');
    renderFrame();
    return;
  }
  mergeCount++;
  document.getElementById('merges').textContent = mergeCount;

  // 스페셜 버블은 미션 UI 상태와 무관하게 언제든 발동합니다.
  isAnimating = true;
  switch (specialReg.color) {
    case 'Bm': applyBomb(specialReg, targetReg);    break;
    case 'Rc': applyRecycle(specialReg, targetReg); break;
    case 'Gc': applyGoldCoin(specialReg, targetReg);break;
    case 'Ls': applyLaser(specialReg, targetReg);   break;
    case 'Cl': applyClean(specialReg, targetReg);   break;
    case 'Rb': applyRainbow(specialReg, targetReg); break;
  }
}

function resetCells(cells, color=null) {
  cells.forEach(([r,c]) => {
    grid[r][c] = color ?? randomFrom(BASE_COLORS);
    cellMixMap[r][c] = 0;
  });
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function uniqueCells(cells) {
  const seen = new Set();
  const result = [];
  cells.forEach(([r, c]) => {
    const k = cellKey(r, c);
    if (seen.has(k)) return;
    seen.add(k);
    result.push([r, c]);
  });
  return result;
}

function cellsByColor(color) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === color) cells.push([r, c]);
    }
  }
  return cells;
}

function scoreForClearedCells(cells) {
  return cells.filter(([r, c]) => grid[r][c] !== 'Dk').length * SPECIAL_CLEAR_SCORE_PER_CELL;
}

function showScorePopAtCells(cells, pts, color) {
  if (!cells.length || pts <= 0) return;
  const proxy = {
    color,
    cells,
  };
  showScorePop(proxy, pts);
}

function commitSpecialAfterFx(type, commit) {
  startLoop();
  scheduleGameTimeout(() => {
    commit();
    rebuildRegions();
    isAnimating = false;
    triggerRemovals();
  }, SPECIAL_TRIGGER_DUR[type] ?? 700);
}

// 💣 BOMB: 병합한 대상 색상의 모든 버블 제거
function applyBomb(specialReg, targetReg) {
  const targetCells = cellsByColor(targetReg.color);
  const clearCells = uniqueCells([...targetCells, ...specialReg.cells]);
  spawnSpecialTrigger('Bm', specialReg.cells, { targetCells });
  commitSpecialAfterFx('Bm', () => {
    const pts = scoreForClearedCells(targetCells);
    score += pts;
    document.getElementById('score').textContent = score;
    checkLevelUp();
    showScorePopAtCells(targetCells, pts, targetReg.color);
    addLog(`💣 BOMB! all ${COLORS[targetReg.color].name} ×${targetCells.length} destroyed! +${pts}`, 'remove');
    spawnSpecialBurst('Bm', clearCells);
    resetCells(clearCells);
  });
}

// ♻️ RECYCLE: 필드 전체 mixCount 초기화 (dead 부활)
function applyRecycle(specialReg, targetReg) {
  spawnSpecialTrigger('Rc', specialReg.cells);
  commitSpecialAfterFx('Rc', () => {
    let revived = 0;
    for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
      if (cellMixMap[r][c] > 0) { cellMixMap[r][c] = 0; revived++; }
    }
    spawnSpecialBurst('Rc', specialReg.cells);
    resetCells(specialReg.cells);
    addLog(`♻️ RECYCLE! ${revived} cells reset to mix×0!`, 'merge');
  });
}

// 💰 LUCKY: 고정 보너스 점수
function applyGoldCoin(specialReg, targetReg) {
  spawnSpecialTrigger('Gc', specialReg.cells);
  commitSpecialAfterFx('Gc', () => {
    score += LUCKY_SCORE_BONUS;
    document.getElementById('score').textContent = score;
    checkLevelUp();
    showScorePop(specialReg, LUCKY_SCORE_BONUS);
    addLog(`💰 LUCKY! +${LUCKY_SCORE_BONUS} bonus score!`, 'remove');
    spawnSpecialBurst('Gc', specialReg.cells);
    resetCells(specialReg.cells);
  });
}

// ⚡ LASER: 스페셜 버블 위치 기준 십자(+) 범위 삭제
function applyLaser(specialReg, targetReg) {
  const rows = [...new Set(specialReg.cells.map(([r])=>r))];
  const cols = [...new Set(specialReg.cells.map(([,c])=>c))];
  spawnSpecialTrigger('Ls', specialReg.cells, { rows, cols });
  const hitSet = new Set();
  specialReg.cells.forEach(([lr, lc]) => {
    for (let c=0; c<COLS; c++) hitSet.add(cellKey(lr,c));
    for (let r=0; r<ROWS; r++) hitSet.add(cellKey(r,lc));
  });
  const hitCells = [...hitSet]
    .map(k => k.split(',').map(Number))
    .map(([r, c]) => ({
      r,
      c,
      color: grid[r][c],
      isDead: cellMixMap[r][c] >= DEAD_THRESHOLD,
      suppressSpecial: Boolean(COLORS[grid[r][c]]?.special),
    }));

  startLoop();
  scheduleGameTimeout(() => {
    const pts = hitCells.filter(cell => cell.color !== 'Dk').length * SPECIAL_CLEAR_SCORE_PER_CELL;
    score += pts;
    document.getElementById('score').textContent = score;
    checkLevelUp();
    addLog(`⚡ LASER! ${hitCells.length} cells cleared! +${pts}`, 'remove');
    spawnSpecialBurst('Ls', specialReg.cells);

    const compactFx = isCompactTouchMode();
    const BURST_DURATION = compactFx ? 180 : 240;
    const STAGGER = compactFx ? 4 : 8;
    const MAX_STAGGER_DELAY = compactFx ? 70 : 120;
    const [sx, sy] = cellCenter(specialReg.cells[0][0], specialReg.cells[0][1]);
    const now = performance.now();

    hitCells
      .sort((a, b) => {
        const [ax, ay] = cellCenter(a.r, a.c);
        const [bx, by] = cellCenter(b.r, b.c);
        return Math.hypot(ax - sx, ay - sy) - Math.hypot(bx - sx, by - sy);
      })
      .forEach((cell, i) => {
        burstCells.push({
          r: cell.r,
          c: cell.c,
          color: cell.color,
          isDead: cell.isDead,
          suppressSpecial: cell.suppressSpecial,
          startT: now + Math.min(i * STAGGER, MAX_STAGGER_DELAY),
          duration: BURST_DURATION,
        });
      });

    const totalDur = Math.min(hitCells.length * STAGGER, MAX_STAGGER_DELAY) + BURST_DURATION + 60;
    scheduleGameTimeout(() => {
      const laserHitKeys = new Set(hitCells.map(cell => cellKey(cell.r, cell.c)));
      resetCells(hitCells.map(cell => [cell.r, cell.c]));
      rebuildRegions();
      burstCells = burstCells.filter(cell => !laserHitKeys.has(cellKey(cell.r, cell.c)));

      const appearNow = performance.now();
      hitCells.forEach(cell => {
        appearCells.push({ r: cell.r, c: cell.c, startT: appearNow });
      });

      isAnimating = false;
      requestAnimationFrame(() => triggerRemovals());
    }, totalDur);
  }, SPECIAL_TRIGGER_DUR.Ls);
}

// 🌿 CLEAN: 모든 dead 버블 → 무작위 원색
function applyClean(specialReg, targetReg) {
  spawnSpecialTrigger('Cl', specialReg.cells);
  commitSpecialAfterFx('Cl', () => {
    let cleaned = 0;
    for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) {
      if (cellMixMap[r][c] >= DEAD_THRESHOLD) {
        grid[r][c] = randomFrom(BASE_COLORS);
        cellMixMap[r][c] = 0;
        cleaned++;
      }
    }
    spawnSpecialBurst('Cl', specialReg.cells);
    resetCells(specialReg.cells);
    addLog(`🌿 CLEAN! ${cleaned} dead cells revived!`, 'merge');
  });
}

// 🌈 RAINBOW: 병합한 대상 색상의 모든 버블 → 랜덤 미션 색상으로 변환
function applyRainbow(specialReg, targetReg) {
  spawnSpecialTrigger('Rb', specialReg.cells);
  const options = missions.filter(m => !m.completed).map(m => m.color);
  const targetColor = options.length ? randomFrom(options) : randomFrom(MISSION_COLORS);
  const targetCells = cellsByColor(targetReg.color);
  commitSpecialAfterFx('Rb', () => {
    const newMix = Math.max(1, targetReg.mixCount);
    targetCells.forEach(([r,c]) => {
      grid[r][c] = targetColor;
      cellMixMap[r][c] = newMix;
    });
    spawnSpecialBurst('Rb', [...specialReg.cells, ...targetCells]);
    resetCells(specialReg.cells);
    addLog(`🌈 RAINBOW! all ${COLORS[targetReg.color].name} ×${targetCells.length} became ${COLORS[targetColor].name}!`, 'merge');
  });
}

// ═══════════════════════════════════════════════
// [MISSION MANAGEMENT] 미션 생성 & 달성 처리
// ═══════════════════════════════════════════════
// 미션 흐름: pickNewMission → initMissions → renderMissions
//           merge 후 triggerRemovals 에서 미션 색 region 이 REMOVE_SIZE 이상이면 onMissionComplete
function pickNewMission(excludeColors = []) {
  const pool = level <= 2 ? MISSION_COLORS_LV12 : MISSION_COLORS;
  const available = pool.filter(c => !excludeColors.includes(c));
  if (available.length) return available[Math.floor(Math.random() * available.length)];
  // 풀이 비는 극단적 상황 — 전체 풀에서 선택
  const fallback = MISSION_COLORS.filter(c => !excludeColors.includes(c));
  return fallback[Math.floor(Math.random() * fallback.length)] ?? MISSION_COLORS[0];
}

function initMissions() {
  const c1 = pickNewMission();
  const c2 = pickNewMission([c1]);
  const c3 = pickNewMission([c1, c2]);
  missions = [
    { color: c1, completed: false },
    { color: c2, completed: false },
    { color: c3, completed: false },
  ];
  setSpecialMission();
  missionScore = 0;
  pendingSpecialSpawns = [];
  renderMissions();
}

function enqueueSpecialSpawn() {
  if (currentMode === 'classic') return;
  const color = specialMission?.color ?? randomFrom(SPECIAL_COLORS);
  pendingSpecialSpawns.push(color);
  addLog(`Special queued: ${COLORS[color].name} will spawn next!`, 'merge');
  setSpecialMission();
  renderSpawnQueue();
}

function spawnReviveSpecialBubble() {
  if (currentMode === 'classic') return;
  const color = specialMission?.color ?? randomFrom(SPECIAL_COLORS);
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!COLORS[grid[r][c]]?.special) cells.push([r, c]);
    }
  }
  const [r, c] = randomFrom(cells.length ? cells : [[0, 0]]);
  grid[r][c] = color;
  cellMixMap[r][c] = 1;
  setSpecialMission();
  rebuildRegions();
  renderMissions();
  renderSpawnQueue();
  addLog(`Revive special: ${COLORS[color].name} spawned!`, 'merge');
}

function renderMissions() {
  // 일반 미션 3개
  const el = document.getElementById('mission-slots');
  el.replaceChildren();
  missions.forEach((m) => {
    const slot = document.createElement('div');
    slot.className = 'mission-slot';
    const blob = document.createElement('div');
    blob.className = 'mission-blob' + (m.completed ? ' completed' : '');
    blob.style.background = toCss(m.color);
    blob.title = COLORS[m.color].name;
    const name = document.createElement('div');
    name.className = 'mission-name';
    name.textContent = COLORS[m.color].name;
    slot.appendChild(blob);
    slot.appendChild(name);
    el.appendChild(slot);
  });

  // 다음 예약 스페셜
  const goldEl = document.getElementById('gold-mission-slot');
  goldEl.replaceChildren();
  if (currentMode === 'classic') return;
  const goldSlot = document.createElement('div');
  goldSlot.className = 'mission-slot';
  const goldBlob = document.createElement('div');
  goldBlob.className = 'mission-blob gold-special';
  goldBlob.style.background = toCss(specialMission?.color);
  goldBlob.title = (COLORS[specialMission?.color]?.name ?? '') + ` — queued every ${SPECIAL_READY_INTERVAL} missions`;
  const goldName = document.createElement('div');
  goldName.className = 'mission-name';
  const progress = missionScore % SPECIAL_READY_INTERVAL;
  goldName.textContent = `${COLORS[specialMission?.color]?.name ?? ''} ${progress}/${SPECIAL_READY_INTERVAL}`;
  goldSlot.appendChild(goldBlob);
  goldSlot.appendChild(goldName);
  goldEl.appendChild(goldSlot);
}

function onMissionComplete(color) {
  missionScore++;

  const m = missions.find(m => m.color === color);
  if (m) m.completed = true;

  if (missionScore % SPECIAL_READY_INTERVAL === 0) {
    enqueueSpecialSpawn();
  }
  renderMissions();

  showMissionFlash(color);
  GameManager.onMissionClear();
  addLog(`Mission! ${COLORS[color].name} ×${REMOVE_SIZE} cleared! 🎨`, 'remove');

  scheduleGameTimeout(() => {
    const newColor = pickNewMission([...missions.map(m2 => m2.color)]);
    const idx = missions.findIndex(m2 => m2.color === color);
    if (idx !== -1) missions[idx] = { color: newColor, completed: false };
    addLog(`New mission: make ${COLORS[newColor].name}!`, 'merge');
    renderMissions();
    // 새 미션이 이미 필드에 조건을 만족하는 region이 있을 수 있으므로 즉시 체크
    requestAnimationFrame(() => triggerRemovals());
  }, 1200);
}

function closeTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  tutorialShown = true;
  if (timerWaitingForTutorial && gameStarted && !gameEnded) {
    timerWaitingForTutorial = false;
    GameManager.startTimer();
  }
}

function checkLevelUp() {
  const thresholds = getLevelThresholds();
  const newLevel = thresholds.filter(t => score >= t).length;
  if (newLevel > level) {
    level = newLevel;
    document.getElementById('level').textContent = level;
    const nextThreshold = thresholds[level] ?? null;
    const nextEl = document.getElementById('level-next');
    nextEl.textContent = nextThreshold ? `next: ${nextThreshold.toLocaleString()}` : 'MAX';
    clampExtremeTimer();
    GameManager.updateTimerUi();
    updateModeUi();
    showLevelUpFlash(level);
    const { black } = getLevelSpawnRates();
    addLog(`Level Up! Lv.${level} — ${black[level-1] ?? black.at(-1)}/10 dead spawns 💀`, 'dead');
  }
}

function showLevelUpFlash(lv) {
  const el = document.createElement('div');
  el.className = 'mission-complete-flash';
  el.textContent = `Level ${lv}! 💀`;
  el.style.color = '#f0e8ff';
  el.style.textShadow = '0 0 30px rgba(160,80,220,0.8), 0 4px 20px rgba(0,0,0,0.4)';
  document.body.appendChild(el);
  scheduleGameTimeout(() => el.remove(), 1400);
}

function showMissionFlash(color) {
  const pulse = document.createElement('div');
  pulse.className = 'mission-color-pulse';
  pulse.style.background = `radial-gradient(circle, ${toCss(color, 0.46)} 0%, ${toCss(color, 0.24)} 38%, ${toCss(color, 0)} 72%)`;
  pulse.style.boxShadow = `0 0 46px ${toCss(color, 0.46)}`;

  const el = document.createElement('div');
  el.className = 'mission-complete-flash time-reward';
  el.textContent = currentMode === 'extreme' ? `+${EXTREME_MISSION_TIME_BONUS}s` : 'CLEAR';
  el.style.color = '#fffaf0';
  el.style.textShadow = `0 0 22px ${toCss(color, 0.85)}, 0 4px 20px rgba(0,0,0,0.32)`;

  document.body.appendChild(pulse);
  document.body.appendChild(el);
  scheduleGameTimeout(() => pulse.remove(), 900);
  scheduleGameTimeout(() => el.remove(), 900);
}

function isMissionColor(color) {
  if (COLORS[color]?.special) return false; // 스페셜 버블은 triggerSpecial로만 처리
  return missions.some(m => m.color === color && !m.completed);
}

// ═══════════════════════════════════════════════
// [REMOVAL] 버블 터짐 처리 (애니메이션 큐 기반, 재귀 없음)
// ═══════════════════════════════════════════════
// 흐름: triggerRemovals → burstCells 등록 → scheduleGameTimeout 후 grid 갱신 → 재귀 체크
const REMOVE_SIZE = 5; // ★ 이 크기(칸 수) 이상이면 터짐 — 숫자를 바꾸면 난이도 조절 가능

// ── 레벨 시스템 ─────────────────────────────────────────────────
// 레벨별 점수 임계값 및 스폰 규칙
const EXTREME_LEVEL_THRESHOLDS  = [0, 200, 350, 700, 1100, 1600, 2500, 4000, 6500, 10000];
const CLASSIC_LEVEL_THRESHOLDS  = [0, 120, 250, 500, 900, 1400];
const EXTREME_BLACK_RATES = [0, 1, 1, 2, 3, 3, 4, 4, 5, 6]; // 10스폰당 검은 버블 수
const EXTREME_MIX1_RATES  = [0, 0, 1, 1, 2, 3, 3, 4, 5, 6]; // 10 비검은 스폰당 1차조합색 수
const CLASSIC_BLACK_RATES = [0, 1, 1, 3, 4, 5];
const CLASSIC_MIX1_RATES  = [0, 0, 0, 2, 3, 5];
const MIX1_COLORS = ['G','O','P']; // 레벨 보정으로 강제 스폰되는 1차 조합색
let level = 1;
let spawnCounter = 0;        // 누적 스폰 횟수 (검은 버블 계산용)
let nonBlackSpawnCounter = 0; // 비검은 스폰 횟수 (1차조합색 계산용)
let spawnHistory = [];       // 최근 10개 스폰 기록 [{color, isDead}]

let removalQueue = [];

function getLevelThresholds() {
  return currentMode === 'classic' ? CLASSIC_LEVEL_THRESHOLDS : EXTREME_LEVEL_THRESHOLDS;
}

function getLevelSpawnRates() {
  return currentMode === 'classic'
    ? { black: CLASSIC_BLACK_RATES, mix1: CLASSIC_MIX1_RATES }
    : { black: EXTREME_BLACK_RATES, mix1: EXTREME_MIX1_RATES };
}

function spawnReplacementColor(source = {}) {
  const canUseSpecialSpawn =
    currentMode !== 'classic' &&
    pendingSpecialSpawns.length > 0 &&
    !source.isDead &&
    source.color !== 'Dk';

  if (canUseSpecialSpawn) {
    return { color: pendingSpecialSpawns.shift(), mixCount: 1, isDead: false, isSpecial: true };
  }

  const { black, mix1 } = getLevelSpawnRates();
  const blackPerTen = black[level - 1] ?? black.at(-1);
  const mix1PerFive = mix1[level - 1] ?? mix1.at(-1);
  const blackPos = spawnCounter % 10;
  const spawnDead = blackPos < blackPerTen;

  if (spawnDead) {
    return { color: randomFrom(BASE_COLORS), mixCount: DEAD_THRESHOLD, isDead: true, isSpecial: false };
  }

  const mixPos = nonBlackSpawnCounter % 10;
  nonBlackSpawnCounter++;
  const spawnMix1 = mixPos < mix1PerFive;
  return {
    color: spawnMix1 ? randomFrom(MIX1_COLORS) : randomFrom(BASE_COLORS),
    mixCount: 0,
    isDead: false,
    isSpecial: false,
  };
}

function applyFailSafeSpawn() {
  if (!gameStarted || gameEnded || isAnimating) return false;
  const helper = failSafeSystem.maybeCreateHelper({
    grid,
    cellMixMap,
    missions,
    maxUses: FAIL_SAFE_MAX_USES,
  });
  if (!helper) return false;

  grid[helper.r][helper.c] = helper.color;
  cellMixMap[helper.r][helper.c] = 0;
  spawnCounter++;
  spawnHistory.push({
    color: helper.color,
    isDead: false,
    isSpecial: false,
    seq: spawnCounter,
  });
  if (spawnHistory.length > 10) spawnHistory.shift();

  rebuildRegions();
  renderSpawnQueue();
  appearCells.push({ r: helper.r, c: helper.c, startT: performance.now() });
  addLog(`Lucky ${COLORS[helper.color].name} appeared.`, 'merge');
  startLoop();
  renderFrame();
  return true;
}

function triggerRemovals() {
  if (!gameStarted || gameEnded) return;
  if (!GameManager.isPlaying()) return;
  if (isAnimating) return;

  // REMOVE_SIZE 이상인 미션 region 또는 Mud region 제거
  const toRemove = regions.filter(r =>
    !r.isDead && r.cells.length >= REMOVE_SIZE && (isMissionColor(r.color) || r.color === 'Dk')
  );

  if (!toRemove.length) {
    if (applyFailSafeSpawn()) return;
    renderFrame();
    return;
  }

  isAnimating = true;

  const allBurstCells = [];
  let totalScore = 0;
  const burstSet = new Set();
  const key = (r,c) => `${r},${c}`;
  const completedColors = new Set();

  toRemove.forEach(reg => {
    const isMud = reg.color === 'Dk';
    const multiplier = isMud ? 1 : 2;
    const pts = isMud ? 0 : reg.cells.length * (reg.mixCount + 1) * multiplier;
    totalScore += pts;
    if (!isMud) completedColors.add(reg.color);
    addLog(`${isMud ? 'Cleared' : 'Removed'} ${COLORS[reg.color].name} (×${reg.cells.length}) +${pts}`, 'remove');
    if (pts > 0) showScorePop(reg, pts);

    reg.cells.forEach(([r,c]) => {
      if (burstSet.has(key(r,c))) return;
      burstSet.add(key(r,c));
      allBurstCells.push({r, c, color: reg.color, isDead: false});
    });

    // Dead 버블: 맞닿은 셀만 제거
    for (const [r,c] of reg.cells) {
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=r+dr, nc=c+dc;
        if (nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
        const nb = gridRegion[nr][nc];
        if (!nb || !nb.isDead) continue;
        if (burstSet.has(key(nr,nc))) continue;
        burstSet.add(key(nr,nc));
        allBurstCells.push({r:nr, c:nc, color: nb.color, isDead: true});
      }
    }
  });

  if (allBurstCells.some(b => b.isDead)) {
    addLog(`Dead cells chipped away!`, 'dead');
  }

  score += totalScore;
  document.getElementById('score').textContent = score;
  checkLevelUp();

  // Sort from center outward for wave effect
  const cx = allBurstCells.reduce((s,b)=>s+b.c,0) / allBurstCells.length;
  const cy = allBurstCells.reduce((s,b)=>s+b.r,0) / allBurstCells.length;
  allBurstCells.sort((a,b) =>
    Math.hypot(a.r-cy,a.c-cx) - Math.hypot(b.r-cy,b.c-cx)
  );

  const compactFx = isCompactTouchMode();
  const BURST_DURATION = compactFx ? 260 : 340;
  const STAGGER = compactFx ? 12 : 24;
  const MAX_STAGGER_DELAY = compactFx ? 140 : 260;
  const now = performance.now();

  // Register burst animations
  allBurstCells.forEach((cell, i) => {
    burstCells.push({
      r: cell.r, c: cell.c,
      color: cell.color,
      isDead: cell.isDead,
      startT: now + Math.min(i * STAGGER, MAX_STAGGER_DELAY),
      duration: BURST_DURATION,
    });
  });

  // Spawn particles in small batches so large clears do not create one timer per cell.
  const PARTICLE_BATCH = compactFx ? 10 : 6;
  const particleCells = compactFx && allBurstCells.length > 24
    ? allBurstCells.filter((_, i) => i % 2 === 0)
    : allBurstCells;
  for (let i = 0; i < particleCells.length; i += PARTICLE_BATCH) {
    const batch = particleCells.slice(i, i + PARTICLE_BATCH);
    scheduleGameTimeout(() => {
      batch.forEach(cell => spawnSplatParticles(cell.r, cell.c, cell.color));
    }, Math.min(i * STAGGER, MAX_STAGGER_DELAY) + BURST_DURATION * 0.25);
  }

  // Ripple at centroid midway
  const rippleDelay = Math.min(allBurstCells.length * STAGGER, MAX_STAGGER_DELAY) * 0.45;
  scheduleGameTimeout(() => {
    const [rx, ry] = cellCenter(Math.round(cy), Math.round(cx));
    ripples.push({ x:rx, y:ry, color: toRemove[0].color,
                   startT: performance.now(), maxR: CELL * (compactFx ? 2.4 : 3.2) });
  }, rippleDelay);

  // Commit grid change after animations finish — single guarded timer, no recursion
  const totalDur = Math.min(allBurstCells.length * STAGGER, MAX_STAGGER_DELAY) + BURST_DURATION + 80;
  scheduleGameTimeout(() => {
    // 제거된 셀: 예약 스페셜 → 레벨별 검은 버블 / 1차조합색 / 기본색 순으로 리스폰
    allBurstCells.forEach(({r,c,color,isDead}) => {
      const spawned = spawnReplacementColor({ color, isDead });
      spawnCounter++;
      grid[r][c] = spawned.color;
      cellMixMap[r][c] = spawned.mixCount;

      spawnHistory.push({ color: grid[r][c], isDead: spawned.isDead, isSpecial: spawned.isSpecial, seq: spawnCounter });
      if (spawnHistory.length > 10) spawnHistory.shift();
    });
    renderSpawnQueue();

    rebuildRegions();
    burstCells = [];

    // Appear animation for new cells
    const appearNow = performance.now();
    const APPEAR_STAGGER = compactFx ? 0 : 6;
    const APPEAR_MAX_DELAY = compactFx ? 0 : 90;
    allBurstCells.forEach(({r,c}, i) => {
      appearCells.push({ r, c, startT: appearNow + Math.min(i * APPEAR_STAGGER, APPEAR_MAX_DELAY) });
    });

    isAnimating = false;

    // 미션 완료 처리 (애니메이션 끝난 뒤)
    completedColors.forEach(color => onMissionComplete(color));

    // Check for chain removals
    requestAnimationFrame(() => triggerRemovals());
  }, totalDur);

  startLoop();
}

// ═══════════════════════════════════════════════
// [PARTICLES] 버블 터질 때 파티클 이펙트
// ═══════════════════════════════════════════════
// ★ 파티클 수/크기/속도를 바꾸려면 spawnSplatParticles 내부 상수를 수정하세요.
function spawnSplatParticles(r, c, colorKey) {
  const [x, y] = cellCenter(r, c);
  const [pr, pg, pb] = toRgb(colorKey);
  const compactFx = isCompactTouchMode();
  const count = compactFx ? 4 + Math.floor(Math.random()*3) : 7 + Math.floor(Math.random()*4);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + (Math.random()-0.5) * 0.8;
    const speed = compactFx ? 1.3 + Math.random() * 2.2 : 1.8 + Math.random() * 3.0;
    const size  = compactFx ? 2 + Math.random() * 3 : 2.5 + Math.random() * 4.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: size,
      pr, pg, pb,
      life: 1.0,
      decay: 0.022 + Math.random() * 0.018,
      gravity: 0.08 + Math.random() * 0.06,
    });
  }
  // A few elongated drips
  const dripCount = compactFx ? 0 : 2;
  for (let i = 0; i < dripCount; i++) {
    const angle = Math.PI/2 + (Math.random()-0.5)*1.2;
    const speed = 2 + Math.random()*2;
    particles.push({
      x, y,
      vx: Math.cos(angle)*speed*0.4,
      vy: Math.sin(angle)*speed,
      r: 3 + Math.random()*3,
      pr, pg, pb,
      life: 1.0,
      decay: 0.014 + Math.random()*0.01,
      gravity: 0.12,
      drip: true,
    });
  }
  trimParticles();
}

function trimParticles() {
  const limit = maxParticlesForDevice();
  if (particles.length > limit) {
    particles.splice(0, particles.length - limit);
  }
}

// ═══════════════════════════════════════════════
// [SPECIAL BURST] 스페셜 버블 발동 시 고유 파티클 이펙트
// ═══════════════════════════════════════════════
function spawnSpecialBurst(type, cells) {
  cells.forEach(([r, c]) => {
    const [x, y] = cellCenter(r, c);
    switch (type) {
      case 'Bm': { // BOMB: many fast large orange/red shards in all directions
        const n = 14 + Math.floor(Math.random()*6);
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI*2*i/n) + (Math.random()-0.5)*0.6;
          const spd   = 3.5 + Math.random()*4.5;
          particles.push({ x, y,
            vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
            r: 4 + Math.random()*6, pr:210, pg:60+Math.floor(Math.random()*60), pb:0,
            life:1, decay:0.018+Math.random()*0.012, gravity:0.12+Math.random()*0.06 });
        }
        break;
      }
      case 'Rc': { // RECYCLE: slow green leaves drifting upward
        const n = 10 + Math.floor(Math.random()*4);
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI/2 + (Math.random()-0.5)*1.6;
          const spd   = 1.2 + Math.random()*1.8;
          particles.push({ x, y,
            vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
            r: 3 + Math.random()*4, pr:0, pg:180+Math.floor(Math.random()*60), pb:80,
            life:1, decay:0.012+Math.random()*0.008, gravity:-0.04+Math.random()*0.03 });
        }
        break;
      }
      case 'Gc': { // LUCKY: tiny pink/gold sparkles in all directions
        const n = 16 + Math.floor(Math.random()*8);
        for (let i = 0; i < n; i++) {
          const angle = Math.random()*Math.PI*2;
          const spd   = 1.5 + Math.random()*3.5;
          const warm  = Math.random() > 0.5;
          particles.push({ x, y,
            vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
            r: 1.5+Math.random()*3, pr:warm?255:255, pg:warm?20:210, pb:warm?140:100,
            life:1, decay:0.020+Math.random()*0.018, gravity:0.02+Math.random()*0.04 });
        }
        break;
      }
      case 'Ls': { // LASER: fast horizontal cyan streaks
        const n = 12 + Math.floor(Math.random()*5);
        for (let i = 0; i < n; i++) {
          const dir   = Math.random() > 0.5 ? 1 : -1;
          const spd   = 4 + Math.random()*5;
          particles.push({ x, y,
            vx: dir*(spd+Math.random()*2), vy: (Math.random()-0.5)*1.2,
            r: 2+Math.random()*3.5, pr:0, pg:220+Math.floor(Math.random()*35), pb:255,
            life:1, decay:0.025+Math.random()*0.015, gravity:0.01 });
        }
        break;
      }
      case 'Cl': { // CLEAN: soft light-blue bubbles floating up
        const n = 10 + Math.floor(Math.random()*5);
        for (let i = 0; i < n; i++) {
          const angle = -Math.PI/2 + (Math.random()-0.5)*2.0;
          const spd   = 1.0 + Math.random()*2.2;
          particles.push({ x, y,
            vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
            r: 3+Math.random()*5, pr:160, pg:220+Math.floor(Math.random()*35), pb:255,
            life:1, decay:0.010+Math.random()*0.010, gravity:-0.05+Math.random()*0.04 });
        }
        break;
      }
      case 'Rb': { // RAINBOW: multi-color burst from rainbow palette
        const palette = [[255,50,50],[255,165,0],[255,220,0],[50,220,80],[0,180,255],[160,80,255]];
        const n = 18 + Math.floor(Math.random()*6);
        for (let i = 0; i < n; i++) {
          const angle = (Math.PI*2*i/n) + (Math.random()-0.5)*0.5;
          const spd   = 2.5 + Math.random()*3.5;
          const [pr,pg,pb] = palette[i % palette.length];
          particles.push({ x, y,
            vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
            r: 2.5+Math.random()*4, pr, pg, pb,
            life:1, decay:0.015+Math.random()*0.012, gravity:0.06+Math.random()*0.04 });
        }
        break;
      }
    }
  });
  trimParticles();
}

// ═══════════════════════════════════════════════
// [RAF LOOP] requestAnimationFrame 기반 렌더 루프
// ═══════════════════════════════════════════════
// stillActive 조건이 모두 false 면 루프가 자동 중지되어 CPU를 절약합니다.
function startLoop() {
  if (rafId) return;
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function loop(ts) {
  const dt = Math.min(ts - lastTs, 50); // cap dt
  lastTs = ts;

  updateParticles(dt);
  updateRipples();
  renderAll(ts);

  const stillActive =
    particles.length > 0 ||
    burstCells.length > 0 ||
    ripples.length > 0 ||
    appearCells.length > 0 ||
    specialTriggers.length > 0 ||
    isAnimating;

  if (stillActive) {
    rafId = requestAnimationFrame(loop);
  } else {
    rafId = null;
  }
}

function updateParticles(dt) {
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.97;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateRipples() {
  const now = performance.now();
  for (let i = ripples.length-1; i >= 0; i--) {
    const rip = ripples[i];
    const t = (now - rip.startT) / 600;
    if (t >= 1) ripples.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════
// [RENDERING] 캔버스 렌더링
// ═══════════════════════════════════════════════
// renderAll → drawRipples → drawRegion(각 region) → drawParticles 순서로 그립니다.
function cellCenter(r,c) {
  return [PAD + c*CELL + CELL/2, PAD + r*CELL + CELL/2];
}

// Get burst scale/alpha for a cell at current time
function getBurstState(r, c, now) {
  const b = frameBurstMap?.get(`${r},${c}`) ?? burstCells.find(b => b.r===r && b.c===c);
  if (!b) return null;
  const elapsed = now - b.startT;
  if (elapsed < 0) return { scale: 1, alpha: 1, phase: 'waiting' };
  const t = Math.min(elapsed / b.duration, 1);

  // Phase 1 (0→0.3): pulse up  → scale 1.22, bright
  // Phase 2 (0.3→0.6): hold wobble
  // Phase 3 (0.6→1): shrink to 0, fade
  let scale, alpha;
  if (t < 0.3) {
    const p = t / 0.3;
    scale = 1 + 0.22 * Math.sin(p * Math.PI);
    alpha = 1;
  } else if (t < 0.6) {
    const p = (t - 0.3) / 0.3;
    scale = 1.1 - 0.05 * Math.sin(p * Math.PI * 2);
    alpha = 1;
  } else {
    const p = (t - 0.6) / 0.4;
    scale = 1.05 * (1 - p);
    alpha = 1 - p;
  }
  return { scale: Math.max(0, scale), alpha: Math.max(0, alpha), t, phase: 'bursting' };
}

function getAppearState(r, c, now) {
  const a = frameAppearMap?.get(`${r},${c}`) ?? appearCells.find(a => a.r===r && a.c===c);
  if (!a) return null;
  const t = Math.min((now - a.startT) / (isCompactTouchMode() ? 160 : 220), 1);
  if (t >= 1) {
    appearCells.splice(appearCells.indexOf(a), 1);
    return null;
  }
  const eased = 1 - Math.pow(1 - t, 3);
  return { scale: eased, alpha: Math.min(1, t*4) };
}

function renderAll(now) {
  frameBurstMap = new Map(burstCells.map(b => [`${b.r},${b.c}`, b]));
  frameAppearMap = new Map(appearCells.map(a => [`${a.r},${a.c}`, a]));

  ctx.clearRect(0,0,W,H);

  // Background
  ctx.fillStyle = '#faf7f0';
  ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle = 'rgba(180,165,140,0.2)';
  ctx.lineWidth = 1;
  for (let r=0;r<=ROWS;r++) {
    ctx.beginPath(); ctx.moveTo(PAD, PAD+r*CELL); ctx.lineTo(PAD+COLS*CELL, PAD+r*CELL); ctx.stroke();
  }
  for (let c=0;c<=COLS;c++) {
    ctx.beginPath(); ctx.moveTo(PAD+c*CELL, PAD); ctx.lineTo(PAD+c*CELL, PAD+ROWS*CELL); ctx.stroke();
  }

  // Ripples (behind blobs)
  drawRipples(now);

  // Regions
  const dragRegion  = dragStart ? getRegionAt(dragStart.r, dragStart.c) : null;
  const hoverRegion = (isDragging && hoverCell) ? getRegionAt(hoverCell.r, hoverCell.c) : null;

  const sorted = [...regions].sort((a,b) => {
    if (a===dragRegion) return 1; if (b===dragRegion) return -1; return 0;
  });

  for (const reg of sorted) {
    const isSelected = reg === dragRegion;
    const canMerge   = reg === hoverRegion && hoverRegion !== dragRegion
                        && dragRegion && areRegionsAdjacent(dragRegion, reg)
                        && (
                          !COLORS[dragRegion.color]?.special
                          || canSpecialTarget(dragRegion, reg)
                        )
                        && (
                          !COLORS[reg.color]?.special
                          || canSpecialTarget(reg, dragRegion)
                        );
    drawRegion(reg, isSelected, canMerge, now);
  }
  if (dragRegion) drawRegion(dragRegion, true, false, now);

  // Particles on top
  drawParticles();
  // Special trigger FX (topmost layer)
  drawSpecialTriggers(now);
  frameBurstMap = null;
  frameAppearMap = null;
}

// ═══════════════════════════════════════════════
// [SPECIAL TRIGGER FX] 스페셜 버블 발동 이펙트
// ═══════════════════════════════════════════════
const SPECIAL_TRIGGER_DUR = { Bm:650, Rc:900, Gc:750, Ls:550, Cl:850, Rb:950 };

function spawnSpecialTrigger(type, specialCells, extra = {}) {
  const cx = specialCells.reduce((s,[r,c]) => s + PAD+c*CELL+CELL/2, 0) / specialCells.length;
  const cy = specialCells.reduce((s,[r,c]) => s + PAD+r*CELL+CELL/2, 0) / specialCells.length;
  specialTriggers.push({ type, x:cx, y:cy, startT: performance.now(),
                         duration: SPECIAL_TRIGGER_DUR[type] ?? 700, ...extra });
}

function drawSpecialTriggers(now) {
  specialTriggers = specialTriggers.filter(tr => {
    const elapsed = now - tr.startT;
    const t = Math.min(elapsed / tr.duration, 1);
    if (t >= 1) return false;

    ctx.save();
    const { x, y } = tr;

    switch (tr.type) {

      case 'Bm': { // BOMB — 폭발 충격파 + 플래시
        // 충격파 링 3개 (지연 있음)
        for (let i = 0; i < 3; i++) {
          const d  = i * 0.18;
          const tp = Math.max(0, (t - d) / (1 - d));
          if (tp <= 0) continue;
          const radius = tp * CELL * (4.5 - i * 0.8);
          const alpha  = (1 - tp) * (0.85 - i * 0.2);
          if (alpha <= 0) continue;
          ctx.strokeStyle = `rgba(255,${Math.floor(60 + 80 * (1-tp))},0,${alpha})`;
          ctx.lineWidth   = Math.max(1, 6 * (1 - tp));
          ctx.shadowColor = 'rgba(255,120,0,0.9)'; ctx.shadowBlur = 18;
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.stroke();
        }
        // 중심 섬광
        if (t < 0.38) {
          const ft  = t / 0.38;
          const fa  = Math.sin(ft * Math.PI) * 0.95;
          const fr  = CELL * 2.8 * Math.sin(ft * Math.PI * 0.5);
          const grd = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1,fr));
          grd.addColorStop(0,   `rgba(255,255,220,${fa})`);
          grd.addColorStop(0.45,`rgba(255,140,0,${fa * 0.6})`);
          grd.addColorStop(1,   'rgba(255,60,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(x, y, Math.max(1,fr), 0, Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'Rc': { // RECYCLE — 녹색 파동이 필드 전체로 퍼짐
        const maxR = Math.hypot(W, H);
        // 바깥 퍼지는 파동
        const rOuter = t * maxR;
        ctx.strokeStyle = `rgba(0,220,130,${(1-t)*0.4})`;
        ctx.lineWidth   = Math.max(1, 10 * (1-t));
        ctx.shadowColor = 'rgba(0,255,140,0.7)'; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(x, y, rOuter, 0, Math.PI*2); ctx.stroke();
        // 내부 밝은 링
        if (t < 0.65) {
          const r2  = (t / 0.65) * CELL * 3.5;
          const a2  = (1 - t / 0.65) * 0.75;
          ctx.strokeStyle = `rgba(60,255,170,${a2})`;
          ctx.lineWidth   = 3; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI*2); ctx.stroke();
        }
        // 회전 호 3개
        const rot = t * Math.PI * 5;
        for (let i = 0; i < 3; i++) {
          const a1 = rot + i * (Math.PI*2/3);
          ctx.strokeStyle = `rgba(0,255,150,${(1-t)*0.9})`;
          ctx.lineWidth   = 3; ctx.lineCap = 'round'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(x, y, CELL*(1.2 + t*2.5), a1, a1+0.55); ctx.stroke();
        }
        break;
      }

      case 'Gc': { // LUCKY — 별 방사 + 중앙 핑크 섬광
        if (t < 0.42) {
          const ft  = t / 0.42;
          const fa  = Math.sin(ft * Math.PI) * 0.9;
          const fr  = CELL * 3 * Math.sin(ft * Math.PI * 0.5);
          const grd = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1,fr));
          grd.addColorStop(0,   `rgba(255,255,255,${fa})`);
          grd.addColorStop(0.4, `rgba(255,80,200,${fa*0.7})`);
          grd.addColorStop(1,   'rgba(255,20,140,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(x, y, Math.max(1,fr), 0, Math.PI*2); ctx.fill();
        }
        // 8방향 빔
        for (let i = 0; i < 8; i++) {
          const a   = (i / 8) * Math.PI*2 + t * 0.8;
          const r1  = t * CELL * 0.4;
          const r2  = t * CELL * 4;
          const alp = (1 - t) * 0.95;
          ctx.strokeStyle = `rgba(255,210,255,${alp})`;
          ctx.lineWidth   = 2.5;
          ctx.shadowColor = 'rgba(255,60,210,0.9)'; ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a)*r1, y + Math.sin(a)*r1);
          ctx.lineTo(x + Math.cos(a)*r2, y + Math.sin(a)*r2);
          ctx.stroke();
        }
        // 회전 반짝이
        for (let i = 0; i < 6; i++) {
          const a   = t*Math.PI*4 + i*(Math.PI/3);
          const dist = CELL * (0.8 + t * 2.8);
          const sx  = x + Math.cos(a)*dist, sy = y + Math.sin(a)*dist;
          const sr  = 4 * (1-t);
          const alp = (1-t) * 0.9;
          ctx.strokeStyle = `rgba(255,255,255,${alp})`;
          ctx.lineWidth   = 1.8; ctx.lineCap = 'round'; ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(sx-sr,sy); ctx.lineTo(sx+sr,sy);
          ctx.moveTo(sx,sy-sr); ctx.lineTo(sx,sy+sr);
          ctx.stroke();
        }
        break;
      }

      case 'Ls': { // LASER — 십자 빔 (가로/세로 라인)
        const rows = tr.rows ?? [];
        const cols = tr.cols ?? [];
        const peak = t < 0.25 ? t/0.25 : (1-t)/0.75;
        const beamAlpha = Math.pow(peak, 0.6);
        const beamW     = CELL * 0.55 * peak;
        ctx.shadowColor = `rgba(0,230,255,${beamAlpha})`; ctx.shadowBlur = 18;
        rows.forEach(row => {
          const by  = PAD + row*CELL + CELL/2;
          const grd = ctx.createLinearGradient(PAD, by, PAD+COLS*CELL, by);
          grd.addColorStop(0,   'rgba(0,230,255,0)');
          grd.addColorStop(0.15,`rgba(0,230,255,${beamAlpha})`);
          grd.addColorStop(0.85,`rgba(0,230,255,${beamAlpha})`);
          grd.addColorStop(1,   'rgba(0,230,255,0)');
          ctx.strokeStyle = grd; ctx.lineWidth = Math.max(1, beamW);
          ctx.beginPath(); ctx.moveTo(PAD,by); ctx.lineTo(PAD+COLS*CELL,by); ctx.stroke();
          // 전기 테두리
          ctx.strokeStyle = `rgba(200,255,255,${beamAlpha*0.4})`;
          ctx.lineWidth   = Math.max(0.5, beamW*1.3);
          ctx.beginPath(); ctx.moveTo(PAD,by); ctx.lineTo(PAD+COLS*CELL,by); ctx.stroke();
        });
        cols.forEach(col => {
          const bx  = PAD + col*CELL + CELL/2;
          const grd = ctx.createLinearGradient(bx, PAD, bx, PAD+ROWS*CELL);
          grd.addColorStop(0,   'rgba(0,230,255,0)');
          grd.addColorStop(0.15,`rgba(0,230,255,${beamAlpha})`);
          grd.addColorStop(0.85,`rgba(0,230,255,${beamAlpha})`);
          grd.addColorStop(1,   'rgba(0,230,255,0)');
          ctx.strokeStyle = grd; ctx.lineWidth = Math.max(1, beamW);
          ctx.beginPath(); ctx.moveTo(bx,PAD); ctx.lineTo(bx,PAD+ROWS*CELL); ctx.stroke();
          ctx.strokeStyle = `rgba(200,255,255,${beamAlpha*0.4})`;
          ctx.lineWidth   = Math.max(0.5, beamW*1.3);
          ctx.beginPath(); ctx.moveTo(bx,PAD); ctx.lineTo(bx,PAD+ROWS*CELL); ctx.stroke();
        });
        break;
      }

      case 'Cl': { // CLEAN — 물결 링 4개 연속 퍼짐
        for (let i = 0; i < 4; i++) {
          const d   = i * 0.18;
          const tp  = Math.max(0, (t - d) / (1 - d));
          if (tp <= 0) continue;
          const r   = tp * CELL * 5.5;
          const alp = (1 - tp) * 0.6;
          ctx.strokeStyle = `rgba(190,240,255,${alp})`;
          ctx.lineWidth   = Math.max(0.5, 4 * (1-tp));
          ctx.shadowColor = 'rgba(130,210,255,0.7)'; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
        }
        // 중심 부드러운 섬광
        if (t < 0.35) {
          const ft  = t / 0.35;
          const fa  = Math.sin(ft*Math.PI) * 0.75;
          const fr  = CELL * 2 * ft;
          const grd = ctx.createRadialGradient(x,y,0,x,y,Math.max(1,fr));
          grd.addColorStop(0, `rgba(220,250,255,${fa})`);
          grd.addColorStop(1, 'rgba(130,210,255,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(x,y,Math.max(1,fr),0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'Rb': { // RAINBOW — 무지개 바퀴가 밖으로 퍼짐
        const rot  = t * Math.PI * 4;
        const segs = 12;
        const r    = t * CELL * 5.5;
        for (let i = 0; i < segs; i++) {
          const a1  = rot + (i / segs) * Math.PI*2;
          const a2  = a1 + (Math.PI*2/segs) * 0.72;
          const hue = (i / segs) * 360 + t * 200;
          ctx.strokeStyle = `hsla(${hue},100%,72%,${(1-t)*0.9})`;
          ctx.shadowColor  = `hsla(${hue},100%,60%,0.8)`;
          ctx.shadowBlur   = 16;
          ctx.lineWidth    = Math.max(1, 7*(1-t));
          ctx.lineCap      = 'round';
          ctx.beginPath(); ctx.arc(x, y, r, a1, a2); ctx.stroke();
        }
        // 내부 회전 링
        if (t < 0.5) {
          const r2   = (t/0.5) * CELL * 2;
          const hue2 = t * 360;
          ctx.strokeStyle = `hsla(${hue2},100%,80%,${(1-t/0.5)*0.85})`;
          ctx.lineWidth   = 3; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(x,y,r2,0,Math.PI*2); ctx.stroke();
        }
        break;
      }
    }

    ctx.shadowBlur = 0;
    ctx.restore();
    return true;
  });
}

function drawRipples(now) {
  for (const rip of ripples) {
    const t = Math.min((now - rip.startT) / 600, 1);
    if (t <= 0) continue;
    const radius = t * rip.maxR;
    const alpha  = (1-t) * 0.5;
    const [r0,g0,b0] = toRgb(rip.color);
    ctx.save();
    if (radius > 0) {
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, radius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${r0},${g0},${b0},${alpha})`;
      ctx.lineWidth = Math.max(0.5, 4 * (1-t));
      ctx.stroke();
    }
    const innerR = radius * 0.6;
    if (t < 0.7 && innerR > 0) {
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, innerR, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${r0},${g0},${b0},${alpha*0.5})`;
      ctx.lineWidth = Math.max(0.5, 2 * (1-t));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    const drawR = Math.max(0.5, p.r * p.life);
    ctx.globalAlpha = p.life * 0.92;
    ctx.fillStyle = `rgb(${Math.min(255,p.pr+35)},${Math.min(255,p.pg+30)},${Math.min(255,p.pb+25)})`;
    ctx.beginPath();
    if (p.drip) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle + Math.PI/2);
      ctx.scale(1, 1.8);
      ctx.arc(0, 0, drawR, 0, Math.PI*2);
      ctx.restore();
    } else {
      ctx.arc(p.x, p.y, drawR, 0, Math.PI*2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── 스페셜 버블 타입별 캔버스 이펙트 ─────────────────────────────
function drawSpecialFX(color, now, x, y, blobR) {
  const t = now * 0.001;
  ctx.save();
  // 셀 영역으로 클리핑 — shadow가 인접 버블로 번지는 현상 방지
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.72, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 1;

  switch (color) {
    case 'Bm': { // BOMB — 위험 링 + 회전 스파이크
      const pulse = 0.5 + 0.5 * Math.sin(t * 7);
      // 위험 링
      ctx.strokeStyle = `rgba(255,${Math.floor(60 + 80*pulse)},0,${0.65+0.35*pulse})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255,80,0,0.9)';
      ctx.shadowBlur = 10 + 8*pulse;
      ctx.beginPath();
      ctx.arc(x, y, blobR * 1.38, 0, Math.PI*2);
      ctx.stroke();
      // 4개 회전 스파이크
      const rot = t * 3.5;
      for (let i = 0; i < 4; i++) {
        const a = rot + i * (Math.PI / 2);
        const r1 = blobR * 1.15, r2 = blobR * 1.65;
        ctx.strokeStyle = `rgba(255,220,0,${0.6+0.4*pulse})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,180,0,0.8)'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a)*r1, y + Math.sin(a)*r1);
        ctx.lineTo(x + Math.cos(a)*r2, y + Math.sin(a)*r2);
        ctx.stroke();
      }
      break;
    }
    case 'Rc': { // RECYCLE — 3개 회전 호 (재활용 심볼)
      const rot = t * 1.8;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(0,255,140,0.7)'; ctx.shadowBlur = 10;
      for (let i = 0; i < 3; i++) {
        const a = rot + i * (Math.PI * 2 / 3);
        ctx.strokeStyle = `rgba(0,230,140,0.85)`;
        ctx.beginPath();
        ctx.arc(x, y, blobR * 1.38, a, a + Math.PI * 0.55);
        ctx.stroke();
      }
      break;
    }
    case 'Gc': { // LUCKY — 6개 반짝이 별 궤도
      const rot = t * 2.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = rot + i * (Math.PI / 3);
        const dist = blobR * (1.35 + 0.15 * Math.sin(t * 5 + i * 1.2));
        const sx = x + Math.cos(a) * dist;
        const sy = y + Math.sin(a) * dist;
        const sr = 2.5 + 1.5 * Math.abs(Math.sin(t * 6 + i * 0.9));
        const alpha = 0.5 + 0.5 * Math.sin(t * 4.5 + i * 0.7);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(255,120,220,0.9)'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(sx - sr, sy); ctx.lineTo(sx + sr, sy);
        ctx.moveTo(sx, sy - sr); ctx.lineTo(sx, sy + sr);
        ctx.stroke();
        // 대각
        const sr2 = sr * 0.65;
        ctx.strokeStyle = `rgba(255,255,255,${alpha*0.6})`;
        ctx.beginPath();
        ctx.moveTo(sx-sr2,sy-sr2); ctx.lineTo(sx+sr2,sy+sr2);
        ctx.moveTo(sx+sr2,sy-sr2); ctx.lineTo(sx-sr2,sy+sr2);
        ctx.stroke();
      }
      break;
    }
    case 'Ls': { // LASER — 전기 링 + 스캔 빔
      const rot = t * 5;
      // 재글재글 전기 링 (deterministic jitter; no render-time randomness)
      const segs = 16;
      ctx.strokeStyle = 'rgba(0,230,255,0.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0,200,255,1)'; ctx.shadowBlur = 16;
      ctx.beginPath();
      const jitterPhase = Math.floor(t * 18);
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const jitter = Math.sin(i * 12.9898 + jitterPhase * 4.1414) * blobR * 0.11;
        const r = blobR * 1.4 + jitter;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.stroke();
      // 회전 스캔 빔
      const bx = x + Math.cos(rot) * blobR * 1.7;
      const by = y + Math.sin(rot) * blobR * 1.7;
      const grd = ctx.createLinearGradient(x, y, bx, by);
      grd.addColorStop(0, 'rgba(0,240,255,0.9)');
      grd.addColorStop(1, 'rgba(0,240,255,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(bx,by); ctx.stroke();
      break;
    }
    case 'Cl': { // CLEAN — 밖으로 퍼지는 물결 링 3개
      for (let i = 0; i < 3; i++) {
        const phase = ((t * 0.75 + i * 0.33) % 1);
        const r = blobR * (1.1 + phase * 0.9);
        const alpha = (1 - phase) * 0.7;
        ctx.strokeStyle = `rgba(200,240,255,${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(160,220,255,0.6)'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'Rb': { // RAINBOW — 무지개 호 6개 회전
      const rot = t * 1.2;
      const segs = 6;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < segs; i++) {
        const a1 = rot + (i / segs) * Math.PI * 2;
        const a2 = a1 + (Math.PI * 2 / segs) * 0.7;
        const hue = ((i / segs) * 360 + t * 80) % 360;
        ctx.strokeStyle = `hsla(${hue},100%,72%,0.9)`;
        ctx.shadowColor  = `hsla(${hue},100%,60%,0.8)`;
        ctx.shadowBlur   = 12;
        ctx.beginPath();
        ctx.arc(x, y, blobR * 1.38, a1, a2);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRegion(reg, isSelected, isTarget, now) {
  if (!reg.cells.length) return;
  const [r0,g0,b0] = toRgb(reg.color);
  const BLOB_R = CELL * 0.44;
  const DEAD    = reg.isDead;
  const SPECIAL = !DEAD && (COLORS[reg.color]?.special === true);
  const IS_MISSION = !DEAD && !SPECIAL && isMissionColor(reg.color);
  const IS_READY   = IS_MISSION && reg.cells.length >= REMOVE_SIZE;

  // Collect per-cell overrides from burst/appear animations
  const cellStates = {};
  for (const [r,c] of reg.cells) {
    const burst  = getBurstState(r, c, now);
    const appear = getAppearState(r, c, now);
    cellStates[`${r},${c}`] = { burst, appear };
  }

  // Check if entire region is fully invisible (all bursting out)
  const allGone = reg.cells.every(([r,c]) => {
    const b = cellStates[`${r},${c}`].burst;
    return b && b.scale <= 0;
  });
  if (allGone) return;

  ctx.save();

  if (isSelected) {
    ctx.shadowColor = `rgba(${r0},${g0},${b0},0.6)`;
    ctx.shadowBlur = 18;
  } else if (isTarget) {
    ctx.shadowColor = `rgba(255,220,80,0.7)`;
    ctx.shadowBlur = 16;
  } else if (IS_READY) {
    // 터질 수 있는 미션 region: 밝은 흰빛 펄스 글로우
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    ctx.shadowColor = `rgba(255,255,255,${0.5 + 0.4 * pulse})`;
    ctx.shadowBlur = 18 + 10 * pulse;
  } else if (IS_MISSION) {
    // 미션 색이지만 아직 7칸 미만: 살짝 빛나는 테두리
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
    ctx.shadowColor = `rgba(${r0},${g0},${b0},${0.35 + 0.25 * pulse})`;
    ctx.shadowBlur = 10 + 6 * pulse;
  } else if (SPECIAL) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.shadowColor = `rgba(${r0},${g0},${b0},${0.7 + 0.3 * pulse})`;
    ctx.shadowBlur = 20 + 14 * pulse;
  } else {
    ctx.shadowColor = `rgba(${r0},${g0},${b0},0.18)`;
    ctx.shadowBlur = 8;
  }

  // Connections
  const connDrawn = new Set();
  for (const [r,c] of reg.cells) {
    const stA = cellStates[`${r},${c}`];
    if (stA.burst && stA.burst.alpha < 0.01) continue;

    for (const [dr,dc] of [[0,1],[1,0]]) {
      const nr=r+dr, nc=c+dc;
      if (nr<ROWS&&nc<COLS&&gridRegion[nr][nc]===reg) {
        const key = `${Math.min(r,nr)},${Math.min(c,nc)},${Math.max(r,nr)},${Math.max(c,nc)}`;
        if (connDrawn.has(key)) continue;
        connDrawn.add(key);

        const stB = cellStates[`${nr},${nc}`];
        const alphaA = stA.burst ? stA.burst.alpha : (stA.appear ? stA.appear.alpha : 1);
        const alphaB = stB.burst ? stB.burst.alpha : (stB.appear ? stB.appear.alpha : 1);
        const connAlpha = Math.min(alphaA, alphaB);
        if (connAlpha <= 0.01) continue;

        const scaleA = stA.burst ? stA.burst.scale : (stA.appear ? stA.appear.scale : 1);
        const scaleB = stB.burst ? stB.burst.scale : (stB.appear ? stB.appear.scale : 1);
        const connScale = (scaleA + scaleB) * 0.5;

        const [x1,y1] = cellCenter(r,c);
        const [x2,y2] = cellCenter(nr,nc);

        ctx.globalAlpha = connAlpha;
        ctx.strokeStyle = DEAD ? 'rgba(30,28,40,0.85)' : `rgba(${r0},${g0},${b0},0.92)`;
        const lw = Math.max(0.5, BLOB_R * 1.85 * connScale);
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Blobs per cell
  for (const [r,c] of reg.cells) {
    const [x,y] = cellCenter(r,c);
    const st = cellStates[`${r},${c}`];

    let scale = isSelected ? 1.08 : 1.0;
    let alpha = 1.0;

    if (st.burst) {
      if (st.burst.scale <= 0) continue;
      scale = st.burst.scale * (isSelected ? 1.08 : 1.0);
      alpha = st.burst.alpha;
    } else if (st.appear) {
      scale = st.appear.scale;
      alpha = st.appear.alpha;
    }

    const blobR = Math.max(0.5, BLOB_R * scale);
    if (blobR < 0.5) continue;

    ctx.globalAlpha = alpha;

    // Add extra glow pulse during burst wind-up phase
    if (st.burst && st.burst.t < 0.4) {
      const pulse = Math.sin(st.burst.t / 0.4 * Math.PI);
      ctx.shadowColor = `rgba(${r0},${g0},${b0},${0.8*pulse})`;
      ctx.shadowBlur = 24 * pulse;
    }

    const drawSpecial = SPECIAL && !st.burst?.suppressSpecial;
    const sprite = getBubbleSprite(reg.color, DEAD, drawSpecial);
    const drawSize = sprite.width * scale;
    ctx.drawImage(sprite, x - drawSize/2, y - drawSize/2, drawSize, drawSize);

    // 스페셜 버블 타입별 이펙트 + 라벨
    if (drawSpecial) {
      drawSpecialFX(reg.color, now, x, y, blobR);
      ctx.save();
      ctx.globalAlpha = alpha;
      const label = SPECIAL_LABELS[reg.color] || reg.color;
      ctx.font = `bold ${Math.max(7, blobR * 0.38)}px "DM Mono", monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = `rgba(0,0,0,0.6)`; ctx.shadowBlur = 4;
      ctx.fillText(label, x, y);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // Labels
  const visibleCells = reg.cells.filter(([r,c])=> {
    const st = cellStates[`${r},${c}`];
    const a = st.burst ? st.burst.alpha : (st.appear ? st.appear.alpha : 1);
    return a > 0.5;
  });

  if (visibleCells.length > 0) {
    const avgR = visibleCells.reduce((s,[r])=>s+r,0)/visibleCells.length;
    const avgC = visibleCells.reduce((s,[,c])=>s+c,0)/visibleCells.length;
    const [lx,ly] = cellCenter(Math.round(avgR), Math.round(avgC));

    if (!DEAD && reg.mixCount > 0) {
      ctx.font = `bold 11px "DM Mono", monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4;
      ctx.fillText(`×${reg.mixCount}`, lx, ly);
    }
    if (!DEAD && reg.cells.length >= 3) {
      const offset = reg.mixCount > 0 ? 13 : 0;
      ctx.font = `500 9px "DM Mono", monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.shadowBlur = 3;
      ctx.fillText(`${reg.cells.length}`, lx, ly+offset);
    }
  }

  // Target ring
  if (isTarget) {
    for (const [r,c] of reg.cells) {
      const [x,y] = cellCenter(r,c);
      ctx.strokeStyle = 'rgba(255,220,60,0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255,200,0,0.6)'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, BLOB_R*1.12, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════
// [INPUT] 마우스 이벤트 처리
// ═══════════════════════════════════════════════
// 드래그 흐름: mousedown(dragStart 기록) → mousemove(hoverCell 갱신) → mouseup(doMerge 호출)
function renderFrame() {
  renderAll(performance.now());
}

function getCell(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top)  * (H / rect.height);
  const c = Math.floor((sx - PAD) / CELL);
  const r = Math.floor((sy - PAD) / CELL);
  if (r<0||r>=ROWS||c<0||c>=COLS) return null;
  return {r,c};
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function getForgivingTouchCell(e) {
  const exactCell = getCell(e);
  if (!dragStart?.region) return exactCell;

  const regA = dragStart.region;
  const point = getCanvasPoint(e);
  const intentOrigin = touchStartPoint ?? point;
  const intentDist = Math.hypot(point.x - intentOrigin.x, point.y - intentOrigin.y);
  const intentThreshold = CELL * 0.34;

  if (intentDist < intentThreshold) return exactCell;
  touchDragActivated = true;

  const exactReg = exactCell ? getRegionAt(exactCell.r, exactCell.c) : null;
  if (exactReg && exactReg !== regA && areRegionsAdjacent(regA, exactReg)) return exactCell;

  const [startX, startY] = cellCenter(dragStart.r, dragStart.c);
  const dragDist = Math.hypot(point.x - startX, point.y - startY);
  if (dragDist < CELL * 0.28) return exactCell;

  const dx = point.x - intentOrigin.x;
  const dy = point.y - intentOrigin.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.26) return exactCell;
  const primaryDir = Math.abs(dx) >= Math.abs(dy)
    ? [0, dx >= 0 ? 1 : -1]
    : [dy >= 0 ? 1 : -1, 0];
  const secondaryDirs = primaryDir[0] === 0
    ? [[dy >= 0 ? 1 : -1, 0], [dy >= 0 ? -1 : 1, 0]]
    : [[0, dx >= 0 ? 1 : -1], [0, dx >= 0 ? -1 : 1]];
  const dirs = [primaryDir, ...secondaryDirs];

  for (const [dirR, dirC] of dirs) {
    let bestDirectional = null;
    let bestDirectionalScore = Infinity;
    const seenDirectional = new Set();
    for (const [r, c] of regA.cells) {
      const nr = r + dirR, nc = c + dirC;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const candidateReg = gridRegion[nr][nc];
      if (!candidateReg || candidateReg === regA || seenDirectional.has(candidateReg.id)) continue;
      seenDirectional.add(candidateReg.id);

      const [cx, cy] = cellCenter(nr, nc);
      const perpendicular = dirR === 0 ? Math.abs(point.y - cy) : Math.abs(point.x - cx);
      const forward = dirR === 0
        ? Math.max(0, Math.abs(cx - point.x) - CELL * 0.35)
        : Math.max(0, Math.abs(cy - point.y) - CELL * 0.35);
      const score = perpendicular + forward * 0.35;
      if (score < bestDirectionalScore) {
        bestDirectionalScore = score;
        bestDirectional = { r: nr, c: nc };
      }
    }
    if (bestDirectional && bestDirectionalScore <= CELL * 0.95) return bestDirectional;
  }

  let best = null;
  let bestDist = Infinity;
  const seen = new Set();
  for (const [r, c] of regA.cells) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const candidateReg = gridRegion[nr][nc];
      if (!candidateReg || candidateReg === regA || seen.has(candidateReg.id)) continue;
      seen.add(candidateReg.id);
      const [cx, cy] = cellCenter(nr, nc);
      const dist = Math.hypot(point.x - cx, point.y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { r: nr, c: nc };
      }
    }
  }

  return bestDist <= CELL * 1.65 ? best : exactCell;
}

canvas.addEventListener('mousedown', e => {
  if (!gameStarted || gameEnded) return;
  if (!GameManager.isPlaying()) return;
  if (isAnimating) return;
  const cell = getCell(e);
  if (!cell) return;
  isDragging = true;
  dragStart = { ...cell, region: getRegionAt(cell.r, cell.c) };
  hoverCell = cell;
  renderFrame();
});

canvas.addEventListener('mousemove', e => {
  const cell = getCell(e);
  if (cell) { hoverCell = cell; updateTooltip(e, cell); }
  else       { hoverCell = null; hideTooltip(); }
  if (isDragging) renderFrame();
});

canvas.addEventListener('mouseup', e => {
  if (!isDragging) return;
  isDragging = false;
  const cell = getCell(e);
  if (cell && dragStart) {
    const regA = dragStart.region;
    const regB = getRegionAt(cell.r, cell.c);
    if (regA && regB && regA !== regB && areRegionsAdjacent(regA, regB)) {
      doMerge(regA, regB);
    }
  }
  dragStart = null;
  renderFrame();
});

document.addEventListener('mouseup', () => {
  if (isDragging) { isDragging = false; dragStart = null; renderFrame(); }
});

canvas.addEventListener('mouseleave', () => {
  if (!isDragging) {
    hoverCell = null;
    hideTooltip();
    renderFrame();
  }
});

// ── 터치 이벤트 (모바일) ─────────────────────────────────────────
function getTouchPos(touch) {
  return { clientX: touch.clientX, clientY: touch.clientY };
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!gameStarted || gameEnded) return;
  if (!GameManager.isPlaying()) return;
  if (isAnimating) return;
  const cell = getCell(getTouchPos(e.touches[0]));
  if (!cell) return;
  isDragging = true;
  dragStart = { ...cell, region: getRegionAt(cell.r, cell.c) };
  touchStartPoint = getCanvasPoint(getTouchPos(e.touches[0]));
  touchDragActivated = false;
  hoverCell = cell;
  renderFrame();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!e.touches.length) return;
  const cell = getForgivingTouchCell(getTouchPos(e.touches[0]));
  hoverCell = cell ?? null;
  if (isDragging) renderFrame();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!isDragging) return;
  isDragging = false;
  const cell = e.changedTouches.length ? getForgivingTouchCell(getTouchPos(e.changedTouches[0])) : null;
  if (cell && dragStart && touchDragActivated) {
    const regA = dragStart.region;
    const regB = getRegionAt(cell.r, cell.c);
    if (regA && regB && regA !== regB && areRegionsAdjacent(regA, regB)) {
      doMerge(regA, regB);
    }
  }
  dragStart = null;
  touchStartPoint = null;
  touchDragActivated = false;
  hoverCell = null;
  renderFrame();
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  e.preventDefault();
  isDragging = false;
  dragStart = null;
  touchStartPoint = null;
  touchDragActivated = false;
  hoverCell = null;
  renderFrame();
}, { passive: false });

// Tooltip
function updateTooltip(e, cell) {
  const reg = getRegionAt(cell.r, cell.c);
  if (!reg) return;
  const t = document.getElementById('tooltip');
  const status = reg.isDead ? '💀 Dead' : `mix×${reg.mixCount}`;
  t.textContent = `${COLORS[reg.color].name} · size ${reg.cells.length} · ${status}`;
  t.style.left = (e.clientX+14)+'px';
  t.style.top  = (e.clientY-10)+'px';
  t.classList.add('show');
}
function hideTooltip() { document.getElementById('tooltip').classList.remove('show'); }

// ═══════════════════════════════════════════════
// [SCORE POP] 점수 획득 시 화면에 플로팅 숫자 표시
// ═══════════════════════════════════════════════
function showScorePop(reg, pts) {
  if (!reg.cells.length) return;
  const [r,c] = reg.cells[Math.floor(reg.cells.length/2)];
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / W;
  const [cx,cy] = cellCenter(r,c);
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = `+${pts}`;
  el.style.color = toCss(reg.color);
  el.style.left = (rect.left + cx*scale - 20) + 'px';
  el.style.top  = (rect.top  + cy*scale - 10) + 'px';
  document.body.appendChild(el);
  scheduleGameTimeout(()=>el.remove(), 900);
}

// ═══════════════════════════════════════════════
// [LOG] 사이드바 로그 메시지 추가
// ═══════════════════════════════════════════════
// type: 'merge' | 'remove' | 'dead'  → CSS 색상 구분
function renderSpawnQueue() {
  const el = document.getElementById('spawn-queue');
  if (!el) return;
  el.replaceChildren();
  const visibleQueue = currentMode === 'classic'
    ? spawnHistory.slice(0, 10)
    : [
        ...pendingSpecialSpawns.map(color => ({ color, isDead:false, isSpecial:true, seq:'NEXT' })),
        ...spawnHistory
      ].slice(0, 10);

  for (let i = 0; i < 10; i++) {
    const slot = document.createElement('div');
    slot.className = 'sq-slot';

    const bubble = document.createElement('div');
    bubble.className = 'sq-bubble';

    const num = document.createElement('div');
    num.className = 'sq-num';

    if (i < visibleQueue.length) {
      const item = visibleQueue[i];
      if (item.isDead) {
        bubble.classList.add('dead');
      } else {
        bubble.style.background = toCss(item.color);
      }
      if (item.isSpecial) bubble.classList.add('special');
      // 전역 생성 순번을 버블 안에 표시
      num.textContent = item.seq;
    } else {
      bubble.classList.add('empty');
      num.textContent = '';
    }

    slot.appendChild(bubble);
    slot.appendChild(num);
    el.appendChild(slot);
  }
}

function addLog(msg, type='merge') {
  const log = document.getElementById('log');
  const el = document.createElement('div');
  el.className = `log-line ${type}`;
  el.textContent = msg;
  log.insertBefore(el, log.firstChild);
  while (log.children.length > 15) log.removeChild(log.lastChild);
}

// ═══════════════════════════════════════════════
// [MIX TABLE] 사이드바 혼합 가이드 표 생성
// ═══════════════════════════════════════════════
// ★ 표시할 조합 목록을 바꾸려면 아래 shown 배열을 수정하세요.
//   [재료A, 재료B, 결과] 형식입니다.
function buildMixTable() {
  const el = document.getElementById('mix-table');
  const missionEl = document.getElementById('mission-recipe-list');
  el.replaceChildren();
  missionEl?.replaceChildren();

  MIX_GUIDE_RECIPES.forEach(([a,b,res])=>{
    const row = document.createElement('div');
    row.className='mix-row';
    row.append(
      createMixSide([a, b]),
      createMixArrow('->'),
      createMixSide([res], true),
    );
    el.appendChild(row);
  });

  if (missionEl) renderCompactRecipePreview(missionEl);
}

function createDot(color) {
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = toCss(color);
  dot.title = COLORS[color].name;
  return dot;
}

function createMixArrow(text) {
  const arrow = document.createElement('span');
  arrow.className = 'mix-arrow';
  arrow.textContent = text;
  return arrow;
}

function createMixSide(colors, result = false) {
  const side = document.createElement('span');
  side.className = `mix-side${result ? ' result' : ''}`;
  colors.forEach((color, index) => {
    if (index > 0) side.appendChild(createMixArrow('+'));
    side.appendChild(createDot(color));
    const name = document.createElement('span');
    name.className = 'mix-name';
    name.textContent = result ? COLORS[color].name : color;
    side.appendChild(name);
  });
  return side;
}

function createRecipeResultChip(color) {
  const chip = document.createElement('span');
  chip.className = 'recipe-result-chip';
  chip.append(createDot(color), document.createTextNode(COLORS[color].name));
  return chip;
}

function renderCompactRecipePreview(el) {
  el.replaceChildren();
  MIX_GUIDE_RECIPES.slice(0, 3).forEach(([a, b, res]) => {
    const mini = document.createElement('span');
    mini.className = 'mini-recipe';
    mini.append(
      createDot(a),
      createMixArrow('+'),
      createDot(b),
      createMixArrow('->'),
      createRecipeResultChip(res),
    );
    el.appendChild(mini);
  });
}

function createRecipeRow(a, b, res) {
  const row = document.createElement('div');
  row.className = 'recipe-guide-row';
  row.append(
    createRecipeResultChip(a),
    createMixArrow('+'),
    createRecipeResultChip(b),
    createMixArrow('->'),
    createRecipeResultChip(res),
  );
  return row;
}

function renderRecipeGuide(container) {
  container.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'recipe-guide-grid';
  MIX_GUIDE_RECIPES.forEach(([a, b, res]) => {
    grid.appendChild(createRecipeRow(a, b, res));
  });
  container.appendChild(grid);
}

function renderSpecialGuide(container) {
  container.replaceChildren();
  if (currentMode !== 'extreme') {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const title = document.createElement('div');
  title.className = 'special-guide-title';
  title.textContent = 'Special Bubble';
  const list = document.createElement('div');
  list.className = 'special-guide-list';

  SPECIAL_COLORS.forEach(color => {
    const item = document.createElement('div');
    item.className = 'special-guide-item';
    const bubble = createDot(color);
    bubble.classList.add('special-guide-dot');
    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = COLORS[color].name;
    const desc = document.createElement('span');
    desc.textContent = SPECIAL_GUIDE[color];
    text.append(name, desc);
    item.append(bubble, text);
    list.appendChild(item);
  });

  container.append(title, list);
}

function showRecipePopover() {
  const popover = document.getElementById('recipe-popover');
  const title = document.getElementById('recipe-popover-title');
  const formula = document.getElementById('recipe-popover-formula');
  const specialGuide = document.getElementById('special-popover-guide');

  title.textContent = 'Color Recipe';
  renderRecipeGuide(formula);
  renderSpecialGuide(specialGuide);
  popover.classList.remove('hidden');
}

function hideRecipePopover() {
  document.getElementById('recipe-popover')?.classList.add('hidden');
}

document.getElementById('recipe-popover')?.addEventListener('click', event => {
  if (event.target.id === 'recipe-popover') hideRecipePopover();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideRecipePopover();
});

// ═══════════════════════════════════════════════
// [INIT] 게임 초기화 — New Game 버튼 & 최초 로드 시 호출
// ═══════════════════════════════════════════════
function initGame(mode = currentMode) {
  if (!isValidMode(mode)) {
    logSecurityEvent('invalid_init_mode', { mode });
    mode = 'extreme';
  }
  currentMode = mode;
  gameRunId++;
  clearGameTimers();
  stopLoop();
  GameManager.reset(currentMode);
  gameStarted = true;
  gameEnded = false;
  timerWaitingForTutorial = false;
  _rid = 0;
  score = 0; mergeCount = 0; level = 1; spawnCounter = 0; nonBlackSpawnCounter = 0;
  dragStart = null; hoverCell = null;
  isDragging = false; isAnimating = false;
  burstCells = []; particles = []; ripples = []; appearCells = []; specialTriggers = [];

  document.getElementById('score').textContent = '0';
  document.getElementById('merges').textContent = '0';
  document.getElementById('level').textContent = '1';
  document.getElementById('level-next').textContent = `next: ${getLevelThresholds()[1].toLocaleString()}`;
  document.getElementById('log').replaceChildren();
  document.getElementById('ad-offer').classList.add('hidden');
  document.getElementById('result-screen').classList.add('hidden');
  spawnHistory = [];
  pendingSpecialSpawns = [];
  failSafeSystem.reset();
  renderSpawnQueue();
  updateModeUi();

  // ── 그리드 초기화 ─────────────────────────────
  // 목표:
  //   1. 인접 셀끼리 같은 색이 되어 자연 발생하는 묶음 최대 2칸
  //   2. 처음부터 3칸 이상 연결되는 묶음 없음
  //   3. 3원색(R,Y,B)만 사용

  grid = Array.from({length:ROWS}, ()=> Array(COLS).fill(null));
  cellMixMap = Array.from({length:ROWS}, ()=> Array(COLS).fill(0));

  // 셀별로 허용 색상을 좁혀서 배치
  // "이미 2개 연결된 방향이면 그 색 금지" 규칙 적용
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      // 인접한 이미 배치된 셀들을 확인
      const forbidden = new Set();

      for (const [dr,dc] of [[-1,0],[0,-1],[-1,-1],[-1,1]]) {
        const nr=r+dr, nc=c+dc;
        if (nr<0||nc<0||nr>=ROWS||nc>=COLS||grid[nr][nc]===null) continue;
        const neighborColor = grid[nr][nc];

        // 이 이웃이 이미 같은 색으로 연결된 셀을 하나라도 가지고 있으면 그 색 금지
        // (즉, 이웃의 이웃 중 같은 색 있으면 이 셀에서 쓰면 3연결됨)
        let neighborHasSameColorNeighbor = false;
        for (const [dr2,dc2] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr2=nr+dr2, nc2=nc+dc2;
          if (nr2===r&&nc2===c) continue; // 현재 셀 제외
          if (nr2<0||nc2<0||nr2>=ROWS||nc2>=COLS||grid[nr2][nc2]===null) continue;
          if (grid[nr2][nc2] === neighborColor) {
            neighborHasSameColorNeighbor = true;
            break;
          }
        }
        if (neighborHasSameColorNeighbor) {
          forbidden.add(neighborColor);
        }
      }

      // 직접 인접한 상·좌 셀과 동일한 색도 추가로 체크해서
      // 같은 색 인접 2개 이상이면 forbidden
      const adjColors = {};
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=r+dr, nc=c+dc;
        if (nr<0||nc<0||nr>=ROWS||nc>=COLS||grid[nr][nc]===null) continue;
        const col = grid[nr][nc];
        adjColors[col] = (adjColors[col]||0)+1;
        // 이미 인접한 같은 색이 2개 이상이면 그 색 절대 금지
        if (adjColors[col] >= 2) forbidden.add(col);
      }

      const allowed = INIT_COLORS.filter(c => !forbidden.has(c));
      // 모든 색이 금지된 경우(매우 드문 코너케이스) 전체 허용
      grid[r][c] = randomFrom(allowed.length > 0 ? allowed : INIT_COLORS);
    }
  }

  rebuildRegions();

  // 안전장치: 혹시라도 3칸 이상 region이 있으면 깨뜨림
  let safetyPass = 0;
  while (safetyPass < 5) {
    const large = regions.filter(reg => reg.cells.length >= 3);
    if (!large.length) break;
    large.forEach(reg => {
      reg.cells.slice(2).forEach(([r,c]) => {
        const adjCol = grid[r-1]?.[c] || grid[r]?.[c-1] || '';
        const other = INIT_COLORS.filter(x => x !== reg.color && x !== adjCol);
        grid[r][c] = randomFrom(other.length ? other : INIT_COLORS);
        cellMixMap[r][c] = 0;
      });
    });
    rebuildRegions();
    safetyPass++;
  }

  initMissions();
  buildMixTable();
  renderFrame();
  addLog('New game started!', 'merge');
  if (currentMode === 'classic') {
    addLog(`Classic: ${CLASSIC_TIME_LIMIT} seconds. No special bubbles.`, 'dead');
    timerWaitingForTutorial = true;
  } else {
    addLog(`Extreme: ${EXTREME_TIME_LIMIT} seconds. Missions add +${EXTREME_MISSION_TIME_BONUS}s.`, 'dead');
    timerWaitingForTutorial = true;
  }
  requestAnimationFrame(() => triggerRemovals());
  startScoreSession(currentMode);

  document.getElementById('tutorial-overlay').classList.remove('hidden');
}

setupUiActions();
syncMobileMode();
window.addEventListener('resize', syncMobileMode);
window.addEventListener('orientationchange', syncMobileMode);
AdManager?.initAds();
buildMixTable();
renderSpawnQueue();
updateModeUi();
