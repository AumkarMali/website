// Shared-game multiplayer for Block dodge over Supabase Realtime (broadcast + presence).
//
// Everyone in the room plays the same game. The host (the living player who joined first)
// runs the enemy bullets and the level clock and broadcasts them ~15 times a second; the
// others adopt them. When a guest is hit by, or shoots down, an enemy bullet it tells the
// host, who resets that bullet for everyone. Each player also broadcasts its block and its
// own shots, drawn translucent on everyone else's screen. Lives and score are per player.
// Power-up icons are shared: any multiple of 50 points (from any player) drops one on the
// map, and whoever touches it first gets the boost. The ultimate (T) depends on the pick:
// The World runs a 2 s windup then freezes everything for 10 s; King Crimson slows the world
// to 25% for 10 s, puts the other players on a random walk, and only its user moves at full
// speed. Its user can press T again to erase the remaining future and roll the world and every
// player back to the exact state when it was activated. The host owns both clocks. When any
// player dies, the game ends for everyone in it.
//
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the publishable key is public).
import { createClient } from '@supabase/supabase-js';
import { BULLET_KEYS, getWorld, spawnPowerup, ULT_WINDUP_FRAMES, KING_WINDUP_FRAMES, KILLER_FRAMES, D4C_FRAMES, CMOON_FRAMES, SLOW_FRAMES, ULT_MIN_TIMER, saveKingSnapshot, eraseKing, drawD4cOrbit } from './blockDodge';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHANNEL = 'blockdodge';
const POS_MS = 100; // player position + shots: 10 per second
const WORLD_MS = 66; // host's bullets + clock: ~15 per second
const STALE_MS = 3000; // drop a ghost that has gone quiet
const HIT_HOLD_MS = 350; // a guest keeps its own copy of a bullet it just hit, until the host's reset arrives
const PICKUP_HOLD_MS = 3000; // a guest ignores a power-up it just took while the host removes it
const POWERUP_EVERY = 50;
const SMOOTH = 0.25; // per-frame approach to a ghost's latest position (hides the 10 Hz steps)
const SHOT_SPEED = 13; // matches the game: shots move 13 px per frame
const KING_SLOW = 0.25; // King Crimson: everything but the user moves at 25%
const MAX_SHOTS = 24;
const addBuff = (list, id, frames) => {
  if (!list.some((b) => b.id === id)) list.push({ id, frames });
};
const COLORS = ['#f97316', '#22c55e', '#e879f9', '#facc15', '#38bdf8', '#f43f5e'];

let client = null;
const getClient = () => {
  if (!URL || !KEY) return null;
  if (!client) client = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 40 } } });
  return client;
};

const colorFor = (id) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

/**
 * Joins the shared game. Returns an object the game loop uses, or null without config:
 *   tick(state)        after each frame: send position/shots, and the world if host
 *   takeWorld()        guest: latest host world to apply (or null)
 *   takeEvents()       host: bullets other players hit since last frame
 *   report(bullet)     guest: you hit / shot this bullet
 *   targetY(state)     host: y of a random living player, for aiming new bullets
 *   draw(ctx, images)  other players' blocks and shots, translucent
 *   close()
 * onCount(n) gets the number of players in the room (including you).
 */
export function connect(name, onCount) {
  const sb = getClient();
  if (!sb) return null;
  const nameOf = typeof name === 'function' ? name : () => name;
  const id = crypto.randomUUID();
  const joinedAt = Date.now();
  const ghosts = new Map(); // id -> { name, color, x, y, tx, ty, score, alive, shots, seen }
  let synced = false; // seen ourselves in presence, so the host choice is meaningful
  let alive = true;
  let lastPos = 0;
  let lastWorld = 0;
  let pendingWorld = null;
  let worldFrom = null; // host id of pendingWorld
  const events = [];
  const booms = []; // explosions from other players' Killer Queen shots
  const ultSounds = []; // other players' Killer Queen / D4C activation clips
  const pickups = []; // host: power-up ids other players took since last frame
  const ultRequests = []; // host: player ids who pressed T since last frame
  const eraseRequests = []; // host: King Crimson users who pressed T again to cancel
  const taken = new Map(); // guest: power-up id -> hold-until time
  let gameOver = false; // another player died
  const holds = new Map(); // bullet -> hold-until time

  const channel = sb.channel(CHANNEL, {
    config: { broadcast: { self: false }, presence: { key: id } },
  });

  const hostId = () => {
    let best = null;
    for (const [pid, metas] of Object.entries(channel.presenceState())) {
      const m = metas[metas.length - 1];
      if (!m?.alive) continue;
      if (!best || m.joinedAt < best.joinedAt || (m.joinedAt === best.joinedAt && pid < best.id)) {
        best = { id: pid, joinedAt: m.joinedAt };
      }
    }
    return best?.id ?? null;
  };
  const isHost = () => synced && alive && hostId() === id;

  channel
    .on('broadcast', { event: 'pos' }, ({ payload: p }) => {
      if (!p || p.id === id) return;
      const now = performance.now();
      const g = ghosts.get(p.id);
      const shots = (p.shots || []).map(([x, y]) => ({ x, y }));
      if (g) Object.assign(g, { name: p.name, tx: p.x, ty: p.y, score: p.score, hearts: p.hearts ?? 3, alive: p.alive, shots, seen: now });
      else ghosts.set(p.id, { name: p.name, color: colorFor(p.id), x: p.x, y: p.y, tx: p.x, ty: p.y, score: p.score, hearts: p.hearts ?? 3, alive: p.alive, level: Math.floor((p.score || 0) / POWERUP_EVERY), shots, seen: now });
    })
    .on('broadcast', { event: 'world' }, ({ payload: p }) => {
      if (!p || p.from === id || p.from !== hostId()) return; // only the current host's world counts
      pendingWorld = p.world;
      worldFrom = p.from;
    })
    .on('broadcast', { event: 'gameover' }, () => {
      gameOver = true;
    })
    .on('broadcast', { event: 'hit' }, ({ payload: p }) => {
      if (p && isHost() && BULLET_KEYS[p.bullet]) events.push(p.bullet);
    })
    .on('broadcast', { event: 'pickup' }, ({ payload: p }) => {
      if (p?.powerupId && isHost()) pickups.push(p.powerupId);
    })
    .on('broadcast', { event: 'boom' }, ({ payload: p }) => {
      if (typeof p?.x === 'number' && typeof p?.y === 'number') booms.push({ x: p.x, y: p.y, big: !!p.big });
    })
    .on('broadcast', { event: 'ultsound' }, ({ payload: p }) => {
      if (p?.type === 'killer' || p?.type === 'd4c' || p?.type === 'cmoon') ultSounds.push(p.type);
    })
    .on('broadcast', { event: 'ult' }, ({ payload: p }) => {
      if (p?.from && isHost()) ultRequests.push({ id: p.from, type: p.type });
    })
    .on('broadcast', { event: 'erase' }, ({ payload: p }) => {
      if (p?.from && isHost()) eraseRequests.push(p.from);
    })
    .on('presence', { event: 'sync' }, () => {
      const online = channel.presenceState();
      if (online[id]) synced = true;
      for (const gid of ghosts.keys()) if (!online[gid]) ghosts.delete(gid);
      onCount?.(Object.keys(online).length);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ name: nameOf(), joinedAt, alive: true });
    });

  return {
    tick(s) {
      const now = performance.now();
      if (s.cont !== alive) {
        alive = s.cont;
        channel.track({ name: nameOf(), joinedAt, alive });
        if (!alive) channel.send({ type: 'broadcast', event: 'gameover', payload: { from: id } });
      }
      // The host owns the shared power-up map: drop the ones other players took, and spawn
      // an icon whenever any player's score crosses a multiple of 50.
      if (pickups.length && isHost()) {
        const gone = new Set(pickups.splice(0));
        for (const p of s.powerups || []) {
          if (gone.has(p.id) && p.type === 'slow') s.bulletSlow = Math.max(s.bulletSlow || 0, SLOW_FRAMES);
        }
        s.powerups = (s.powerups || []).filter((p) => !gone.has(p.id));
      }
      if (ultRequests.length && isHost()) {
        for (const req of ultRequests.splice(0)) {
          if (s.timeStop > 0 || s.ultWindup > 0 || s.slow > 0 || s.kingWindup > 0 || s.timer < ULT_MIN_TIMER) break;
          if (req.type === 'cmoon') {
            addBuff(s.cMoonBuffs, req.id, CMOON_FRAMES);
          } else if (req.type === 'd4c') {
            addBuff(s.d4cBuffs, req.id, D4C_FRAMES);
          } else if (req.type === 'killer') {
            addBuff(s.killerBuffs, req.id, KILLER_FRAMES);
          } else if (req.type === 'king') {
            saveKingSnapshot(s);
            s.kingWindup = KING_WINDUP_FRAMES;
            s.slowBy = req.id;
          } else {
            s.ultWindup = ULT_WINDUP_FRAMES;
            s.timeStopBy = req.id;
          }
        }
      }
      if (eraseRequests.length && isHost()) {
        for (const uid of eraseRequests.splice(0)) {
          if (s.slow > 0 && s.slowBy === uid) eraseKing(s);
        }
      }
      for (const g of ghosts.values()) {
        const level = Math.floor((g.score || 0) / POWERUP_EVERY);
        if (level > g.level) {
          if (isHost()) for (let i = g.level; i < level; i += 1) spawnPowerup(s);
          g.level = level;
        }
      }
      if (now - lastPos >= POS_MS) {
        lastPos = now;
        channel.send({
          type: 'broadcast',
          event: 'pos',
          payload: {
            id,
            name: nameOf(),
            x: Math.round(s.x),
            y: Math.round(s.y),
            score: Math.trunc(s.score),
            hearts: Math.max(0, s.death),
            alive,
            shots: s.shots.slice(-MAX_SHOTS).map((b) => [Math.round(b.x), Math.round(b.y)]),
          },
        });
      }
      if (isHost() && now - lastWorld >= WORLD_MS) {
        lastWorld = now;
        channel.send({ type: 'broadcast', event: 'world', payload: { from: id, world: getWorld(s) } });
      }
    },

    takeWorld() {
      if (isHost() || !pendingWorld || worldFrom !== hostId()) return null;
      const w = { ...pendingWorld };
      pendingWorld = null;
      const now = performance.now();
      for (const [bullet, until] of holds) {
        if (now > until) holds.delete(bullet);
        else for (const k of BULLET_KEYS[bullet]) delete w[k];
      }
      for (const [pid, until] of taken) if (now > until) taken.delete(pid);
      if (w.powerups && taken.size) w.powerups = w.powerups.filter((p) => !taken.has(p.id));
      return w;
    },

    takeGameOver() {
      const g = gameOver;
      gameOver = false;
      return g;
    },

    takeEvents() {
      return events.splice(0);
    },

    takeBooms() {
      return booms.splice(0);
    },

    takeUltSounds() {
      return ultSounds.splice(0);
    },

    sendUltSound(type) {
      if (!synced) return;
      channel.send({ type: 'broadcast', event: 'ultsound', payload: { from: id, type } });
    },

    sendBoom(x, y, big) {
      if (!synced) return;
      channel.send({ type: 'broadcast', event: 'boom', payload: { from: id, x, y, big: !!big } });
    },

    report(bullet) {
      if (isHost() || !synced) return;
      holds.set(bullet, performance.now() + HIT_HOLD_MS);
      channel.send({ type: 'broadcast', event: 'hit', payload: { bullet } });
    },

    reportPickup(powerupId) {
      if (isHost() || !synced) return;
      taken.set(powerupId, performance.now() + PICKUP_HOLD_MS);
      channel.send({ type: 'broadcast', event: 'pickup', payload: { powerupId } });
    },

    startUlt(s, type) {
      if (isHost()) {
        if (s.timeStop > 0 || s.ultWindup > 0 || s.slow > 0 || s.kingWindup > 0 || s.timer < ULT_MIN_TIMER) return true;
        if (type === 'cmoon') {
          addBuff(s.cMoonBuffs, id, CMOON_FRAMES);
        } else if (type === 'd4c') {
          addBuff(s.d4cBuffs, id, D4C_FRAMES);
        } else if (type === 'killer') {
          addBuff(s.killerBuffs, id, KILLER_FRAMES);
        } else if (type === 'king') {
          saveKingSnapshot(s);
          s.kingWindup = KING_WINDUP_FRAMES;
          s.slowBy = id;
        } else {
          s.ultWindup = ULT_WINDUP_FRAMES;
          s.timeStopBy = id;
        }
        return true;
      }
      if (!synced) return false;
      channel.send({ type: 'broadcast', event: 'ult', payload: { from: id, type } });
      return true;
    },

    isUlter(s) {
      return s.timeStopBy === id;
    },

    isSlowUlter(s) {
      return s.slowBy === id;
    },

    cancelUlt(s) {
      if (isHost()) {
        if (s.slow > 0 && s.slowBy === id) eraseKing(s);
        return true;
      }
      if (!synced) return false;
      channel.send({ type: 'broadcast', event: 'erase', payload: { from: id } });
      return true;
    },

    playerId() {
      return id;
    },

    isSynced() {
      return synced;
    },

    targetY(s) {
      // D4C: never aim a bullet at any player it is protecting.
      const avoid = new Set((s.d4cBuffs || []).map((b) => b.id));
      const ys = [];
      if (s.cont && !avoid.has(id)) ys.push(s.y);
      for (const [gid, g] of ghosts) if (g.alive && !avoid.has(gid)) ys.push(g.ty);
      if (ys.length) return ys[Math.floor(Math.random() * ys.length)];
      if (avoid.has(id)) {
        let y = 30 + Math.random() * 510;
        if (Math.abs(y - s.y) < 120) y = s.y > 300 ? 30 + Math.random() * 200 : 400 + Math.random() * 140;
        return y;
      }
      return s.y;
    },

    buffTarget(s, buffId) {
      if (buffId === id) return { x: s.x + 25, y: s.y + 25 };
      const g = ghosts.get(buffId);
      return g ? { x: g.x + 25, y: g.y + 25 } : null;
    },

    draw(ctx, images = {}, state = null) {
      const now = performance.now();
      const stopped = (state?.timeStop ?? 0) > 0;
      const stopper = state?.timeStopBy ?? null;
      const king = (state?.slow ?? 0) > 0;
      const kingBy = state?.slowBy ?? null;
      const d4cIds = new Set(((state?.d4cBuffs) || []).map((b) => b.id));
      const d4cAnim = state?.d4cAnim ?? 0;
      ctx.save();
      ctx.font = '12px Poppins, Arial, sans-serif';
      ctx.textAlign = 'center';
      for (const [gid, g] of ghosts) {
        if (now - g.seen > STALE_MS) {
          ghosts.delete(gid);
          continue;
        }
        // during a time stop everyone but the player who used it stands still
        const frozenGhost = stopped && gid !== stopper;
        const slowGhost = king && gid !== kingBy;
        if (!frozenGhost) {
          g.x += (g.tx - g.x) * SMOOTH;
          g.y += (g.ty - g.y) * SMOOTH;
        }
        // their shots keep flying between updates, unless time is stopped
        ctx.globalAlpha = frozenGhost ? 0.25 : 0.4;
        for (const shot of g.shots) {
          if (!frozenGhost) shot.x -= SHOT_SPEED * (slowGhost ? KING_SLOW : 1);
          if (images.bullet) ctx.drawImage(images.bullet, Math.trunc(shot.x - 5), Math.trunc(shot.y - 1));
          else {
            ctx.fillStyle = g.color;
            ctx.fillRect(shot.x, shot.y, 3, 15);
          }
        }
        g.shots = g.shots.filter((shot) => shot.x > -60);
        ctx.globalAlpha = frozenGhost ? 0.2 : g.alive ? 0.45 : 0.15;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, 50, 50);
        ctx.globalAlpha = frozenGhost ? 0.5 : g.alive ? 0.9 : 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${g.name} · ${g.score}`, g.x + 25, g.y - 6);
        // heart count in the middle of the square, visible to everyone
        const hx = g.x + 25;
        const hy = g.y + 25;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (images.heart) {
          ctx.drawImage(images.heart, hx - 9, hy - 18, 18, 17);
          ctx.font = 'bold 18px Poppins, Arial, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(g.hearts ?? 3), hx, hy + 8);
        } else {
          ctx.font = 'bold 20px Poppins, Arial, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(g.hearts ?? 3), hx, hy);
        }
        ctx.restore();
        if (d4cIds.has(gid)) drawD4cOrbit(ctx, g.x + 25, g.y + 25, d4cAnim);
      }
      ctx.restore();
    },

    isHost,
    close() {
      channel.untrack();
      sb.removeChannel(channel);
    },
  };
}
