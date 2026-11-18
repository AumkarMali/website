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
const SNIPER_SPEED = 0.7; // sniper bullets move 30% slower than in the original

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
const purple = [99, 20, 255];
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

export function createState() {
  return {
    player_color: [0, 120, 250],
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
    shots: [], // fired bullets: {x, y, lower}
    nextLower: true, // barrel for the next shot
    fHeld: false,
    arrows: { left: 0, right: 0, up: 0, down: 0 }, // press order of held arrows, 0 = up
    arrowSeq: 0,
    fireTimer: 0, // frames until the next held-F shot
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

// One bullet from the next barrel (the y offsets are the original const1/const2).
function fire(s, sfx) {
  sfx('fire');
  const lower = s.nextLower;
  s.shots.push({ x: s.x + 10, y: lower ? s.y + 50 + s.y_change : s.y - 15 + s.y_change, lower });
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

/**
 * One frame.
 * @param s       state from createState()
 * @param events  [{type: 'keydown'|'keyup', key: 'left'|'right'|'up'|'down'|'f'}] for this frame
 * @param io      { ctx?, images?: {heart, bullet}, rng, sfx?(name), music?: {play(), stop(), volume(v)} }
 */
export function step(s, events, io) {
  const { ctx = null, images = {}, rng = mathRandomRng } = io;
  const sfx = io.sfx || (() => {});
  const music = io.music || { play() {}, stop() {}, volume() {} };

  for (const event of events) {
    if (event.type === 'keydown') {
      if (event.key in s.arrows) s.arrows[event.key] = ++s.arrowSeq;
      if (event.key === 'left') s.accel_x = -0.2;
      if (event.key === 'right') s.accel_x = 0.2;
      if (event.key === 'up') s.accel_y = -0.2;
      if (event.key === 'down') s.accel_y = 0.2;

      if (event.key === 'f') {
        s.fHeld = true;
        fire(s, sfx);
      }
    } else if (event.type === 'keyup') {
      if (event.key in s.arrows) {
        s.arrows[event.key] = 0;
        const { left, right, up, down } = s.arrows;
        s.accel_x = left || right ? (left > right ? -0.2 : 0.2) : 0;
        s.accel_y = up || down ? (up > down ? -0.2 : 0.2) : 0;
      }
      if (event.key === 'f') s.fHeld = false;
    }
  }

  if (s.fHeld && !s.firedThisFrame) {
    s.fireTimer -= 1;
    if (s.fireTimer <= 0) fire(s, sfx);
  }
  s.firedThisFrame = false;
  for (const shot of s.shots) shot.x -= 13;
  s.shots = s.shots.filter((shot) => shot.x > -60);
  s.new_x = s.x + 10;
  s.new_y = s.y + 50;
  s.new_x2 = s.x + 10;
  s.new_y2 = s.y - 15;

  music.volume(s.fade_in);
  s.fade_in += 0.0017;
  s.timer += 0.02;
  const levels = pyRound(s.timer);

  const x_round = pyRound(s.x_change);

  if (ctx) {
    ctx.fillStyle = css(grey12);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (s.cont === true) {
    text(ctx, FONTS.score, 'Score: ' + s.score, green, 700, 20);
    text(ctx, FONTS.lives, "Live's ", orange, 455, 22.5);
    text(ctx, FONTS.bullets, s.bullet_types, purple, 190, 19.8);
  }

  if (levels <= 7) {
    if (levels >= 1) {
      s.intro_timer += 0.006;
      const intro_queue = pyRound(s.intro_timer);
      text(ctx, FONTS.intro, 'Game starting in: ' + (3 - intro_queue), peach, 400, 160);
    }
  }

  if (levels <= 4) music.play();

  s.x_change += s.accel_x;
  s.y_change += s.accel_y;

  if (Math.abs(s.x_change) >= max_speed) s.x_change = (s.x_change / Math.abs(s.x_change)) * max_speed;
  if (Math.abs(s.y_change) >= max_speed) s.y_change = (s.y_change / Math.abs(s.y_change)) * max_speed;
  if (s.enemy_accel >= 14) s.enemy_accel = (s.enemy_accel / s.enemy_accel) * 14;
  if (s.enemy_accel2 >= 12) s.enemy_accel2 = (s.enemy_accel2 / s.enemy_accel2) * 12;
  if (s.enemy_accel3 >= 18) s.enemy_accel3 = (s.enemy_accel3 / s.enemy_accel3) * 18;
  if (s.fade_in >= 1.3) s.fade_in = (s.fade_in / s.fade_in) * 1.3;

  if (s.accel_x === 0) s.x_change *= 0.92;
  if (s.accel_y === 0) s.y_change *= 0.92;

  s.x += s.x_change;
  s.y += s.y_change;

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

  const bullet = drawRect(ctx, s.color, s.x_enemy, s.rand, s.bulletW, s.bulletH);
  const bullet2 = drawRect(ctx, s.color2, s.x_enemy2, s.rand2, 20, 15);
  const bullet21 = drawRect(ctx, s.color21, s.x_enemy21, s.rand21, 20, 15);
  const bullet3 = drawRect(ctx, s.color3, s.x_enemy3, s.rand3, 20, 7);
  drawRect(ctx, s.color4, s.Warn_goto, s.x_warn, 30, 30); // warning

  if (collide(sprite, wall1)) {
    s.x_change += 400;
    sfx('bounce');
  }
  if (collide(sprite, wall2)) {
    s.x_change -= 400;
    sfx('bounce');
  }

  if (collide(sprite, wall3)) {
    s.y_change += 400;
    sfx('bounce');
  }
  if (collide(sprite, wall4)) {
    s.y_change -= 400;
    sfx('bounce');
  }

  s.enemy_accel += 0.001;
  s.x_enemy += s.enemy_accel;

  s.x_enemy3 += 0.01;

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

    const gen = rng.randrange(-50, 50);
    s.rand = s.y + gen;
    if (s.y >= 520) s.rand -= 30;
    if (s.y <= 60) s.rand += 30;

    if (s.count >= 2) s.score += 1;
  }
  if (collide(bullet, sprite) && s.cont === true) {
    s.x_enemy = 0;
    s.x_change += 40;
    s.lives -= 1;
    s.rand = rng.randint(30, 540);
    sfx('ricochet');
    s.hits = true;
  }
  if (s.cont === true && shotHits(bullet)) {
    const gen = rng.randrange(-50, 50);
    s.rand = s.y + gen;
    if (s.y >= 520) s.rand -= 30;
    if (s.y <= 60) s.rand += 30;
    sfx('hit');
    s.x_enemy = 0;
    s.score += 2;
  }

  if (levels >= 30 && s.cont === true) {
    s.enemy_accel2 += 0.0001;
    s.x_enemy2 += s.enemy_accel2;
    s.x_enemy21 -= s.enemy_accel2;
    s.bullet_types = 'Bullets: Normal, Shotgun';

    if (collide(bullet2, wall2)) {
      s.x_enemy2 = 0;
      s.rand2 = rng.randint(30, 540);
      s.color2 = 'yellow';
      s.score += 1;
    }
    if (collide(bullet2, sprite)) {
      s.x_enemy2 = 0;
      s.x_change += 40;
      s.lives -= 1;
      s.rand2 = rng.randint(30, 540);
      sfx('ricochet');
      s.hits = true;
    }
    if (shotHits(bullet2)) {
      s.x_enemy2 = 0;
      s.x_change += 40;
      s.rand2 = rng.randint(30, 540);
      sfx('hit');
    }

    if (collide(bullet21, wall1)) {
      s.x_enemy21 = 780;
      s.rand21 = rng.randint(30, 540);
      s.color21 = 'yellow';
      s.score += 1;
    }
    if (collide(bullet21, sprite)) {
      s.x_enemy21 = 780;
      s.x_change -= 40;
      s.lives -= 1;
      s.rand21 = rng.randint(30, 540);
      sfx('ricochet');
      s.hits = true;
    }
    if (shotHits(bullet21)) {
      s.x_enemy21 = 780;
      s.rand21 = rng.randint(30, 540);
      sfx('hit');
    }
  }

  if (levels >= 59 && s.cont === true) {
    s.enemy_accel3 += 0.07;
    s.x_enemy3 += s.enemy_accel3 * SNIPER_SPEED;
    s.Warn_goto = 0;
    s.bullet_types = 'Bullets: Normal, Shotgun, Sniper';

    if (collide(bullet3, wall2)) {
      s.x_enemy3 = 0;
      s.x_warn = s.y;
      s.rand3 = s.x_warn + 11;
      s.color3 = 'red';
      s.color4 = 'red';
      s.score += 1;
    }

    if (collide(bullet3, sprite)) {
      s.x_change += 40;
      s.lives -= 1;
      s.rand3 = s.x_warn + 11;
      s.x_enemy3 = 0;
      sfx('ricochet');
      s.hits = true;
    }
    if (shotHits(bullet3)) {
      s.rand3 = s.x_warn + 11;
      s.x_enemy3 = 0;
      sfx('hit');
    }
  }

  s.death = Math.trunc(pyRound(s.lives));

  if (s.death <= 0) s.cont = false;

  if (s.cont === false) {
    music.stop();
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

  if (s.death === 3) {
    blit(ctx, images.heart, 500, 2);
    blit(ctx, images.heart, 545, 2);
    blit(ctx, images.heart, 590, 2);
  } else if (s.death === 2) {
    blit(ctx, images.heart, 500, 2);
    blit(ctx, images.heart, 545, 2);
  } else if (s.death === 1) {
    blit(ctx, images.heart, 500, 2);
  }

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
