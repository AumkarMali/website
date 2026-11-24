// Line-by-line port of Bullet_dodge.py (pygame, 800x600, 60 FPS).
// One call to step() is one pass of the Python `while not crashed:` loop.
// Variable names, statement order and quirks are kept as in the Python code, except
// shooting: the original fires one lower and one upper bullet per game; here every F
// press fires a new bullet, alternating lower and upper, with no limit, and holding F
// keeps firing every FIRE_EVERY frames. A bullet that hits something disappears, and the
// loaded bullets beside the player are only drawn. Arrow keys: the original stops both axes
// whenever any arrow is released; here each axis follows the arrows still held (the most
// recently pressed one wins), so releasing one arrow never stops another that is held.
// Sniper bullets move 30% slower (SNIPER_SPEED).
// T is the ultimate: a 2 s windup, then time stops for 10 s. Everything freezes except the
// player who used it, who can still move, shoot and take power-ups.
//
// pygame behaviour reproduced here:
// - pygame.draw.rect truncates float coordinates to int and returns the rect
//   clipped to the screen; if nothing is drawn it returns a 0x0 rect at the
//   given position. Collisions use these returned rects.
// - Rect.colliderect is false for zero-sized rects.
// - Python round() rounds halves to even.
// - The frame is drawn off-screen and shown at pygame.display.update().

export const WIDTH = 800;
export const HEIGHT = 600;
export const FPS = 60;
const FIRE_EVERY = 9; // frames between shots while F is held: 0.15 s at 60 FPS
const KICK_FRAMES = 8; // loaded-bullet recoil animation after each shot
const KICK_DIST = 7; // px the loaded bullets jump back
const SNIPER_SPEED = 0.7; // sniper bullets move 30% slower than in the original
// Power-up: every time any player reaches a multiple of 50 points, a random icon appears at
// a random spot: 10 s of 2x speed, 10 s of 2x fire rate, 10 s of half-speed enemy bullets,
// or an extra life (up to MAX_LIVES).
// Icons stay on the field until someone picks them up or the 50 s lifetime runs out.
const POWERUP_EVERY = 50;
const POWERUP_STEP = 10; // score granularity; D4C drops an icon every step instead of every 5
const POWERUP_FRAMES = 50 * 60; // icon disappears after 50 s if nobody picks it up
const POWERUP_SIZE = 30;
const BOOST_FRAMES = 10 * 60;
const BOOST = 2;
const POWERUP_TYPES = ['speed', 'fire', 'life', 'slow'];
const MAX_LIVES = 3;
export const SLOW_FRAMES = 10 * 60; // enemy-bullet slow power-up lasts 10 s
// Ultimate, "the world": pressing T starts the clip and a 2 s windup while the game still
// runs; after that time stops for 10 s. Enemy bullets, the level clock, power-up timers and
// every other player freeze; the player who used it can still move, shoot and pick up icons.
// 30 s cooldown, and it can't be used in the first 10 s of the game.
export const ULT_FRAMES = 10 * 60;
export const ULT_WINDUP_FRAMES = 2 * 60;
export const KING_FRAMES = 10 * 60; // King Crimson: 10 s of 25% world speed
export const KING_WINDUP_FRAMES = 110; // ~1.83 s: the effect starts 1.3 s into the scream
const KING_FX_FRAMES = 60; // ripple runs for 1 s, then the red shade takes over
export const KILLER_FRAMES = 10 * 60; // Killer Queen: 10 s of blast-radius shots
const KILLER_RADIUS = 140; // px destroyed around each shot hit
export const D4C_FRAMES = 10 * 60; // D4C: 10 s where enemy bullets never aim at you
const D4C_COOLDOWN = 20 * 60; // D4C's reuse gap is 20 s instead of the usual 30 s
export const CMOON_FRAMES = 10 * 60; // C-Moon: 10 s of bullet gravity + absorption
const CMOON_ACCEL = 0.16; // px/frame^2 enemy bullets accelerate toward a C-Moon user
const CMOON_MAX_SPEED = 6; // cap on the gravity velocity so they don't orbit wildly
const CMOON_BOOST = 1.25; // C-Moon users move 25% faster while the buff is active
export const ULT_MIN_TIMER = 12; // s.timer gains 1.2 per second, so 12 ≈ 10 s of play
const SLOW = 0.25; // everything but the King Crimson user runs at 25% speed
const ULT_AUDIO_FRAMES = 307; // the clip is ~5.1 s
const ULT_FX_DELAY_FRAMES = 90; // the ripple starts 1.5 s after the clip starts
const ULT_FX_CUT_FRAMES = 18; // the ripple stops 0.3 s before the clip ends
const ULT_FX_FRAMES = ULT_AUDIO_FRAMES - ULT_FX_DELAY_FRAMES - ULT_FX_CUT_FRAMES;
const ULT_COOLDOWN = 30 * 60;
// Once anyone passes this score every ultimate, player and helper alike, comes back 5 s sooner.
export const ULT_RUSH_SCORE = 500;
const ULT_RUSH_CUT = 5 * 60;
const ultCooldownFor = (type, rush) =>
  (type === 'd4c' ? D4C_COOLDOWN : ULT_COOLDOWN) - (rush ? ULT_RUSH_CUT : 0);
// After a hit or recoil the normal speed limit applies for KNOCK_FRAMES, so a speed boost
// can't throw you twice as far. Shooting a yellow bullet pushes back half as hard.
const KNOCK_FRAMES = 15;
const RECOIL_CAP = 7 / 2;

const NAMED = {
  grey12: 'rgb(31,31,31)',
  white: 'rgb(255,255,255)',
  yellow: 'rgb(255,255,0)',
  red: 'rgb(255,0,0)',
};
const css = (c) => (typeof c === 'string' ? NAMED[c] : `rgb(${c[0]},${c[1]},${c[2]})`);

const orange = [247, 113, 64];
const green = [161, 235, 52];
const peach = [245, 158, 66];
const red = [255, 0, 0];
const grey12 = 'grey12';
const air_color = [195, 196, 181];
const max_speed = 7;

// pygame.font.SysFont fallbacks: 'MS Sans Serif' and 'CourierBold' are not
// installed TrueType fonts, so pygame uses its default font (freesansbold)
// at int(size * 0.6875).
const FONTS = {
  score: '30px "Times New Roman", Times, serif',
  lives: 'bold 26px "FreeSans", Arial, Helvetica, sans-serif',
  bullets: '20px Verdana, Geneva, sans-serif',
  intro: '37px "Comic Sans MS", "Comic Sans", cursive',
  end: 'bold 68px "FreeSans", Arial, Helvetica, sans-serif',
};

// Python round(): half to even.
export const pyRound = (v) => {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return Math.abs(f % 2) === 0 ? f : f + 1;
};

export const mathRandomRng = {
  randrange: (a, b) => a + Math.floor(Math.random() * (b - a)),
  randint: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
};

export function createState(ultType = 'world') {
  return {
    player_color: [0, 120, 250],
    ultType, // 'world' (time stop) or 'king' (slowed random future)
    baseUltType: ultType, // the picked ult (kept for ghost display / identity)
    score: 0,
    lives: 3,
    x: 400,
    y: 220,
    x_change: 0,
    accel_x: 0,
    accel_y: 0,
    y_change: 0,
    // bullet 1
    x_enemy: 0,
    rand: -19.9,
    color: 'grey12',
    enemy_accel: 3.6,
    // bullet2
    x_enemy2: -25,
    x_enemy21: 500,
    rand2: 599.99,
    rand21: 599.99,
    color2: 'grey12',
    color21: 'grey12',
    enemy_accel2: 2.5,
    // bullet3
    x_enemy3: -20,
    rand3: 0,
    color3: 'grey12',
    enemy_accel3: 15,
    timer: 0,
    color4: 'grey12',
    x_warn: -28,
    Warn_goto: -24,
    bulletH: 20,
    bulletW: 40,
    count: 0,
    end_timer: 0,
    cont: true,
    final_score: 'GAME OVER',
    bullet_types: 'Bullets: Normal',
    death: 3,
    remoteKO: false, // the game ended because another player died (King Crimson may erase it)
    shots: [], // fired bullets: {x, y, lower}
    nextLower: true, // barrel for the next shot
    fHeld: false,
    arrows: { left: 0, right: 0, up: 0, down: 0 }, // press order of held arrows, 0 = up
    arrowSeq: 0,
    fireTimer: 0, // frames until the next held-F shot
    kickLower: 0, // frames of lower-barrel recoil left
    kickUpper: 0, // frames of upper-barrel recoil left
    powerupLevel: 0, // last 10-point score step already processed for drops
    powerups: [], // { id, x, y, ttl, type } icons lying on the map
    explosions: [], // { x, y, ttl } yellow bursts when a shot destroys an enemy bullet
    timeStop: 0, // frames of stopped time left (ultimate)
    timeStopBy: null, // id of the player who stopped time; null = local player
    ultWindup: 0, // frames of windup left before time actually stops
    ultAnim: 0, // frames since the ultimate started, for the ripple animation
    ultActivePrev: false, // last frame's ult state, so the clip/BGM trigger once
    ultCooldown: 0, // frames until the ultimate can be used again
    slow: 0, // frames of King Crimson's 25% world speed left
    slowBy: null, // id of the player who used King Crimson
    kingWindup: 0, // frames of the King Crimson scream before the slow starts
    slowAnim: 0, // frames since King Crimson's slow started, for its ripple
    killerBuffs: [], // [{ id, frames }] players with Killer Queen's blast shots active
    d4cBuffs: [], // [{ id, frames }] players protected by D4C
    cMoonBuffs: [], // [{ id, frames }] players pulling and absorbing bullets with C-Moon
    allies: [], // AI helpers summoned by Silver Chariot (host-simulated, shared)
    ultRush: false, // someone passed ULT_RUSH_SCORE: every ultimate recharges 5 s faster
    gv1x: 0, gv1y: 0, // C-Moon gravity velocity added to each enemy bullet
    gv2x: 0, gv2y: 0,
    gv21x: 0, gv21y: 0,
    gv3x: 0, gv3y: 0,
    d4cAnim: 0, // frames of D4C's orbit animation
    eraseSeq: 0, // bumps when King Crimson erases time, so guests roll back too
    seenEraseSeq: 0, // last eraseSeq this client restored from
    slowPrev: 0, // last frame's slow, so the snapshot is dropped when the slow ends
    aiDX: 0, // King Crimson: random walking direction for non-ult players
    aiDY: 0,
    aiTimer: 0,
    aiPause: 0,
    aiPrev: false, // were we on autopilot last frame?
    speedBoost: 0, // frames of 2x speed left
    fireBoost: 0, // frames of 2x fire rate left
    bulletSlow: 0, // frames of half-speed enemy bullets left (shared power-up)
    knock: 0, // frames of knockback speed limit left
    knockCap: 7,
    firedThisFrame: false,
    fade_in: 0,
    movement_y: 0,
    movement_x: 0,
    intro_timer: 0,
    count_init: 0,
    new_x: 0, // loaded bullets, drawn beside the player
    new_y: 0,
    new_x2: 0,
    new_y2: 0,
    fast: 0,
    hits: false,
    exited: false, // sys.exit() was reached
  };
}

// ---- Shared game (multiplayer) ----
// Everything about the enemy bullets and the level clock; lives, score and the player's
// own block stay per player.
export const WORLD_KEYS = [
  'x_enemy', 'rand', 'color', 'enemy_accel', 'bulletW', 'bulletH',
  'x_enemy2', 'rand2', 'x_enemy21', 'rand21', 'color2', 'color21', 'enemy_accel2',
  'x_enemy3', 'rand3', 'color3', 'enemy_accel3', 'color4', 'x_warn', 'Warn_goto',
  'timer', 'count', 'count_init', 'intro_timer', 'bullet_types', 'powerups',
  'timeStop', 'timeStopBy', 'ultWindup', 'slow', 'slowBy', 'kingWindup', 'eraseSeq',
  'killerBuffs', 'd4cBuffs', 'cMoonBuffs', 'bulletSlow', 'allies',
];
// Keys of each enemy bullet, so a guest can keep its own copy of one it just hit.
export const BULLET_KEYS = {
  b1: ['x_enemy', 'rand'],
  b2: ['x_enemy2', 'rand2'],
  b21: ['x_enemy21', 'rand21'],
  b3: ['x_enemy3', 'rand3'],
};
export const getWorld = (s) => Object.fromEntries(WORLD_KEYS.map((k) => [k, s[k]]));
export function applyWorld(s, w) {
  for (const k of WORLD_KEYS) if (k in w) s[k] = w[k];
}

// ---- Personal ult buffs (Killer Queen / D4C) ----
const hasBuff = (list, id) => (list || []).some((b) => b.id === id);
const addBuff = (list, id, frames) => {
  if (!hasBuff(list, id)) list.push({ id, frames });
};

const ALLY_ULTS = ['world', 'killer', 'd4c', 'cmoon']; // King is too complicated for the AI
// Each helper plays one of three plans and re-rolls it every 8-16 s:
//   defense - escort a player and shoot whatever is flying at them
//   attack  - roam the middle and clear enemy bullets
//   grab    - run down the power-up icons lying on the map
const ALLY_STRATEGIES = ['defense', 'attack', 'grab'];
const allyStrategyFrames = () => 8 * 60 + Math.floor(Math.random() * 8 * 60);
const rollStrategy = (a, io) => {
  a.strategy = ALLY_STRATEGIES[Math.floor(Math.random() * ALLY_STRATEGIES.length)];
  a.strategyTtl = allyStrategyFrames();
  a.guardId = a.strategy === 'defense' ? (io?.randomPlayerId?.() ?? a.owner ?? null) : null;
};
// Silver Chariot: summon an AI helper next to the player. 30 s cooldown, max 3 helpers.
function beginSilverLocal(s, selfId) {
  spawnAlly(s, selfId, s.x, s.y);
}

// Silver Chariot's AI helper: full AI block with shooting, a random ult and 3 hearts.
const ALLY_COLORS = ['#f97316', '#22c55e', '#e879f9', '#facc15', '#38bdf8', '#f43f5e'];
const allyColor = (id) => ALLY_COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ALLY_COLORS.length];
export function spawnAlly(s, owner, x, y) {
  if (s.allies.length >= 3) return;
  const id = `ally-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  s.allies.push({
    id,
    owner,
    color: allyColor(id),
    score: 0,
    x: Math.max(560, Math.min(700, x)),
    y: Math.max(80, Math.min(480, y)),
    hp: 3,
    shootCd: FIRE_EVERY,
    nextLower: true,
    aimLower: null, // barrel the helper is currently lining up
    aimTargetY: null,
    dodgeTtl: 0, // keep dodging after the bullet leaves the lane so we don't re-enter early
    dodgeDir: 0,
    dodgeTargetX: null, // slide to this x while dodging (left for rear bullets, right for front)
    dodgeTargetY: null, // and to this block-center y, just enough to clear the lane
    dodgeType: null,
    strategy: ALLY_STRATEGIES[Math.floor(Math.random() * ALLY_STRATEGIES.length)],
    strategyTtl: allyStrategyFrames(),
    guardId: owner ?? null, // player escorted by the defense plan
    speedBoost: 0,
    fireBoost: 0,
    dodgeFromRight: false,
    dodgeY: null,
    x_change: 0,
    y_change: 0,
    accel_x: 0,
    accel_y: 0,
    ultCd: 0,
    ultType: ALLY_ULTS[Math.floor(Math.random() * ALLY_ULTS.length)],
    shots: [],
    flash: 0,
  });
}

// ---- King Crimson rollback ----
// The exact state at the moment T is pressed is kept here; erasing the future restores it.
const kingSnapshots = new WeakMap();
const SNAP_KEEP = new Set([
  'ultCooldown', 'ultType',
  'arrows', 'arrowSeq', 'accel_x', 'accel_y', 'fHeld', 'firedThisFrame', 'fireTimer',
  'ultActivePrev', 'eraseSeq', 'seenEraseSeq', 'slowPrev',
]);
const cloneState = (v) =>
  (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export function saveKingSnapshot(s) {
  if (kingSnapshots.has(s)) return;
  kingSnapshots.set(s, cloneState(s));
}

export function clearKingSnapshot(s) {
  kingSnapshots.delete(s);
}

const hasKingSnapshot = (s) => kingSnapshots.has(s);

// localOnly: guests keep the host's restored world and only roll their own player back.
export function restoreKingSnapshot(s, localOnly = false) {
  const snap = kingSnapshots.get(s);
  if (!snap) return false;
  const copy = cloneState(snap);
  for (const k of Object.keys(copy)) {
    if (SNAP_KEEP.has(k)) continue;
    if (localOnly && WORLD_KEYS.includes(k)) continue;
    s[k] = copy[k];
  }
  // give control back immediately, following whatever keys are held now
  const { left, right, up, down } = s.arrows;
  s.accel_x = left || right ? (left > right ? -0.2 : 0.2) : 0;
  s.accel_y = up || down ? (up > down ? -0.2 : 0.2) : 0;
  s.fHeld = false;
  s.aiPrev = false;
  s.ultActivePrev = true; // let the BGM/audio transition run
  kingSnapshots.delete(s);
  return true;
}

export function eraseKing(s) {
  restoreKingSnapshot(s);
  s.kingWindup = 0;
  s.slow = 0;
  s.slowBy = null;
  s.eraseSeq = (s.eraseSeq || 0) + 1;
  s.seenEraseSeq = s.eraseSeq;
  s.remoteKO = false;
  s.ultActivePrev = true;
  kingSnapshots.delete(s);
}

// Where a new bullet aims: a random living player in multiplayer, otherwise you. D4C never
// lets a bullet aim at its protected player.
const aimY = (s, io) => {
  const online = io.online ? io.online() : false;
  const selfId = io.selfId?.() ?? null;
  if (!online && hasBuff(s.d4cBuffs, selfId)) {
    let y = 30 + Math.random() * 510;
    if (Math.abs(y - s.y) < 120) y = s.y > 300 ? 30 + Math.random() * 200 : 400 + Math.random() * 140;
    return y;
  }
  return io.targetY ? io.targetY(s) : s.y;
};

function respawnBullet1(s, io, rng) {
  const ty = aimY(s, io);
  const gen = rng.randrange(-50, 50);
  s.rand = ty + gen;
  if (ty >= 520) s.rand -= 30;
  if (ty <= 60) s.rand += 30;
}

// The sniper rolls a fresh target every time it respawns, not only when it reaches the far
// wall: reusing the old lane made it hammer the same player until they moved out of it.
function respawnBullet3(s, io) {
  s.x_warn = aimY(s, io);
  s.rand3 = s.x_warn + 11;
}

// Host side: another player was hit by, or shot down, this bullet. Reset it for everyone.
// During a time stop the bullet is parked off-screen instead, so no new enemy bullet appears
// until time resumes.
export function applyRemoteHit(s, bullet, io) {
  const rng = io.rng || mathRandomRng;
  const stopped = s.timeStop > 0;
  if (bullet === 'b1') {
    s.x_enemy = stopped ? -60 : 0;
    if (!stopped) respawnBullet1(s, io, rng);
  } else if (bullet === 'b2') {
    if (stopped) s.x_enemy2 = -60;
    else {
      s.x_enemy2 = 0;
      s.rand2 = rng.randint(30, 540);
    }
  } else if (bullet === 'b21') {
    if (stopped) s.x_enemy21 = 860;
    else {
      s.x_enemy21 = 780;
      s.rand21 = rng.randint(30, 540);
    }
  } else if (bullet === 'b3') {
    s.x_enemy3 = stopped ? -60 : 0;
    if (!stopped) respawnBullet3(s, io);
  }
}

// Glowing power-up icon, pulsing as it waits: bolt (speed), bullet (fire rate), heart (life).
function drawPowerup(ctx, p, images = {}) {
  const r = POWERUP_SIZE / 2;
  const cx = p.x + r;
  const cy = p.y + r;
  const pulse = 1 + 0.12 * Math.sin(p.ttl / 6);
  const color = { speed: '#facc15', fire: '#fb923c', life: '#ef4444', slow: '#38bdf8' }[p.type];
  ctx.save();
  ctx.globalAlpha = p.ttl < 120 && Math.floor(p.ttl / 8) % 2 === 0 ? 0.35 : 1; // blink before it goes
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  if (p.type === 'life' && images.heart) {
    const size = 34 * pulse;
    ctx.drawImage(images.heart, cx - size / 2, cy - size / 2, size, (size * 35) / 38);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (p.type === 'fire' && images.bullet) {
      ctx.drawImage(images.bullet, cx - 11, cy - 11, 22, 11);
      ctx.drawImage(images.bullet, cx - 11, cy + 1, 22, 11);
    } else if (p.type === 'slow') {
      ctx.fillStyle = '#1f1f1f'; // hourglass
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 9);
      ctx.lineTo(cx + 8, cy - 9);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 9);
      ctx.lineTo(cx + 8, cy + 9);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#1f1f1f';
      ctx.beginPath(); // lightning bolt
      ctx.moveTo(cx + 3, cy - 11);
      ctx.lineTo(cx - 7, cy + 2);
      ctx.lineTo(cx - 1, cy + 2);
      ctx.lineTo(cx - 3, cy + 11);
      ctx.lineTo(cx + 7, cy - 2);
      ctx.lineTo(cx + 1, cy - 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// Drops one random icon at a random spot. The id lets a pickup on one screen remove the same
// icon from everyone else's map.
export function spawnPowerup(s, rng = Math.random) {
  const id = `${Date.now().toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`;
  s.powerups.push({
    id,
    x: 40 + rng() * (WIDTH - 80 - POWERUP_SIZE),
    y: 60 + rng() * (HEIGHT - 100 - POWERUP_SIZE),
    ttl: POWERUP_FRAMES,
    type: POWERUP_TYPES[Math.floor(rng() * POWERUP_TYPES.length)],
  });
}

// Ultimate: freeze time (The World), slow the world (King Crimson), or a personal buff
// (Killer Queen / D4C). Personal buffs can overlap across players.
function tryUlt(s, io, frozen) {
  if (frozen || !s.cont || s.ultCooldown > 0) return;
  if (s.timeStop > 0 || s.ultWindup > 0 || s.slow > 0 || s.kingWindup > 0) return;
  if (s.timer < ULT_MIN_TIMER) return; // no ultimate in the first 10 s
  // Silver Chariot: summon an AI helper (30 s cooldown). No effect on other ults.
  if (s.ultType === 'silver') {
    if (s.allies.length >= 3) return;
    s.ultCooldown = ultCooldownFor('silver', s.ultRush);
    io.sfx?.('silver');
    if (io.online?.()) {
      io.sendUltSound?.('silver');
      io.startUlt?.(s, 'silver');
    } else {
      beginSilverLocal(s, io.selfId?.() ?? null);
    }
    return;
  }
  const selfId = io.selfId?.() ?? null;
  if (s.ultType === 'killer' && hasBuff(s.killerBuffs, selfId)) return;
  if (s.ultType === 'd4c' && hasBuff(s.d4cBuffs, selfId)) return;
  if (s.ultType === 'cmoon' && hasBuff(s.cMoonBuffs, selfId)) return;
  if (s.ultType === 'king') saveKingSnapshot(s); // rollback point for the erase
  s.ultCooldown = ultCooldownFor(s.ultType, s.ultRush);
  if (s.ultType === 'killer' || s.ultType === 'd4c' || s.ultType === 'cmoon') {
    io.sfx?.(s.ultType); // local activation clip
    io.sendUltSound?.(s.ultType); // and the same clip on everyone else's screen
  }
  if (io.startUlt?.(s, s.ultType)) return; // host took over, or a guest asked the host
  if (s.ultType === 'cmoon') addBuff(s.cMoonBuffs, selfId, CMOON_FRAMES);
  else if (s.ultType === 'd4c') addBuff(s.d4cBuffs, selfId, D4C_FRAMES);
  else if (s.ultType === 'killer') addBuff(s.killerBuffs, selfId, KILLER_FRAMES);
  else if (s.ultType === 'king') {
    s.kingWindup = KING_WINDUP_FRAMES;
    s.slowBy = selfId;
  } else {
    s.ultWindup = ULT_WINDUP_FRAMES;
    s.timeStopBy = selfId;
  }
}

// Human-ish wandering for the players caught in King Crimson's random future.
function wander(s, rng) {
  if (s.aiTimer <= 0) {
    if (rng.randint(0, 99) < 15) {
      s.aiPause = rng.randint(15, 45); // a short human pause
      s.aiDX = 0;
      s.aiDY = 0;
    } else {
      s.aiPause = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
      const d = dirs[rng.randint(0, dirs.length - 1)];
      s.aiDX = d[0];
      s.aiDY = d[1];
    }
    s.aiTimer = rng.randint(25, 90);
  }
  if (s.aiTimer > 0) s.aiTimer -= 1;
  if (s.aiPause > 0) {
    s.aiPause -= 1;
    s.aiDX = 0;
    s.aiDY = 0;
  }
  // steer away from the walls so the wander stays inside the arena
  if (s.x < 60) s.aiDX = 1;
  else if (s.x > WIDTH - 110) s.aiDX = -1;
  if (s.y < 80) s.aiDY = 1;
  else if (s.y > HEIGHT - 110) s.aiDY = -1;
  s.accel_x = s.aiDX * 0.2;
  s.accel_y = s.aiDY * 0.2;
}

// Small yellow burst where a shot destroys an enemy bullet; Killer Queen makes it a big blast.
const EXPLOSION_FRAMES = 18;
const BIG_EXPLOSION_FRAMES = 39; // 1.5x the old 26-frame Killer Queen blast
function spawnExplosion(s, rect, big = false) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return;
  const frames = big ? BIG_EXPLOSION_FRAMES : EXPLOSION_FRAMES;
  s.explosions.push({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
    ttl: frames,
    max: frames,
    size: big ? KILLER_RADIUS : 25,
  });
}

// Pink dots orbiting slowly clockwise around the D4C user.
export function drawD4cOrbit(ctx, cx, cy, t) {
  if (!ctx) return;
  const radius = 46;
  const spin = t * 0.012;
  ctx.save();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 8; i += 1) {
    const a = spin + (i / 8) * Math.PI * 2;
    const alpha = 0.28 + 0.3 * (0.5 + 0.5 * Math.sin(a * 2 + spin));
    ctx.fillStyle = `rgba(244, 114, 182, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Knockback: for a moment the speed limit is `cap`, whatever boost is active.
function knock(s, cap) {
  s.knock = KNOCK_FRAMES;
  s.knockCap = cap;
  if (Math.abs(s.x_change) > cap) s.x_change = Math.sign(s.x_change) * cap;
}

// One bullet from the next barrel (the y offsets are the original const1/const2).
function fire(s, sfx) {
  sfx('fire');
  const lower = s.nextLower;
  s.shots.push({ x: s.x + 10, y: lower ? s.y + 50 + s.y_change : s.y - 15 + s.y_change, lower });
  if (lower) s.kickLower = KICK_FRAMES; // only the barrel that fired kicks back
  else s.kickUpper = KICK_FRAMES;
  s.nextLower = !lower;
  s.fireTimer = FIRE_EVERY;
  s.firedThisFrame = true;
}

// pygame.draw.rect(display, color, (x, y, w, h)) -> Rect
function drawRect(ctx, color, x, y, w, h) {
  const rx = Math.trunc(x);
  const ry = Math.trunc(y);
  const rw = Math.trunc(w);
  const rh = Math.trunc(h);
  const x1 = Math.max(rx, 0);
  const y1 = Math.max(ry, 0);
  const x2 = Math.min(rx + rw, WIDTH);
  const y2 = Math.min(ry + rh, HEIGHT);
  if (rw <= 0 || rh <= 0 || x2 <= x1 || y2 <= y1) return { x: rx, y: ry, w: 0, h: 0 };
  if (ctx) {
    ctx.fillStyle = css(color);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// Rect.colliderect
export function collide(a, b) {
  if (a.w === 0 || a.h === 0 || b.w === 0 || b.h === 0) return false;
  return a.x < b.x + b.w && a.y < b.y + b.h && a.x + a.w > b.x && a.y + a.h > b.y;
}

// font.render(...) with textRect.center = (cx, cy), then blit
function text(ctx, font, str, color, cx, cy) {
  if (!ctx) return;
  ctx.font = font;
  ctx.fillStyle = css(color);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, cx, cy);
}

function blit(ctx, img, x, y) {
  if (ctx && img) ctx.drawImage(img, Math.trunc(x), Math.trunc(y));
}

// Full-screen colour wash + expanding ripple for the ultimate. Drawn on the visible canvas
// after the ghost players, so it tints everything and every client sees the same effect.
export function drawUltOverlay(ctx, s) {
  const king = s.slow > 0;
  const world = s.timeStop > 0 || s.ultWindup > 0;
  if (!ctx || (!king && !world)) return;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  ctx.save();

  const rings = (t, life) => {
    const LIFE = life; // frames for one ripple to cross the screen
    for (let i = 0; i < 4; i += 1) {
      const phase = ((t + (i * LIFE) / 4) % LIFE) / LIFE;
      const radius = phase * 760;
      ctx.strokeStyle = king
        ? `rgba(255, 170, 170, ${(1 - phase) * 0.4})`
        : `rgba(205, 196, 255, ${(1 - phase) * 0.4})`;
      ctx.lineWidth = 2 + 3 * (1 - phase);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (t < 12) { // opening flash
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * (1 - t / 12)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  };

  if (king) {
    const t = s.slowAnim;
    if (t <= 0) {
      ctx.restore();
      return;
    }
    if (t <= KING_FX_FRAMES) {
      rings(t, KING_FX_FRAMES); // ripple only for the first second
    } else {
      // then the red shade fades in and stays for the rest of the slow
      const alpha = 0.22 * Math.min(1, (t - KING_FX_FRAMES) / 12);
      ctx.fillStyle = `rgba(170, 24, 48, ${alpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
    return;
  }

  const t = s.ultAnim - ULT_FX_DELAY_FRAMES;
  if (t <= 0) {
    ctx.restore();
    return;
  }
  // time slowly drains the colour while the stop lasts
  const wash = s.timeStop > 0 ? 0.22 : 0.08 + 0.12 * Math.min(1, t / ULT_WINDUP_FRAMES);
  ctx.fillStyle = `rgba(90, 56, 200, ${wash})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (t <= ULT_FX_FRAMES) rings(t, 96);
  ctx.restore();
}

/**
 * One frame.
 * @param s       state from createState()
 * @param events  [{type: 'keydown'|'keyup', key: 'left'|'right'|'up'|'down'|'f'|'t'}] for this frame
 * @param io      { ctx?, images?: {heart, bullet}, rng, sfx?(name), music?: {play(), stop(), volume(v)},
 *                  isUlter?(s), isSlowUlter?(s), startUlt?(s, type), cancelUlt?(s), stopUlt?(), selfId?(), online?(), ownsWorld?(), buffTarget?(s, id),
 *                  takeBooms?(), sendBoom?(x, y, big), takeUltSounds?(), sendUltSound?(type) }
 */
export function step(s, events, io) {
  const { ctx = null, images = {}, rng = mathRandomRng } = io;
  // Shared game: guests adopt the host's bullets and level; the host applies other
  // players' hits. Both hooks are absent in single-player.
  const world = io.takeWorld?.();
  if (world) applyWorld(s, world);
  // King Crimson: snapshot the pre-ult state, and roll back when the host broadcasts an erase.
  if ((s.kingWindup > 0 || s.slow > 0) && !hasKingSnapshot(s)) saveKingSnapshot(s);
  if (s.eraseSeq !== s.seenEraseSeq) {
    s.seenEraseSeq = s.eraseSeq;
    restoreKingSnapshot(s, true);
  }
  if (io.takeGameOver?.() && s.cont) {
    s.lives = 0; // another player died: the game ends for everyone
    s.remoteKO = true;
  }
  for (const bullet of io.takeEvents?.() ?? []) applyRemoteHit(s, bullet, io);
  // other players' shot bursts (small, or Killer Queen's big blast)
  for (const b of io.takeBooms?.() ?? []) {
    const big = !!b.big;
    const frames = big ? BIG_EXPLOSION_FRAMES : EXPLOSION_FRAMES;
    s.explosions.push({
      x: b.x,
      y: b.y,
      ttl: frames,
      max: frames,
      size: big ? KILLER_RADIUS : 25,
    });
  }
  const incomingUltSounds = io.takeUltSounds?.() ?? [];
  const sfx = io.sfx || (() => {});
  for (const type of incomingUltSounds) sfx(type);
  const music = io.music || { play() {}, stop() {}, volume() {} };
  const isUlter = (st) => (io.isUlter ? io.isUlter(st) : st.timeStopBy == null);
  const isSlowUlter = (st) => (io.isSlowUlter ? io.isSlowUlter(st) : st.slowBy == null);
  const selfId = io.selfId?.() ?? null;
  // Latches the moment any player passes the score, and trims whatever is already running.
  if (!s.ultRush && Math.max(s.score, io.topScore?.() ?? 0) > ULT_RUSH_SCORE) {
    s.ultRush = true;
    if (s.ultCooldown > 0) s.ultCooldown = Math.max(0, s.ultCooldown - ULT_RUSH_CUT);
    for (const a of s.allies) if (a.ultCd > 0) a.ultCd = Math.max(0, a.ultCd - ULT_RUSH_CUT);
  }
  const aiControlledNow = s.slow > 0 && !isSlowUlter(s);
  const frozenNow = s.timeStop > 0 && !isUlter(s);

  for (const event of events) {
    if (event.type === 'keydown') {
      if (event.key in s.arrows) s.arrows[event.key] = ++s.arrowSeq;
      if (!aiControlledNow) {
        if (event.key === 'left') s.accel_x = -0.2;
        if (event.key === 'right') s.accel_x = 0.2;
        if (event.key === 'up') s.accel_y = -0.2;
        if (event.key === 'down') s.accel_y = 0.2;
      }

      if (event.key === 't') {
        // A remote player's death can be erased; dying in your own time erase cannot.
        if (s.slow > 0 && isSlowUlter(s) && (s.cont || s.remoteKO)) {
          // second press: erase the random future and return everyone to normal speed
          io.stopUlt?.();
          if (!io.cancelUlt?.(s)) {
            eraseKing(s);
          }
        } else {
          tryUlt(s, io, frozenNow);
        }
      }
      if (event.key === 'f') {
        s.fHeld = true;
        if (!frozenNow && !aiControlledNow) fire(s, sfx);
      }
    } else if (event.type === 'keyup') {
      if (event.key in s.arrows) {
        s.arrows[event.key] = 0;
        if (!aiControlledNow) {
          const { left, right, up, down } = s.arrows;
          s.accel_x = left || right ? (left > right ? -0.2 : 0.2) : 0;
          s.accel_y = up || down ? (up > down ? -0.2 : 0.2) : 0;
        }
      }
      if (event.key === 'f') s.fHeld = false;
    }
  }

  // Host runs the ultimate clock: the King Crimson scream, The World's 2 s windup, then the
  // freeze or the 25% slow. Guests adopt all of it from the world broadcast.
  if (io.ownsWorld ? io.ownsWorld() : true) {
    if (s.kingWindup > 0) {
      s.kingWindup -= 1;
      if (s.kingWindup === 0) s.slow = KING_FRAMES;
    } else if (s.ultWindup > 0) {
      s.ultWindup -= 1;
      if (s.ultWindup === 0) s.timeStop = ULT_FRAMES;
    } else if (s.timeStop > 0) {
      s.timeStop -= 1;
      if (s.timeStop === 0) s.timeStopBy = null;
    } else if (s.slow > 0) {
      s.slow -= 1;
      if (s.slow === 0) s.slowBy = null;
    }
    // personal buffs tick unless time is fully stopped; they keep running during King Crimson
    if (s.timeStop === 0) {
      for (const b of s.killerBuffs) b.frames -= 1;
      for (const b of s.d4cBuffs) b.frames -= 1;
      for (const b of s.cMoonBuffs) b.frames -= 1;
      s.killerBuffs = s.killerBuffs.filter((b) => b.frames > 0);
      s.d4cBuffs = s.d4cBuffs.filter((b) => b.frames > 0);
      s.cMoonBuffs = s.cMoonBuffs.filter((b) => b.frames > 0);
      if (s.bulletSlow > 0) s.bulletSlow -= 1;
    }
  }

  // the rollback snapshot is only needed while King Crimson is running
  if (s.slow === 0 && s.slowPrev > 0) clearKingSnapshot(s);
  s.slowPrev = s.slow;

  const killerOn = hasBuff(s.killerBuffs, selfId);
  const d4cOn = hasBuff(s.d4cBuffs, selfId);
  const cMoonOn = hasBuff(s.cMoonBuffs, selfId);
  const cMoonActive = s.cMoonBuffs.length > 0;

  const stopped = s.timeStop > 0;
  const frozen = stopped && !isUlter(s);
  const slowActive = s.slow > 0;
  const worldScale = slowActive ? SLOW : 1; // enemy bullets and the level clock
  const bulletScale = worldScale * (s.bulletSlow > 0 ? 0.5 : 1); // slow power-up halves bullet speed too
  const selfScale = slowActive && !isSlowUlter(s) ? SLOW : 1; // everyone but the King Crimson user
  const ultActive = stopped || s.ultWindup > 0 || slowActive || s.kingWindup > 0;

  // the clip starts with the windup; the BGM stays off through the whole effect
  if (ultActive && !s.ultActivePrev) {
    sfx(s.kingWindup > 0 || slowActive ? 'king' : 'ult');
    music.pause?.();
  } else if (!ultActive && s.ultActivePrev) {
    io.stopUlt?.();
    music.resume?.();
  }
  s.ultActivePrev = ultActive;
  if (ultActive) s.ultAnim += 1;
  else s.ultAnim = 0;
  if (slowActive) s.slowAnim += 1;
  else s.slowAnim = 0;
  // D4C's orbit keeps spinning unless a time stop freezes the world
  if (s.d4cBuffs.length > 0 && s.timeStop === 0) s.d4cAnim += 1;
  else if (s.d4cBuffs.length === 0) s.d4cAnim = 0;

  // King Crimson's random future: everyone but the ult user wanders on autopilot.
  const aiControlled = slowActive && !isSlowUlter(s);
  if (aiControlled) {
    if (!s.aiPrev) {
      s.aiPrev = true;
      s.aiTimer = 0;
      s.aiPause = 0;
      s.fHeld = false;
    }
    wander(s, rng);
  } else if (s.aiPrev) {
    // hand control back to the real arrow keys
    const { left, right, up, down } = s.arrows;
    s.accel_x = left || right ? (left > right ? -0.2 : 0.2) : 0;
    s.accel_y = up || down ? (up > down ? -0.2 : 0.2) : 0;
    s.fHeld = false;
    s.aiPrev = false;
  }

  if (s.fHeld && !s.firedThisFrame && !frozen && !aiControlled) {
    s.fireTimer -= (s.fireBoost > 0 ? BOOST : 1) * selfScale;
    if (s.fireTimer <= 0) {
      const carry = s.fireTimer; // keep the leftover so boosted gaps average 4.5 frames (exactly 2x)
      fire(s, sfx);
      s.fireTimer += carry;
    }
  }
  s.firedThisFrame = false;
  if (!frozen) for (const shot of s.shots) shot.x -= 13 * selfScale;
  s.shots = s.shots.filter((shot) => shot.x > -60);
  if (!frozen) {
    if (s.kickLower > 0) s.kickLower -= 1;
    if (s.kickUpper > 0) s.kickUpper -= 1;
  }
  const kickLower = (s.kickLower / KICK_FRAMES) * KICK_DIST;
  const kickUpper = (s.kickUpper / KICK_FRAMES) * KICK_DIST;
  s.new_x = s.x + 10 + kickLower;
  s.new_y = s.y + 50;
  s.new_x2 = s.x + 10 + kickUpper;
  s.new_y2 = s.y - 15;

  music.volume(s.fade_in);
  s.fade_in += 0.0017;
  if (!stopped) s.timer += 0.02 * worldScale;
  // The cooldown only runs outside your active ult, so there is a full 30 s gap afterward.
  const myUltActive = s.ultWindup > 0 || s.timeStop > 0 || s.kingWindup > 0 || s.slow > 0 || killerOn || d4cOn || cMoonOn;
  if (!myUltActive && s.ultCooldown > 0) s.ultCooldown -= 1;
  const levels = pyRound(s.timer);

  const x_round = pyRound(s.x_change);

  if (ctx) {
    ctx.fillStyle = css(grey12);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (s.cont === true) {
    text(ctx, FONTS.score, 'Score: ' + s.score, green, 700, 20);
    text(ctx, FONTS.lives, "Live's ", orange, 455, 22.5);
  }

  if (levels <= 7) {
    if (levels >= 1) {
      s.intro_timer += 0.006;
      const intro_queue = pyRound(s.intro_timer);
      text(ctx, FONTS.intro, 'Game starting in: ' + (3 - intro_queue), peach, 400, 160);
    }
  }

  if (!stopped && levels <= 4) music.play();

  if (!frozen) {
    const speed = (s.speedBoost > 0 ? BOOST : 1) * (cMoonOn ? CMOON_BOOST : 1) * selfScale;
    // item timers freeze while time is stopped, even for the player who stopped it
    if (!stopped) {
      if (s.speedBoost > 0) s.speedBoost -= 1;
      if (s.fireBoost > 0) s.fireBoost -= 1;
    }
    const cap = s.knock > 0 ? s.knockCap * selfScale : max_speed * speed;
    if (s.knock > 0) s.knock -= 1;
    s.x_change += s.accel_x * speed;
    s.y_change += s.accel_y * speed;

    if (Math.abs(s.x_change) >= cap) s.x_change = (s.x_change / Math.abs(s.x_change)) * cap;
    if (Math.abs(s.y_change) >= cap) s.y_change = (s.y_change / Math.abs(s.y_change)) * cap;

    if (s.accel_x === 0) s.x_change *= 0.92;
    if (s.accel_y === 0) s.y_change *= 0.92;

    s.x += s.x_change;
    s.y += s.y_change;
  }
  if (!stopped) {
    if (s.enemy_accel >= 14) s.enemy_accel = (s.enemy_accel / s.enemy_accel) * 14;
    if (s.enemy_accel2 >= 12) s.enemy_accel2 = (s.enemy_accel2 / s.enemy_accel2) * 12;
    if (s.enemy_accel3 >= 18) s.enemy_accel3 = (s.enemy_accel3 / s.enemy_accel3) * 18;
  }
  if (s.fade_in >= 1.3) s.fade_in = (s.fade_in / s.fade_in) * 1.3;

  const wall1 = drawRect(ctx, grey12, -13, -100, 15, 800);
  const wall2 = drawRect(ctx, grey12, 799, -20, 35, 800);
  const wall3 = drawRect(ctx, grey12, 0, 35, 850, 2);
  const wall4 = drawRect(ctx, grey12, 0, 595, 830, 35);

  if (s.x_change <= -1) s.movement_x = 'right';
  if (x_round === 0) s.movement_x = 0;

  if (s.movement_x === 'right') {
    drawRect(ctx, air_color, s.x + 43, s.y - 7, 40, 2);
    drawRect(ctx, air_color, s.x + 43, s.y + 54, 38, 2);
    drawRect(ctx, air_color, s.x + 56, s.y + 40, 40, 2);
    drawRect(ctx, air_color, s.x + 68, s.y + 25, 25, 2);
    drawRect(ctx, air_color, s.x + 56, s.y + 7, 45, 2);
  }

  const sprite = drawRect(ctx, s.player_color, s.x, s.y, 50, 50);
  const leftOnMap = [];
  for (const p of s.powerups) {
    if (!stopped) p.ttl -= 1;
    if (!frozen && s.cont && collide(sprite, { x: p.x, y: p.y, w: POWERUP_SIZE, h: POWERUP_SIZE })) {
      if (p.type === 'speed') s.speedBoost = BOOST_FRAMES;
      else if (p.type === 'fire') s.fireBoost = BOOST_FRAMES;
      else if (p.type === 'slow') s.bulletSlow = SLOW_FRAMES;
      else s.lives = Math.min(MAX_LIVES, s.lives + 1);
      io.reportPickup?.(p.id);
      sfx('bounce');
      continue;
    }
    if (p.ttl <= 0) continue;
    if (ctx) drawPowerup(ctx, p, images);
    leftOnMap.push(p);
  }
  s.powerups = leftOnMap;
  drawRect(ctx, [255, 223, 0], s.new_x, s.new_y, 3, 15); // loaded lower bullet
  const shotRects = s.shots.map((shot) =>
    drawRect(ctx, shot.lower ? [255, 223, 0] : grey12, shot.x, shot.y, 3, 15)
  );
  // A shot that hits an enemy bullet is spent; one shot per enemy per frame.
  const spent = new Set();
  const shotHits = (enemy) => {
    const k = shotRects.findIndex((r, idx) => !spent.has(idx) && collide(enemy, r));
    if (k < 0) return false;
    spent.add(k);
    return true;
  };

  // C-Moon: enemy bullets accelerate toward the nearest C-Moon player. The velocity keeps
  // building while the pull is active (and is dropped when C-Moon ends), so paths curve.
  if (!stopped) {
    const targets = [];
    for (const b of s.cMoonBuffs) {
      const t = io.buffTarget ? io.buffTarget(s, b.id) : { x: s.x + 25, y: s.y + 25 };
      if (t) targets.push(t);
    }
    const pull = CMOON_ACCEL * bulletScale;
    const apply = (bx, by, w, h, vx, vy) => {
      if (!targets.length) return [bx, by, 0, 0];
      const cx = bx + w / 2;
      const cy = by + h / 2;
      let tx = 0;
      let ty = 0;
      let bd = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.x - cx, t.y - cy);
        if (d < bd) {
          bd = d;
          tx = t.x;
          ty = t.y;
        }
      }
      if (bd < 1) return [bx, by, vx, vy];
      vx = (vx + ((tx - cx) / bd) * pull) * 0.995;
      vy = (vy + ((ty - cy) / bd) * pull) * 0.995;
      const sp = Math.hypot(vx, vy);
      if (sp > CMOON_MAX_SPEED) {
        vx = (vx / sp) * CMOON_MAX_SPEED;
        vy = (vy / sp) * CMOON_MAX_SPEED;
      }
      return [bx + vx, by + vy, vx, vy];
    };
    // a bullet that just respawned starts its gravity velocity fresh
    if (s.x_enemy <= 1) { s.gv1x = 0; s.gv1y = 0; }
    if (s.x_enemy2 <= 1) { s.gv2x = 0; s.gv2y = 0; }
    if (s.x_enemy21 >= WIDTH - 21) { s.gv21x = 0; s.gv21y = 0; }
    if (s.x_enemy3 <= 1) { s.gv3x = 0; s.gv3y = 0; }
    if (s.color !== 'grey12') [s.x_enemy, s.rand, s.gv1x, s.gv1y] = apply(s.x_enemy, s.rand, s.bulletW, s.bulletH, s.gv1x, s.gv1y);
    if (s.color2 !== 'grey12') [s.x_enemy2, s.rand2, s.gv2x, s.gv2y] = apply(s.x_enemy2, s.rand2, 20, 15, s.gv2x, s.gv2y);
    if (s.color21 !== 'grey12') [s.x_enemy21, s.rand21, s.gv21x, s.gv21y] = apply(s.x_enemy21, s.rand21, 20, 15, s.gv21x, s.gv21y);
    if (s.color3 !== 'grey12') [s.x_enemy3, s.rand3, s.gv3x, s.gv3y] = apply(s.x_enemy3, s.rand3, 20, 7, s.gv3x, s.gv3y);
  }

  const bullet = drawRect(ctx, s.color, s.x_enemy, s.rand, s.bulletW, s.bulletH);
  const bullet2 = drawRect(ctx, s.color2, s.x_enemy2, s.rand2, 20, 15);
  const bullet21 = drawRect(ctx, s.color21, s.x_enemy21, s.rand21, 20, 15);
  const bullet3 = drawRect(ctx, s.color3, s.x_enemy3, s.rand3, 20, 7);
  drawRect(ctx, s.color4, s.Warn_goto, s.x_warn, 30, 30); // warning

  // Killer Queen: each shot hit blasts a wide radius and wipes nearby enemy bullets too.
  const shotExplosion = (rect, type) => {
    const big = killerOn;
    spawnExplosion(s, rect, big);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    io.sendBoom?.(cx, cy, big); // every player sees every hit burst
    if (!big) return;
    const targets = [['b1', bullet]];
    if (levels >= 30) targets.push(['b2', bullet2], ['b21', bullet21]);
    if (levels >= 59) targets.push(['b3', bullet3]);
    for (const [t, r] of targets) {
      if (t === type || !r || r.w <= 0 || r.h <= 0) continue;
      const bx = r.x + r.w / 2;
      const by = r.y + r.h / 2;
      if (Math.hypot(bx - cx, by - cy) > KILLER_RADIUS + Math.max(r.w, r.h) / 2) continue;
      io.report?.(t);
      sfx('hit'); // one hit sound per bullet the blast takes out
      if (t === 'b1') {
        s.x_enemy = 0;
        respawnBullet1(s, io, rng);
      } else if (t === 'b2') {
        s.x_enemy2 = 0;
        s.rand2 = rng.randint(30, 540);
      } else if (t === 'b21') {
        s.x_enemy21 = 780;
        s.rand21 = rng.randint(30, 540);
      } else {
        s.x_enemy3 = 0;
        respawnBullet3(s, io);
      }
    }
  };

  if (!frozen) {
    // A bounce is always the normal max speed, even during a 2x speed boost: the 400 impulse
    // used to be clamped by the boosted cap, which made boosted wall bounces twice as fast.
    if (collide(sprite, wall1)) {
      s.x_change = max_speed;
      sfx('bounce');
    }
    if (collide(sprite, wall2)) {
      s.x_change = -max_speed;
      sfx('bounce');
    }

    if (collide(sprite, wall3)) {
      s.y_change = max_speed;
      sfx('bounce');
    }
    if (collide(sprite, wall4)) {
      s.y_change = -max_speed;
      sfx('bounce');
    }
  }

  if (!stopped) {
    s.enemy_accel += 0.001;
    const whiteSpeed = Math.min(s.enemy_accel, s.enemy_accel3 * SNIPER_SPEED * 0.75);
    s.x_enemy += whiteSpeed * bulletScale;

    s.x_enemy3 += 0.01 * bulletScale;

    if (collide(bullet, wall2)) {
      s.x_enemy = 0;
      s.count_init += 1;
    }

    if (collide(bullet, wall2) && s.count_init >= 2 && s.cont === true) {
      s.x_enemy = 0;
      s.count += 1;
      s.color = 'white';
      s.bulletW = 40;
      s.bulletH = 20;

      respawnBullet1(s, io, rng);

      if (s.count >= 2) s.score += 1;
    }
  if (collide(bullet, sprite) && s.cont === true) {
    if (cMoonOn) {
      io.report?.('b1');
      s.x_enemy = 0;
      respawnBullet1(s, io, rng);
      sfx('hit');
      spawnExplosion(s, bullet);
    } else if (!cMoonActive) {
      io.report?.('b1');
      s.x_enemy = 0;
      s.x_change += 40;
      knock(s, max_speed);
      s.lives -= 1;
      s.rand = rng.randint(30, 540);
      sfx('ricochet');
      s.hits = true;
    }
  }
    if (s.cont === true && shotHits(bullet)) {
      io.report?.('b1');
      respawnBullet1(s, io, rng);
      sfx('hit');
      shotExplosion(bullet, 'b1');
      s.x_enemy = 0;
      s.score += 2;
    }

    if (levels >= 30 && s.cont === true) {
      s.enemy_accel2 += 0.0001;
      s.x_enemy2 += s.enemy_accel2 * bulletScale;
      s.x_enemy21 -= s.enemy_accel2 * bulletScale;
      s.bullet_types = 'Bullets: Normal, Shotgun';

      if (collide(bullet2, wall2)) {
        s.x_enemy2 = 0;
        s.rand2 = rng.randint(30, 540);
        s.color2 = 'yellow';
        s.score += 1;
      }
      if (collide(bullet2, sprite)) {
        if (cMoonOn) {
          io.report?.('b2');
          s.x_enemy2 = 0;
          s.rand2 = rng.randint(30, 540);
          sfx('hit');
          spawnExplosion(s, bullet2);
        } else if (!cMoonActive) {
          io.report?.('b2');
          s.x_enemy2 = 0;
          s.rand2 = rng.randint(30, 540);
          s.x_change += 40;
          knock(s, max_speed);
          s.lives -= 1;
          sfx('ricochet');
          s.hits = true;
        }
      }
      if (shotHits(bullet2)) {
        io.report?.('b2');
        s.x_enemy2 = 0;
        s.x_change += 20;
        knock(s, RECOIL_CAP);
        s.rand2 = rng.randint(30, 540);
        sfx('hit');
        shotExplosion(bullet2, 'b2');
      }

      if (collide(bullet21, wall1)) {
        s.x_enemy21 = 780;
        s.rand21 = rng.randint(30, 540);
        s.color21 = 'yellow';
        s.score += 1;
      }
      if (collide(bullet21, sprite)) {
        if (cMoonOn) {
          io.report?.('b21');
          s.x_enemy21 = 780;
          s.rand21 = rng.randint(30, 540);
          sfx('hit');
          spawnExplosion(s, bullet21);
        } else if (!cMoonActive) {
          io.report?.('b21');
          s.x_enemy21 = 780;
          s.rand21 = rng.randint(30, 540);
          s.x_change -= 40;
          knock(s, max_speed);
          s.lives -= 1;
          sfx('ricochet');
          s.hits = true;
        }
      }
      if (shotHits(bullet21)) {
        io.report?.('b21');
        s.x_enemy21 = 780;
        s.rand21 = rng.randint(30, 540);
        sfx('hit');
        shotExplosion(bullet21, 'b21');
      }
    }

    if (levels >= 59 && s.cont === true) {
      s.enemy_accel3 += 0.07;
      s.x_enemy3 += s.enemy_accel3 * SNIPER_SPEED * bulletScale;
      s.Warn_goto = 0;
      s.bullet_types = 'Bullets: Normal, Shotgun, Sniper';

      if (collide(bullet3, wall2)) {
        s.x_enemy3 = 0;
        respawnBullet3(s, io);
        s.color3 = 'red';
        s.color4 = 'red';
        s.score += 1;
      }

    if (collide(bullet3, sprite)) {
      if (cMoonOn) {
        io.report?.('b3');
        s.x_enemy3 = 0;
        respawnBullet3(s, io);
        sfx('hit');
        spawnExplosion(s, bullet3);
      } else if (!cMoonActive) {
        io.report?.('b3');
        s.x_enemy3 = 0;
        respawnBullet3(s, io);
        s.x_change += 40;
        knock(s, max_speed);
        s.lives -= 1;
        sfx('ricochet');
        s.hits = true;
      }
    }
      if (shotHits(bullet3)) {
        io.report?.('b3');
        s.x_enemy3 = 0;
        respawnBullet3(s, io);
        sfx('hit');
        shotExplosion(bullet3, 'b3');
      }
    }
  }

  // During the stop the world is frozen, but bullets still hit players and the player who
  // used the ultimate can still shoot them. Destroyed bullets are parked off-screen instead
  // of respawning, so no new enemy bullets appear until time resumes.
  if (stopped && s.cont) {
    const stopHit = { b1: false, b2: false, b21: false, b3: false };
    if (collide(bullet, sprite)) {
      if (cMoonOn) {
        stopHit.b1 = true;
        io.report?.('b1');
        s.x_enemy = -60;
        sfx('hit');
        spawnExplosion(s, bullet);
      } else if (!cMoonActive) {
        stopHit.b1 = true;
        io.report?.('b1');
        s.x_enemy = -60;
        s.x_change += 40;
        knock(s, max_speed);
        s.lives -= 1;
        sfx('ricochet');
        s.hits = true;
      }
    }
    if (levels >= 30) {
      if (collide(bullet2, sprite)) {
        if (cMoonOn) {
          stopHit.b2 = true;
          io.report?.('b2');
          s.x_enemy2 = -60;
          sfx('hit');
          spawnExplosion(s, bullet2);
        } else if (!cMoonActive) {
          stopHit.b2 = true;
          io.report?.('b2');
          s.x_enemy2 = -60;
          s.x_change += 40;
          knock(s, max_speed);
          s.lives -= 1;
          sfx('ricochet');
          s.hits = true;
        }
      }
      if (collide(bullet21, sprite)) {
        if (cMoonOn) {
          stopHit.b21 = true;
          io.report?.('b21');
          s.x_enemy21 = 860;
          sfx('hit');
          spawnExplosion(s, bullet21);
        } else if (!cMoonActive) {
          stopHit.b21 = true;
          io.report?.('b21');
          s.x_enemy21 = 860;
          s.x_change -= 40;
          knock(s, max_speed);
          s.lives -= 1;
          sfx('ricochet');
          s.hits = true;
        }
      }
    }
    if (levels >= 59 && collide(bullet3, sprite)) {
      if (cMoonOn) {
        stopHit.b3 = true;
        io.report?.('b3');
        s.x_enemy3 = -60;
        sfx('hit');
        spawnExplosion(s, bullet3);
      } else if (!cMoonActive) {
        stopHit.b3 = true;
        io.report?.('b3');
        s.x_enemy3 = -60;
        s.x_change += 40;
        knock(s, max_speed);
        s.lives -= 1;
        sfx('ricochet');
        s.hits = true;
      }
    }

    if (!frozen) {
      if (!stopHit.b1 && shotHits(bullet)) {
        io.report?.('b1');
        sfx('hit');
        shotExplosion(bullet, 'b1');
        s.x_enemy = -60;
        s.score += 2;
      }
      if (levels >= 30) {
        if (!stopHit.b2 && shotHits(bullet2)) {
          io.report?.('b2');
          s.x_enemy2 = -60;
          s.x_change += 20;
          knock(s, RECOIL_CAP);
          sfx('hit');
          shotExplosion(bullet2, 'b2');
        }
        if (!stopHit.b21 && shotHits(bullet21)) {
          io.report?.('b21');
          s.x_enemy21 = 860;
          sfx('hit');
          shotExplosion(bullet21, 'b21');
        }
      }
      if (levels >= 59 && !stopHit.b3 && shotHits(bullet3)) {
        io.report?.('b3');
        s.x_enemy3 = -60;
        sfx('hit');
        shotExplosion(bullet3, 'b3');
      }
    }
  }

  // AI helpers summoned by Silver Chariot: host-simulated, shared with every player.
  if (s.allies.length && (io.ownsWorld ? io.ownsWorld() : true)) {
    const destroyed = new Set();
    const resetBullet = (type) => {
      destroyed.add(type);
      if (type === 'b1') {
        s.x_enemy = stopped ? -60 : 0;
        if (!stopped) respawnBullet1(s, io, rng);
      } else if (type === 'b2') {
        s.x_enemy2 = stopped ? -60 : 0;
        if (!stopped) s.rand2 = rng.randint(30, 540);
      } else if (type === 'b21') {
        s.x_enemy21 = stopped ? 860 : 780;
        if (!stopped) s.rand21 = rng.randint(30, 540);
      } else {
        s.x_enemy3 = stopped ? -60 : 0;
        if (!stopped) respawnBullet3(s, io);
      }
    };
    const liveBullets = () => {
      const list = [];
      if (s.color !== 'grey12' && s.x_enemy > 1) list.push({ type: 'b1', rect: bullet });
      if (s.color2 !== 'grey12' && s.x_enemy2 > 1) list.push({ type: 'b2', rect: bullet2 });
      if (s.color21 !== 'grey12' && s.x_enemy21 < WIDTH - 21) list.push({ type: 'b21', rect: bullet21 });
      if (s.color3 !== 'grey12' && s.x_enemy3 > 1) list.push({ type: 'b3', rect: bullet3 });
      return list;
    };
    // Enemy bullets the helper can see, with current velocity, for dodging and aiming.
    const sensed = [];
    if (s.color !== 'grey12' && s.x_enemy > 1) {
      sensed.push({
        type: 'b1', x: s.x_enemy, y: s.rand, w: s.bulletW, h: s.bulletH,
        vx: stopped ? 0 : Math.min(s.enemy_accel, s.enemy_accel3 * SNIPER_SPEED * 0.75) * bulletScale + (s.gv1x || 0),
        vy: stopped ? 0 : s.gv1y || 0,
      });
    }
    if (s.color2 !== 'grey12' && s.x_enemy2 > 1) {
      sensed.push({
        type: 'b2', x: s.x_enemy2, y: s.rand2, w: 20, h: 15,
        vx: stopped ? 0 : s.enemy_accel2 * bulletScale + (s.gv2x || 0),
        vy: stopped ? 0 : s.gv2y || 0,
      });
    }
    if (s.color21 !== 'grey12' && s.x_enemy21 < WIDTH - 21) {
      sensed.push({
        type: 'b21', x: s.x_enemy21, y: s.rand21, w: 20, h: 15,
        vx: stopped ? 0 : -s.enemy_accel2 * bulletScale + (s.gv21x || 0),
        vy: stopped ? 0 : s.gv21y || 0,
      });
    }
    if (s.color3 !== 'grey12' && s.x_enemy3 > 1) {
      sensed.push({
        type: 'b3', x: s.x_enemy3, y: s.rand3, w: 20, h: 7,
        vx: stopped ? 0 : s.enemy_accel3 * SNIPER_SPEED * bulletScale + (s.gv3x || 0),
        vy: stopped ? 0 : s.gv3y || 0,
      });
    }
    // Helpers rotate through fixed slots and claim a bullet each, so they spread out
    // instead of all converging on the same spot.
    const claimed = new Set();
    const claimedLoot = new Set();
    for (let slot = 0; slot < s.allies.length; slot += 1) {
      const a = s.allies[slot];
      const spread = (slot - (s.allies.length - 1) / 2) * 85;
      // time stop freezes every helper except the one that stopped time
      const ownTimeStop = stopped && s.timeStopBy === a.id;
      if (stopped && !ownTimeStop) continue;
      const slowScale = s.slow > 0 && s.slowBy !== a.id ? 0.25 : 1;
      if (!stopped) {
        if (a.speedBoost > 0) a.speedBoost -= 1;
        if (a.fireBoost > 0) a.fireBoost -= 1;
        a.strategyTtl = (a.strategyTtl || 0) - 1;
        if (a.strategyTtl <= 0 || !a.strategy) rollStrategy(a, io);
      }
      const moveSpeed = slowScale
        * (hasBuff(s.cMoonBuffs, a.id) ? 1.25 : 1)
        * (a.speedBoost > 0 ? BOOST : 1);
      const aiCap = max_speed * moveSpeed;
      const cx = a.x + 25;
      const cy = a.y + 25;
      let moveX = 0;
      let moveY = 0;
      let aimAt = null;
      let aimLower = null;
      let dodging = false;
      let strafeTargetX = null;
      let homeX = 630 + spread * 0.35; // where this plan wants the helper to idle
      let homeY = null;

      if (ownTimeStop) {
        a.dodgeTtl = 0;
        a.dodgeDir = 0;
        a.dodgeTargetX = null;
        a.dodgeTargetY = null;
        a.dodgeType = null;
        a.dodgeY = null;
        // Frozen bullets: clear the one closest to the helper's owner, not just the nearest to us.
        const guard = a.owner && io.buffTarget ? io.buffTarget(s, a.owner) : null;
        const guardY = guard ? guard.y : s.y + 25;
        let best = null;
        for (const b of sensed) {
          if (b.x + b.w > a.x + 10) continue; // shots only travel left
          const by = b.y + b.h / 2;
          const d = Math.abs(by - guardY);
          if (!best || d < best.d) best = { by, d };
        }
        if (best) aimAt = best;
        moveX = a.x > 660 ? -1 : a.x < 600 ? 1 : 0;
      } else {
        let behind = null;
        let front = null;
        for (const b of sensed) {
          if (Math.abs(b.vx) < 0.01) continue;
          const bx = b.x + b.w / 2;
          const by = b.y + b.h / 2;
          const t = (cx - bx) / b.vx; // frames until it reaches our x
          if (t <= 0 || t > 55) continue;
          const py = by + b.vy * t;
          if (py < cy - 34 || py > cy + 34) continue; // it passes above/below
          if (bx > cx + 8) {
            if (!behind || t < behind.t) behind = { by, t, type: b.type };
          } else if (!front || t < front.t) {
            front = { by, t, type: b.type };
          }
        }
        // Yellow bullets behind (b21) cannot be shot: slide left with them and step
        // out of their lane (gain horizontal time, then dodge vertically).
        if (behind && behind.t < 60) {
          if (!a.dodgeFromRight || a.dodgeType !== behind.type || a.dodgeY == null || Math.abs(a.dodgeY - behind.by) > 30) {
            const dir = behind.by > cy ? -1 : 1; // bullet below -> step up, and vice versa
            const away = behind.by + dir * 50;
            a.dodgeDir = dir;
            a.dodgeTargetX = Math.min(a.x, 540);
            a.dodgeTargetY = dir > 0
              ? Math.max(cy + 10, away)
              : Math.min(cy - 10, away);
            a.dodgeTargetY = Math.max(62, Math.min(570, a.dodgeTargetY));
            a.dodgeType = behind.type;
            a.dodgeFromRight = true;
            a.dodgeY = behind.by;
          }
          moveY = a.dodgeDir;
          moveX = a.x > 540 ? -1 : 0;
          a.dodgeTtl = Math.max(a.dodgeTtl || 0, 100);
        } else if (front && front.t < 28) {
          if (a.dodgeFromRight || a.dodgeType !== front.type || a.dodgeY == null || Math.abs(a.dodgeY - front.by) > 30) {
            const dir = front.by > cy ? -1 : 1;
            const away = front.by + dir * 50;
            a.dodgeDir = dir;
            a.dodgeTargetX = Math.max(a.x, 720);
            a.dodgeTargetY = dir > 0
              ? Math.max(cy + 10, away)
              : Math.min(cy - 10, away);
            a.dodgeTargetY = Math.max(62, Math.min(570, a.dodgeTargetY));
            a.dodgeType = front.type;
            a.dodgeFromRight = false;
            a.dodgeY = front.by;
          }
          moveY = a.dodgeDir;
          moveX = a.x < 720 ? 1 : 0;
          a.dodgeTtl = Math.max(a.dodgeTtl || 0, 80);
        } else {
          // Nothing to dodge: follow this helper's plan.
          let guard = null;
          if (a.strategy === 'defense') {
            guard = (a.guardId != null && io.buffTarget ? io.buffTarget(s, a.guardId) : null)
              || { x: s.x + 25, y: s.y + 25 };
            // sit between them and the stream, each defender in its own slot
            homeX = Math.max(150, Math.min(720, guard.x - 90 + spread * 0.7));
          }
          let loot = null;
          if (a.strategy === 'grab') {
            // one icon per helper, so grabbers fan out instead of racing the same drop
            for (const p of s.powerups) {
              if (p.ttl <= 0 || claimedLoot.has(p.id)) continue;
              const px = p.x + POWERUP_SIZE / 2;
              const py = p.y + POWERUP_SIZE / 2;
              const d = Math.hypot(px - cx, py - cy);
              if (!loot || d < loot.d) loot = { x: px, y: py, d, id: p.id };
            }
            if (loot) claimedLoot.add(loot.id);
          }
          // Shoot the bullet nearest our barrels, or nearest the player we escort.
          // A bullet another helper already called is only a fallback, so they split up.
          let best = null;
          let taken = null;
          for (const b of sensed) {
            const bx = b.x + b.w / 2;
            if (bx >= a.x + 5) continue; // behind: leave it to the dodge
            const by = b.y + b.h / 2;
            const d = guard ? Math.abs(by - guard.y) : Math.abs(by - cy);
            if (claimed.has(b.type)) {
              if (!taken || d < taken.d) taken = { by, d, type: b.type };
            } else if (!best || d < best.d) {
              best = { by, d, type: b.type };
            }
          }
          if (!best) best = taken;
          if (loot) {
            // Loot run: go get it, and ignore shooting until it is picked up.
            strafeTargetX = Math.max(10, Math.min(740, loot.x - 25));
            homeY = loot.y;
          } else {
            if (best) {
              aimAt = best;
              claimed.add(best.type);
            } else if (guard) {
              homeY = Math.max(62, Math.min(570, guard.y + spread)); // idle near their lane
            }
            // Back away from an approaching front bullet while still shooting.
            if (front && front.t < 55) strafeTargetX = Math.max(homeX, 700);
          }
        }
      }

      if (aimAt) {
        // Pick a barrel once per target and hold it, so the block doesn't oscillate 65px.
        if (a.aimLower == null || a.aimTargetY == null || Math.abs(a.aimTargetY - aimAt.by) > 16) {
          a.aimLower = Math.abs(aimAt.by - (a.y + 50)) <= Math.abs(aimAt.by - (a.y - 15));
          a.aimTargetY = aimAt.by;
        }
        aimLower = a.aimLower;
        const desiredY = aimAt.by - (aimLower ? 50 : -15);
        const diff = desiredY - a.y;
        if (Math.abs(diff) > 2) moveY = diff > 0 ? 1 : -1;
        else moveY = 0;
      } else {
        a.aimLower = null;
        a.aimTargetY = null;
      }
      // Stay out of the lane until the bullet has fully passed us.
      if ((a.dodgeTtl || 0) > 0) {
        const db = sensed.find((b) => b.type === a.dodgeType);
        const passed = !db || (a.dodgeFromRight ? db.x + db.w <= a.x + 4 : db.x >= a.x + 46);
        if (passed) {
          a.dodgeTtl = 0;
          a.dodgeType = null;
          a.dodgeY = null;
        } else {
          a.dodgeTtl -= 1;
          moveY = a.dodgeDir;
          dodging = true;
          aimAt = null;
          aimLower = null;
        }
      }
      if (moveY < 0 && a.y < 45) moveY = 1;
      else if (moveY > 0 && a.y > 540) moveY = -1;
      if ((a.dodgeTtl || 0) > 0) a.dodgeDir = moveY;

      // Human-like steering: approach a target velocity using the player's 0.2 acceleration.
      const approach = (err, velocity, maxV) => {
        const stop = (velocity * velocity) / 0.4 + 3;
        if (Math.abs(err) <= stop) return 0;
        return Math.sign(err) * Math.min(maxV, Math.abs(err) * 0.4);
      };
      let targetVy;
      if (aimAt) {
        const desiredY = aimAt.by - (aimLower ? 50 : -15);
        targetVy = approach(desiredY - a.y, a.y_change, 4.5);
      } else if (dodging && a.dodgeTargetY != null) {
        targetVy = approach(a.dodgeTargetY - cy, a.y_change, 5.5);
      } else if (moveY !== 0) {
        targetVy = moveY * 5.5;
      } else if (homeY != null) {
        targetVy = approach(homeY - cy, a.y_change, 4.5);
      } else {
        targetVy = approach(300 + spread - cy, a.y_change, 2.5);
      }
      let targetVx;
      if (dodging && a.dodgeTargetX != null) targetVx = approach(a.dodgeTargetX - a.x, a.x_change, 6);
      else if (strafeTargetX != null) targetVx = approach(strafeTargetX - a.x, a.x_change, 4.5);
      else if (moveX !== 0) targetVx = moveX * 4.5;
      else targetVx = approach(homeX - a.x, a.x_change, 3);

      // Never share a square with another helper: push apart when they get close.
      for (let o = 0; o < s.allies.length; o += 1) {
        if (o === slot) continue;
        const other = s.allies[o];
        const dx = cx - (other.x + 25);
        const dy = cy - (other.y + 25);
        if (Math.abs(dx) > 62 || Math.abs(dy) > 62) continue;
        const dist = Math.hypot(dx, dy) || 0.01;
        const push = ((62 - dist) / 62) * 5;
        // perfectly stacked: the lower slot goes up, the higher one goes down
        const ux = dist < 1 ? (o > slot ? -1 : 1) : dx / dist;
        const uy = dist < 1 ? (o > slot ? -1 : 1) : dy / dist;
        targetVx += ux * push;
        targetVy += uy * push;
      }
      targetVx = Math.max(-aiCap, Math.min(aiCap, targetVx));
      targetVy = Math.max(-aiCap, Math.min(aiCap, targetVy));
      const steer = (target, current) => {
        const delta = target - current;
        if (delta > 0.1) return 1;
        if (delta < -0.1) return -1;
        return 0;
      };
      a.accel_x = steer(targetVx, a.x_change) * 0.2;
      a.accel_y = steer(targetVy, a.y_change) * 0.2;
      a.x_change += a.accel_x * moveSpeed;
      a.y_change += a.accel_y * moveSpeed;
      if (Math.abs(a.x_change) > aiCap) a.x_change = Math.sign(a.x_change) * aiCap;
      if (Math.abs(a.y_change) > aiCap) a.y_change = Math.sign(a.y_change) * aiCap;
      if (a.accel_x === 0) a.x_change *= 0.92;
      if (a.accel_y === 0) a.y_change *= 0.92;
      a.x += a.x_change;
      a.y += a.y_change;
      if (a.x < 2) { a.x = 2; a.x_change = Math.max(0, a.x_change); }
      else if (a.x > 749) { a.x = 749; a.x_change = Math.min(0, a.x_change); }
      if (a.y < 37) { a.y = 37; a.y_change = Math.max(0, a.y_change); }
      else if (a.y > 545) { a.y = 545; a.y_change = Math.min(0, a.y_change); }

      // Same two side barrels as a player, alternating; only fire at something in front,
      // and wait until the aligned barrel is on target.
      const aligned = aimAt && aimLower != null
        && Math.abs((a.y + (aimLower ? 50 : -15)) - aimAt.by) <= 18;
      const canShoot = sensed.some((b) => b.x + b.w < a.x + 10);
      if (a.shootCd > 0) a.shootCd -= slowScale * (a.fireBoost > 0 ? BOOST : 1);
      if (a.shootCd <= 0 && canShoot && (!aimAt || aligned)) {
        const lower = a.nextLower;
        a.shots.push({
          x: a.x + 10,
          y: (lower ? a.y + 50 : a.y - 15) + a.y_change,
          lower,
        });
        a.nextLower = !lower;
        a.shootCd = FIRE_EVERY;
      }
      for (const shot of a.shots) shot.x -= 13 * slowScale;
      a.shots = a.shots.filter((shot) => shot.x > -30);

      // same cooldown logic as a player: paused while any ult is active, then a full gap
      const globalActive = s.timeStop > 0 || s.ultWindup > 0 || s.slow > 0 || s.kingWindup > 0;
      const ownUltActive =
        (a.ultType === 'world' && s.timeStopBy === a.id && (s.ultWindup > 0 || s.timeStop > 0))
        || (a.ultType === 'killer' && hasBuff(s.killerBuffs, a.id))
        || (a.ultType === 'd4c' && hasBuff(s.d4cBuffs, a.id))
        || (a.ultType === 'cmoon' && hasBuff(s.cMoonBuffs, a.id));
      if (a.ultCd > 0 && !globalActive && !ownUltActive) a.ultCd -= 1;
      if (a.ultCd <= 0 && !globalActive) {
        let used = true;
        if (a.ultType === 'world') {
          s.ultWindup = ULT_WINDUP_FRAMES;
          s.timeStopBy = a.id;
        } else if (a.ultType === 'killer') {
          addBuff(s.killerBuffs, a.id, KILLER_FRAMES);
        } else if (a.ultType === 'd4c') {
          addBuff(s.d4cBuffs, a.id, D4C_FRAMES);
        } else if (a.ultType === 'cmoon') {
          addBuff(s.cMoonBuffs, a.id, CMOON_FRAMES);
        } else {
          used = false;
        }
        if (used) {
          if (a.ultType !== 'world') {
            io.sfx?.(a.ultType);
            io.sendUltSound?.(a.ultType);
          }
          a.ultCd = ultCooldownFor(a.ultType, s.ultRush);
        }
      }

      for (const shot of a.shots) {
        if (shot.dead) continue;
        const sr = { x: shot.x, y: shot.y, w: 3, h: 15 };
        for (const b of liveBullets()) {
          if (!collide(sr, b.rect)) continue;
          resetBullet(b.type);
          shot.dead = true;
          a.score += 2;
          const cx = b.rect.x + b.rect.w / 2;
          const cy = b.rect.y + b.rect.h / 2;
          const blast = hasBuff(s.killerBuffs, a.id);
          spawnExplosion(s, { x: cx - 1, y: cy - 1, w: 2, h: 2 }, blast);
          io.sendBoom?.(cx, cy, blast);
          sfx('hit');
          if (blast) {
            for (const other of liveBullets()) {
              if (other.type === b.type) continue;
              const ox = other.rect.x + other.rect.w / 2;
              const oy = other.rect.y + other.rect.h / 2;
              if (Math.hypot(ox - cx, oy - cy) <= KILLER_RADIUS) {
                resetBullet(other.type);
                sfx('hit');
              }
            }
          }
          break;
        }
      }
      a.shots = a.shots.filter((shot) => !shot.dead);

      const ar = { x: a.x, y: a.y, w: 50, h: 50 };
      // Power-ups the helper walked over: the same four pickups a player gets.
      if (!stopped && s.powerups.length) {
        const leftForPlayers = [];
        for (const p of s.powerups) {
          if (p.ttl > 0 && collide(ar, { x: p.x, y: p.y, w: POWERUP_SIZE, h: POWERUP_SIZE })) {
            if (p.type === 'speed') a.speedBoost = BOOST_FRAMES;
            else if (p.type === 'fire') a.fireBoost = BOOST_FRAMES;
            else if (p.type === 'slow') s.bulletSlow = Math.max(s.bulletSlow, SLOW_FRAMES);
            else a.hp = Math.min(MAX_LIVES, a.hp + 1);
            io.reportPickup?.(p.id);
            sfx('bounce');
            continue;
          }
          leftForPlayers.push(p);
        }
        s.powerups = leftForPlayers;
      }
      for (const b of liveBullets()) {
        if (destroyed.has(b.type)) continue;
        if (!collide(ar, b.rect)) continue;
        resetBullet(b.type);
        const cx = b.rect.x + b.rect.w / 2;
        const cy = b.rect.y + b.rect.h / 2;
        spawnExplosion(s, { x: cx - 1, y: cy - 1, w: 2, h: 2 });
        io.sendBoom?.(cx, cy, false);
        if (hasBuff(s.cMoonBuffs, a.id)) continue; // C-Moon absorbs the hit
        a.hp -= 1;
        a.flash = 12;
        sfx('ricochet');
        if (a.hp <= 0) break;
      }
      if (a.flash > 0) a.flash -= 1;
    }
    // Last word on stacking: separate any pair that still overlaps after everyone moved.
    // A time stop only lets its own caster move, so that one takes the whole push.
    const canShove = (a) => !stopped || s.timeStopBy === a.id;
    for (let pass = 0; pass < 3; pass += 1) {
      let hit = false;
      for (let i = 0; i < s.allies.length; i += 1) {
        for (let j = i + 1; j < s.allies.length; j += 1) {
          const A = s.allies[i];
          const B = s.allies[j];
          const dx = A.x - B.x;
          const dy = A.y - B.y;
          const ox = 54 - Math.abs(dx);
          const oy = 54 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          const moveA = canShove(A);
          const moveB = canShove(B);
          if (!moveA && !moveB) continue;
          hit = true;
          const share = moveA && moveB ? 0.5 : 1;
          if (ox < oy) {
            const push = (dx === 0 ? 1 : Math.sign(dx)) * ox * share;
            if (moveA) A.x = Math.max(2, Math.min(749, A.x + push));
            if (moveB) B.x = Math.max(2, Math.min(749, B.x - push));
          } else {
            const push = (dy === 0 ? 1 : Math.sign(dy)) * oy * share;
            if (moveA) A.y = Math.max(37, Math.min(545, A.y + push));
            if (moveB) B.y = Math.max(37, Math.min(545, B.y - push));
          }
        }
      }
      if (!hit) break;
    }
    s.allies = s.allies.filter((a) => a.hp > 0);
  }

  // small yellow bursts where shots destroyed enemy bullets
  if (ctx) {
    for (const e of s.explosions) {
      const p = 1 - e.ttl / e.max;
      const r = 5 + (e.size - 5) * p;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      if (e.size > 60) { // Killer Queen blast halo
        ctx.fillStyle = 'rgba(255, 170, 30, 0.16)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 226, 65, 0.95)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.9)';
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 215, 90, 0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * r * 0.75, e.y + Math.sin(a) * r * 0.75);
        ctx.lineTo(e.x + Math.cos(a) * r * 1.25, e.y + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  for (const e of s.explosions) e.ttl -= 1;
  s.explosions = s.explosions.filter((e) => e.ttl > 0);

  // D4C: pink dots orbit the protected player
  if (ctx && d4cOn) drawD4cOrbit(ctx, s.x + 25, s.y + 25, s.d4cAnim);

  // AI helpers, drawn like translucent multiplayer players
  if (ctx) {
    for (const a of s.allies) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = a.color;
      ctx.fillRect(a.x, a.y, 50, 50);
      ctx.globalAlpha = 0.9;
      ctx.font = '12px Poppins, Arial, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`AI · ${a.score || 0}`, a.x + 25, a.y - 6);
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'middle';
      if (images.heart) {
        ctx.drawImage(images.heart, a.x + 16, a.y + 7, 18, 17);
        ctx.font = 'bold 18px Poppins, Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(a.hp), a.x + 25, a.y + 33);
      } else {
        ctx.font = 'bold 20px Poppins, Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(a.hp), a.x + 25, a.y + 25);
      }
      ctx.globalAlpha = 0.4;
      for (const shot of a.shots) {
        if (images.bullet) ctx.drawImage(images.bullet, Math.trunc(shot.x - 5), Math.trunc(shot.y - 1));
        else {
          ctx.fillStyle = shot.lower ? 'rgb(255,223,0)' : '#8a8f98';
          ctx.fillRect(shot.x, shot.y, 3, 15);
        }
      }
      ctx.restore();
      if (hasBuff(s.d4cBuffs, a.id)) drawD4cOrbit(ctx, a.x + 25, a.y + 25, s.d4cAnim);
    }
  }

  // every 50 points adds an icon to the shared map; while any D4C is active it drops every
  // 10 points instead. Only the host (or a single player) creates them, but every player
  // tracks the score step so a host switch doesn't drop a backlog of icons.
  const unit = Math.floor(s.score / POWERUP_STEP);
  if (unit > s.powerupLevel) {
    const from = s.powerupLevel + 1;
    s.powerupLevel = unit;
    if (s.cont && (io.ownsWorld ? io.ownsWorld() : true)) {
      const d4cDrop = s.d4cBuffs.length > 0;
      for (let u = from; u <= unit; u += 1) {
        if (d4cDrop || u % (POWERUP_EVERY / POWERUP_STEP) === 0) spawnPowerup(s);
      }
    }
  }
  if (ctx && s.cont) {
    let hudY = 580;
    if (s.speedBoost > 0) {
      text(ctx, 'bold 18px Arial, sans-serif', `SPEED ${BOOST}x  ${(s.speedBoost / 60).toFixed(1)}s`, [250, 204, 21], 110, hudY);
      hudY -= 24;
    }
    if (s.fireBoost > 0) {
      text(ctx, 'bold 18px Arial, sans-serif', `FIRE ${BOOST}x  ${(s.fireBoost / 60).toFixed(1)}s`, [251, 146, 60], 110, hudY);
      hudY -= 24;
    }
    if (s.bulletSlow > 0) {
      text(ctx, 'bold 18px Arial, sans-serif', `SLOW  ${(s.bulletSlow / 60).toFixed(1)}s`, [56, 189, 248], 110, hudY);
      hudY -= 24;
    }
    const ultLocked = s.timer < ULT_MIN_TIMER;
    const myD4C = s.d4cBuffs.find((b) => b.id === selfId);
    const myKiller = s.killerBuffs.find((b) => b.id === selfId);
    const myCMoon = s.cMoonBuffs.find((b) => b.id === selfId);
    const ultColor = myD4C
      ? [34, 211, 238]
      : myKiller
        ? [244, 114, 182]
        : myCMoon
          ? [167, 139, 250]
          : s.slow > 0 || s.kingWindup > 0
            ? [248, 113, 113]
            : s.timeStop > 0 || s.ultWindup > 0 ? [216, 180, 254] : s.ultCooldown > 0 || ultLocked ? [130, 130, 130] : [250, 204, 21];
    const ultLabel = s.timeStop > 0
      ? `TIME STOP  ${(s.timeStop / 60).toFixed(1)}s`
      : s.ultWindup > 0
        ? `TIME STOP IN  ${(s.ultWindup / 60).toFixed(1)}s`
        : s.slow > 0
          ? `KING CRIMSON  ${(s.slow / 60).toFixed(1)}s`
          : s.kingWindup > 0
            ? `KING CRIMSON IN  ${(s.kingWindup / 60).toFixed(1)}s`
            : myKiller
              ? `KILLER QUEEN  ${(myKiller.frames / 60).toFixed(1)}s`
              : myD4C
                ? `D4C  ${(myD4C.frames / 60).toFixed(1)}s`
                : myCMoon
                  ? `C-MOON  ${(myCMoon.frames / 60).toFixed(1)}s`
                  : ultLocked
                    ? `ULT LOCKED  ${Math.ceil((ULT_MIN_TIMER - s.timer) / 1.2)}s`
                    : s.ultCooldown > 0 ? `ULT  ${Math.ceil(s.ultCooldown / 60)}s`
                      : s.ultType === 'silver'
                        ? 'SC READY [T]'
                        : s.ultType === 'cmoon' ? 'C-MOON READY [T]'
                          : s.ultType === 'd4c' ? 'D4C READY [T]'
                            : s.ultType === 'killer' ? 'KILLER QUEEN READY [T]'
                              : s.ultType === 'king' ? 'KING CRIMSON READY [T]' : 'THE WORLD READY [T]';
    text(ctx, 'bold 18px Arial, sans-serif', ultLabel, ultColor, 680, 580);
  }

  s.death = Math.trunc(pyRound(s.lives));

  if (s.death <= 0) {
    // An AI helper hands over every heart it has left; the healthiest one steps up and dies.
    let savior = null;
    if (!s.remoteKO) {
      for (const a of s.allies) if (a.hp > 0 && (!savior || a.hp > savior.hp)) savior = a;
    }
    if (savior) {
      const given = Math.max(1, Math.min(MAX_LIVES, savior.hp));
      s.allies = s.allies.filter((a) => a.id !== savior.id);
      io.sacrificeAlly?.(savior.id);
      spawnExplosion(s, { x: savior.x + 24, y: savior.y + 24, w: 2, h: 2 }, true);
      io.sendBoom?.(savior.x + 25, savior.y + 25, true);
      sfx('hit');
      s.lives = given;
      s.death = given;
      s.cont = true;
    } else {
      s.cont = false;
    }
  }

  if (s.cont === false) {
    if (music.pause) music.pause(); // keep the offset so an erase can resume it
    else music.stop?.();
    s.rand = 0;
    s.x_enemy = 0;
    s.x_enemy2 = 0;
    s.x_enemy21 = 0;
    s.x_enemy3 = 0;
    s.color = 'grey12';
    s.color2 = 'grey12';
    s.color21 = 'grey12';
    s.color3 = 'grey12';
    s.color4 = 'grey12';
    s.x_warn = 0;
    s.Warn_goto = 0;
    s.end_timer += 0.02;
    const END = pyRound(s.end_timer);
    if (s.end_timer === 0.02) sfx('outro');

    if (END >= 6) s.final_score = 'GAME OVER';
    text(ctx, FONTS.end, String(s.final_score), red, 410, 200);
    if (END >= 15) {
      s.exited = true; // sys.exit(): the window closes before this frame is shown
      return false;
    }

    s.final_score = 'Final score: ' + Math.trunc(s.score);
  }

  // Same hearts as the original, capped at MAX_LIVES by the life power-up.
  const gap = 45;
  for (let h = 0; h < s.death; h += 1) blit(ctx, images.heart, 500 + h * gap, 2);

  blit(ctx, images.bullet, s.new_x - 5, s.new_y - 1); // loaded bullets
  blit(ctx, images.bullet, s.new_x2 - 5, s.new_y2 - 1);
  for (const shot of s.shots) blit(ctx, images.bullet, shot.x - 5, shot.y - 1);

  if (s.hits === true) {
    s.fast += 1;
    if (s.fast % 5 === 0) s.player_color = 'grey12';
    if (s.fast % 10 === 0) s.player_color = [0, 120, 250];

    if (s.fast >= 69) {
      s.hits = false;
      s.player_color = [0, 120, 250];
      s.fast = 0;
    }
  }

  s.shots = s.shots.filter((_, idx) => !spent.has(idx));
  return true; // pygame.display.update()
}
