// Shared-game multiplayer for Block dodge over Supabase Realtime (broadcast + presence).
//
// Everyone in the room plays the same game. The host (the living player who joined first)
// runs the enemy bullets and the level clock and broadcasts them ~15 times a second; the
// others adopt them. When a guest is hit by, or shoots down, an enemy bullet it tells the
// host, who resets that bullet for everyone. Each player also broadcasts its block and its
// own shots, drawn translucent on everyone else's screen. Lives and score are per player.
// When any player dies, the game ends for everyone in it.
//
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the publishable key is public).
import { createClient } from '@supabase/supabase-js';
import { BULLET_KEYS, getWorld } from './blockDodge';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHANNEL = 'blockdodge';
const POS_MS = 100; // player position + shots: 10 per second
const WORLD_MS = 66; // host's bullets + clock: ~15 per second
const STALE_MS = 3000; // drop a ghost that has gone quiet
const HIT_HOLD_MS = 350; // a guest keeps its own copy of a bullet it just hit, until the host's reset arrives
const SMOOTH = 0.25; // per-frame approach to a ghost's latest position (hides the 10 Hz steps)
const SHOT_SPEED = 13; // matches the game: shots move 13 px per frame
const MAX_SHOTS = 24;
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
      if (g) Object.assign(g, { name: p.name, tx: p.x, ty: p.y, score: p.score, alive: p.alive, shots, seen: now });
      else ghosts.set(p.id, { name: p.name, color: colorFor(p.id), x: p.x, y: p.y, tx: p.x, ty: p.y, score: p.score, alive: p.alive, shots, seen: now });
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

    report(bullet) {
      if (isHost() || !synced) return;
      holds.set(bullet, performance.now() + HIT_HOLD_MS);
      channel.send({ type: 'broadcast', event: 'hit', payload: { bullet } });
    },

    targetY(s) {
      const ys = [];
      if (s.cont) ys.push(s.y);
      for (const g of ghosts.values()) if (g.alive) ys.push(g.ty);
      return ys.length ? ys[Math.floor(Math.random() * ys.length)] : s.y;
    },

    draw(ctx, images = {}) {
      const now = performance.now();
      ctx.save();
      ctx.font = '12px Poppins, Arial, sans-serif';
      ctx.textAlign = 'center';
      for (const [gid, g] of ghosts) {
        if (now - g.seen > STALE_MS) {
          ghosts.delete(gid);
          continue;
        }
        g.x += (g.tx - g.x) * SMOOTH;
        g.y += (g.ty - g.y) * SMOOTH;
        // their shots keep flying between updates
        ctx.globalAlpha = 0.4;
        for (const shot of g.shots) {
          shot.x -= SHOT_SPEED;
          if (images.bullet) ctx.drawImage(images.bullet, Math.trunc(shot.x - 5), Math.trunc(shot.y - 1));
          else {
            ctx.fillStyle = g.color;
            ctx.fillRect(shot.x, shot.y, 3, 15);
          }
        }
        g.shots = g.shots.filter((shot) => shot.x > -60);
        ctx.globalAlpha = g.alive ? 0.45 : 0.15;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, 50, 50);
        ctx.globalAlpha = g.alive ? 0.9 : 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${g.name} · ${g.score}`, g.x + 25, g.y - 6);
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
