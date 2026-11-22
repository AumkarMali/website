// Ghost multiplayer for Block dodge over Supabase Realtime (broadcast + presence).
// Everyone plays their own game; each browser sends its block position ~10x a second
// and draws the other players as translucent "ghost" blocks. Nothing is stored.
//
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the anon key is public by design).
// Without them, connect() returns null and the game stays single-player.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CHANNEL = 'blockdodge';
const SEND_MS = 100; // position updates per player: 10 per second
const STALE_MS = 3000; // drop a ghost that has gone quiet
const SMOOTH = 0.25; // per-frame approach to the latest position (hides the 10 Hz steps)
const COLORS = ['#f97316', '#22c55e', '#e879f9', '#facc15', '#38bdf8', '#f43f5e'];

let client = null;
const getClient = () => {
  if (!URL || !KEY) return null;
  if (!client) client = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 20 } } });
  return client;
};

const colorFor = (id) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

/**
 * Joins the shared room. Returns { send(state), draw(ctx), count(), close() } or null.
 * onCount(n) is called with the number of players in the room (including you).
 */
export function connect(name, onCount) {
  const sb = getClient();
  if (!sb) return null;
  const nameOf = typeof name === 'function' ? name : () => name; // read live, so renames apply
  const id = crypto.randomUUID();
  const ghosts = new Map(); // id -> { name, color, x, y, tx, ty, score, alive, seen }
  let lastSent = 0;
  let last = null;

  const channel = sb.channel(CHANNEL, {
    config: { broadcast: { self: false }, presence: { key: id } },
  });

  channel
    .on('broadcast', { event: 'pos' }, ({ payload: p }) => {
      if (!p || p.id === id) return;
      const g = ghosts.get(p.id);
      if (g) Object.assign(g, { name: p.name, tx: p.x, ty: p.y, score: p.score, alive: p.alive, seen: performance.now() });
      else ghosts.set(p.id, { name: p.name, color: colorFor(p.id), x: p.x, y: p.y, tx: p.x, ty: p.y, score: p.score, alive: p.alive, seen: performance.now() });
    })
    .on('presence', { event: 'sync' }, () => {
      const online = channel.presenceState();
      for (const gid of ghosts.keys()) if (!online[gid]) ghosts.delete(gid);
      onCount?.(Object.keys(online).length);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ name: nameOf() });
    });

  return {
    // Called every game frame; sends at most every SEND_MS, plus at once when you die.
    send(s) {
      const now = performance.now();
      const alive = s.cont;
      const changed = !last || last.alive !== alive;
      if (!changed && now - lastSent < SEND_MS) return;
      lastSent = now;
      last = { alive };
      channel.send({
        type: 'broadcast',
        event: 'pos',
        payload: { id, name: nameOf(), x: Math.round(s.x), y: Math.round(s.y), score: Math.trunc(s.score), alive },
      });
    },
    // Draws the other players on top of the game frame.
    draw(ctx) {
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
        ctx.globalAlpha = g.alive ? 0.45 : 0.15;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, 50, 50);
        ctx.globalAlpha = g.alive ? 0.9 : 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${g.name} · ${g.score}`, g.x + 25, g.y - 6);
      }
      ctx.restore();
    },
    count: () => ghosts.size + 1,
    close() {
      channel.untrack();
      sb.removeChannel(channel);
    },
  };
}
