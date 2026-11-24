import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Users, X } from 'lucide-react';
import { createState, step, FPS, WIDTH, HEIGHT, drawUltOverlay } from '../game/blockDodge';
import { setGameActive } from '../game/activity';
// Supabase is only downloaded when the game opens, and only if it's configured.
const MULTIPLAYER = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const NAME_KEY = 'blockdodge-name';
const cleanName = (n) => n.replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 16).trim();

const SOUNDS = ['countdown', 'bounce', 'fire', 'hit', 'ricochet', 'outro'];
const MAX_CHANNELS = 8; // pygame.mixer default; Sound.play() is silent when all are busy
// fire.mp3 is 1.9 s: 0.27 s of silence, the bang, then a long tail. Rapid fire plays only
// the bang, outside the channel pool, so shots are instant and don't pile up.
const FIRE_CLIP = { offset: 0.26, length: 0.18, fade: 0.05 };
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyF: 'f', KeyT: 't' };

function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ac = new Ctx();
  const buffers = {};
  const active = new Set();
  const musicGain = ac.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(ac.destination);
  // the ultimate clip runs through its own gain: 20x the original volume
  const ultGain = ac.createGain();
  ultGain.gain.value = 20;
  ultGain.connect(ac.destination);
  let ultBuffer = null;
  let ultSource = null;
  // King Crimson's scream plays before the slow starts, 10x the source volume
  const kingGain = ac.createGain();
  kingGain.gain.value = 10;
  kingGain.connect(ac.destination);
  let kingBuffer = null;
  let kingSource = null;
  // Killer Queen's line plays when its buff starts
  const killerGain = ac.createGain();
  killerGain.gain.value = 20;
  killerGain.connect(ac.destination);
  let killerBuffer = null;
  let killerSource = null;
  // D4C's line plays instantly when its buff starts
  const d4cGain = ac.createGain();
  d4cGain.gain.value = 1;
  d4cGain.connect(ac.destination);
  let d4cBuffer = null;
  let d4cSource = null;
  // C-Moon's summon
  const cmoonGain = ac.createGain();
  cmoonGain.gain.value = 20;
  cmoonGain.connect(ac.destination);
  let cmoonBuffer = null;
  let cmoonSource = null;
  // Silver Chariot's summon
  const silverGain = ac.createGain();
  silverGain.gain.value = 1;
  silverGain.connect(ac.destination);
  let silverBuffer = null;
  let silverSource = null;
  let musicSource = null;
  // the shot-hit explosion is 3x, while the shoot sound is halved (it was too loud)
  const hitGain = ac.createGain();
  hitGain.gain.value = 3;
  hitGain.connect(ac.destination);
  let musicStartedAt = null; // ac time of the last mixer.music.play()
  let musicPausedAt = null; // seconds into the track when paused (time stop)

  const load = (name) =>
    fetch(`/game/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ac.decodeAudioData(b))
      .then((buf) => { buffers[name] = buf; })
      .catch(() => {});

  const stopMusic = () => {
    if (musicSource) {
      try { musicSource.stop(); } catch { /* already stopped */ }
      musicSource = null;
    }
  };
  const startMusic = (offset) => {
    stopMusic();
    musicSource = ac.createBufferSource();
    musicSource.buffer = buffers.music;
    musicSource.connect(musicGain);
    musicSource.start(0, offset);
  };

  const ready = Promise.all(SOUNDS.map(load));
  fetch('/game/timestop.m4a')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { ultBuffer = buf; })
    .catch(() => {});
  fetch('/game/kingcrimson.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { kingBuffer = buf; })
    .catch(() => {});
  fetch('/game/killerqueen.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { killerBuffer = buf; })
    .catch(() => {});
  fetch('/game/d4c.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { d4cBuffer = buf; })
    .catch(() => {});
  fetch('/game/cmoon.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { cmoonBuffer = buf; })
    .catch(() => {});
  fetch('/game/silver.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ac.decodeAudioData(b))
    .then((buf) => { silverBuffer = buf; })
    .catch(() => {});
  // The music file is large; if it decodes late, join at the right position.
  load('music').then(() => {
    if (musicStartedAt !== null && buffers.music) startMusic(Math.max(0, ac.currentTime - musicStartedAt));
  });

  return {
    ready,
    resume: () => ac.resume().catch(() => {}),
    stopUlt: () => {
      try { ultSource?.stop(); } catch { /* ended */ }
      try { kingSource?.stop(); } catch { /* ended */ }
      try { killerSource?.stop(); } catch { /* ended */ }
      try { d4cSource?.stop(); } catch { /* ended */ }
      try { cmoonSource?.stop(); } catch { /* ended */ }
      try { silverSource?.stop(); } catch { /* ended */ }
      ultSource = null;
      kingSource = null;
      killerSource = null;
      d4cSource = null;
      cmoonSource = null;
      silverSource = null;
    },
    sfx(name) {
      if (name === 'silver') {
        if (!silverBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = silverBuffer;
        src.connect(silverGain);
        src.onended = () => { if (silverSource === src) silverSource = null; };
        silverSource = src;
        src.start();
        return;
      }
      if (name === 'cmoon') {
        if (!cmoonBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = cmoonBuffer;
        src.connect(cmoonGain);
        src.onended = () => { if (cmoonSource === src) cmoonSource = null; };
        cmoonSource = src;
        src.start();
        return;
      }
      if (name === 'd4c') {
        if (!d4cBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = d4cBuffer;
        src.connect(d4cGain);
        src.onended = () => { if (d4cSource === src) d4cSource = null; };
        d4cSource = src;
        src.start();
        return;
      }
      if (name === 'killer') {
        if (!killerBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = killerBuffer;
        src.connect(killerGain);
        src.onended = () => { if (killerSource === src) killerSource = null; };
        killerSource = src;
        src.start();
        return;
      }
      if (name === 'king') {
        if (!kingBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = kingBuffer;
        src.connect(kingGain);
        src.onended = () => { if (kingSource === src) kingSource = null; };
        kingSource = src;
        src.start();
        return;
      }
      if (name === 'ult') {
        if (!ultBuffer) return;
        const src = ac.createBufferSource();
        src.buffer = ultBuffer;
        src.connect(ultGain);
        src.onended = () => { if (ultSource === src) ultSource = null; };
        ultSource = src;
        src.start();
        return;
      }
      const buf = buffers[name];
      if (name === 'fire') {
        if (!buf) return;
        const src = ac.createBufferSource();
        const gain = ac.createGain();
        const t = ac.currentTime;
        const { offset, length, fade } = FIRE_CLIP;
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.setValueAtTime(0.5, t + length - fade);
        gain.gain.linearRampToValueAtTime(0, t + length);
        src.buffer = buf;
        src.connect(gain).connect(ac.destination);
        src.start(t, offset, length);
        return;
      }
      if (!buf || active.size >= MAX_CHANNELS) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      if (name === 'hit') src.connect(hitGain);
      else src.connect(ac.destination);
      active.add(src);
      src.onended = () => active.delete(src);
      src.start();
    },
    music: {
      play() {
        musicStartedAt = ac.currentTime;
        musicPausedAt = null;
        if (buffers.music) startMusic(0);
      },
      stop() {
        musicStartedAt = null;
        musicPausedAt = null;
        stopMusic();
      },
      pause() {
        if (musicStartedAt === null) return;
        musicPausedAt = Math.max(0, ac.currentTime - musicStartedAt);
        musicStartedAt = null;
        stopMusic();
      },
      resume() {
        if (musicStartedAt !== null || musicPausedAt === null) return;
        const offset = musicPausedAt;
        musicPausedAt = null;
        musicStartedAt = ac.currentTime - offset;
        if (buffers.music) startMusic(offset);
      },
      volume(v) {
        musicGain.gain.value = Math.min(1, Math.max(0, v));
      },
    },
    close() {
      musicStartedAt = null;
      stopMusic();
      try { ultSource?.stop(); } catch { /* ended */ }
      try { kingSource?.stop(); } catch { /* ended */ }
      try { killerSource?.stop(); } catch { /* ended */ }
      try { d4cSource?.stop(); } catch { /* ended */ }
      try { cmoonSource?.stop(); } catch { /* ended */ }
      try { silverSource?.stop(); } catch { /* ended */ }
      ultSource = null;
      kingSource = null;
      killerSource = null;
      d4cSource = null;
      cmoonSource = null;
      silverSource = null;
      active.forEach((s) => { try { s.stop(); } catch { /* ended */ } });
      ac.close().catch(() => {});
    },
  };
}

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const PadButton = ({ k, onPress, onRelease, children, className = '' }) => (
  <button
    className={`flex h-14 w-14 select-none items-center justify-center rounded-xl border border-orange-500/40 bg-white/5 text-orange-200 active:bg-orange-500/30 ${className}`}
    onPointerDown={(e) => { e.preventDefault(); onPress(k); }}
    onPointerUp={() => onRelease(k)}
    onPointerLeave={() => onRelease(k)}
    onPointerCancel={() => onRelease(k)}
    aria-label={k}
  >
    {children}
  </button>
);

const Game = ({ onClose }) => {
  const canvasRef = useRef(null);
  const queue = useRef([]);
  const held = useRef(new Set());
  const [run, setRun] = useState(0); // bump to restart, like relaunching the program
  const [character, setCharacter] = useState(null); // null = pick screen
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY) || `Player ${Math.floor(1000 + Math.random() * 9000)}`
  );
  const nameRef = useRef(name);
  nameRef.current = cleanName(name) || 'Player';
  const [players, setPlayers] = useState(1);
  useEffect(() => { localStorage.setItem(NAME_KEY, name); }, [name]);
  // A new onClose each parent render must not restart the game.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const press = (key) => {
    if (held.current.has(key)) return;
    held.current.add(key);
    queue.current.push({ type: 'keydown', key });
  };
  const release = (key) => {
    if (!held.current.has(key)) return;
    held.current.delete(key);
    queue.current.push({ type: 'keyup', key });
  };

  // Lock page scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Freeze the site behind the game so its videos and animations stop using the CPU.
  useEffect(() => {
    setGameActive(true);
    const videos = [...document.querySelectorAll('video')].filter((v) => !v.paused);
    videos.forEach((v) => v.pause());
    return () => {
      setGameActive(false);
      videos.forEach((v) => v.play().catch(() => {}));
    };
  }, []);

  // Keyboard -> pygame KEYDOWN/KEYUP (no key repeat, like pygame's default).
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape') { onCloseRef.current(); return; }
      if (e.target instanceof HTMLInputElement) return; // typing your name doesn't move the block
      const key = KEYS[e.code];
      if (!key) return;
      e.preventDefault();
      if (!e.repeat) {
        held.current.delete(key); // a real press always counts, even if a key-up was missed
        press(key);
      }
    };
    const up = (e) => {
      const key = KEYS[e.code];
      if (key) release(key);
    };
    // SDL sends key-up for held keys when the window loses focus.
    const blur = () => [...held.current].forEach(release);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Game loop: one step() per 1/60 s, like clock.tick(60).
  useEffect(() => {
    if (!character) return undefined; // waiting on the ultimate pick
    let cancelled = false;
    let raf;
    const audio = createAudio();
    const off = document.createElement('canvas');
    off.width = WIDTH;
    off.height = HEIGHT;
    const offCtx = off.getContext('2d');
    const screen = canvasRef.current.getContext('2d');
    const state = createState(character);
    queue.current = [];
    held.current.clear();
    let mp = null; // multiplayer room, joined once the game starts

    (async () => {
      const [heart, bullet] = await Promise.all([loadImage('/game/heart.png'), loadImage('/game/bullet.png')]);
      await audio.resume();
      await audio.ready;
      if (cancelled) return;
      const io = {
        ctx: offCtx,
        images: { heart, bullet },
        sfx: (n) => audio.sfx(n),
        music: audio.music,
        // shared game (no-ops until the room is joined)
        takeWorld: () => mp?.takeWorld() ?? null,
        takeEvents: () => mp?.takeEvents() ?? [],
        takeBooms: () => mp?.takeBooms() ?? [],
        takeUltSounds: () => mp?.takeUltSounds() ?? [],
        takeGameOver: () => mp?.takeGameOver() ?? false,
        report: (b) => mp?.report(b),
        sendBoom: (x, y, big) => mp?.sendBoom(x, y, big),
        sendUltSound: (type) => mp?.sendUltSound(type),
        reportPickup: (powerupId) => mp?.reportPickup(powerupId),
        startUlt: (st, type) => mp?.startUlt(st, type) ?? false,
        cancelUlt: (st) => mp?.cancelUlt(st) ?? false,
        stopUlt: () => audio.stopUlt(),
        isUlter: (st) => st.timeStopBy == null || (mp ? mp.isUlter(st) : true),
        isSlowUlter: (st) => (mp ? mp.isSlowUlter(st) : true),
        selfId: () => mp?.playerId() ?? null,
        online: () => !!mp,
        randomPlayerId: () => mp?.randomPlayerId() ?? null,
        topScore: () => mp?.topScore() ?? 0,
        buffTarget: (st, buffId) => {
          const ally = (st.allies || []).find((a) => a.id === buffId);
          if (ally) return { x: ally.x + 25, y: ally.y + 25 };
          return mp ? mp.buffTarget(st, buffId) : { x: st.x + 25, y: st.y + 25 };
        },
        isPlayerAlive: (ownerId) => (mp ? mp.isPlayerAlive(ownerId) : true),
        sacrificeAlly: (allyId) => mp?.sacrificeAlly(allyId),
        ownsWorld: () => !mp || mp.isHost() || !mp.isSynced(),
        targetY: (st) => {
          if (mp) return mp.targetY(st);
          const avoid = new Set((st.d4cBuffs || []).map((b) => b.id));
          const ys = [];
          if (!avoid.has(null)) ys.push(st.y + 25);
          for (const a of st.allies || []) if (!avoid.has(a.id)) ys.push(a.y + 25);
          return ys.length ? ys[Math.floor(Math.random() * ys.length)] : st.y;
        },
      };
      if (MULTIPLAYER) {
        import('../game/multiplayer')
          .then(({ connect }) => {
            if (!cancelled) mp = connect(() => nameRef.current, setPlayers);
          })
          .catch(() => {}); // offline: stay single-player
      }
      audio.sfx('countdown'); // Countdown.play() runs once before the loop

      const frame = 1000 / FPS;
      let last = performance.now();
      let acc = 0;
      const tick = (now) => {
        acc += now - last;
        last = now;
        let steps = 0;
        while (acc >= frame && steps < 5) {
          const events = queue.current;
          queue.current = [];
          const shown = step(state, events, io);
          if (state.exited) { onCloseRef.current(); return; } // sys.exit() closes the window
          if (shown) {
            screen.drawImage(off, 0, 0); // pygame.display.update()
            mp?.tick(state);
            mp?.draw(screen, { bullet, heart }, state); // other players and their shots, on top of your frame
            drawUltOverlay(screen, state); // time-stop tint and ripples over everything
          }
          acc -= frame;
          steps += 1;
        }
        if (steps === 5) acc = 0; // fell far behind (hidden tab): slow down instead of skipping frames
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      mp?.close();
      setPlayers(1);
      cancelAnimationFrame(raf);
      audio.close();
    };
  }, [run, character]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/85 p-3 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Block dodge"
    >
      <motion.div
        className="w-full max-w-[800px] overflow-hidden rounded-lg border border-neutral-700 shadow-[0_0_60px_rgba(249,115,22,0.35)]"
        initial={{ scale: 0.92, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="flex items-center justify-between bg-neutral-200 px-3 py-1 text-sm text-neutral-800">
          <span className="flex items-center gap-2">
            <img src="/game/bullet.png" alt="" className="h-3" /> Block dodge
          </span>
          {MULTIPLAYER && (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 16))}
                onBlur={() => setName((n) => cleanName(n) || 'Player')}
                maxLength={16}
                aria-label="Your name"
                title="Your name, shown to other players"
                className="w-28 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs outline-none focus:border-orange-500"
              />
              <span className="flex items-center gap-1 text-xs text-neutral-600" title="Players in the game right now">
                <Users size={13} /> {players} playing{players > 1 ? ' · same game' : ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => { setCharacter(null); setRun((r) => r + 1); }} className="rounded p-1 hover:bg-neutral-300" aria-label="Restart" title="Restart">
              <RotateCcw size={14} />
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-red-500 hover:text-white" aria-label="Close game" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {character ? (
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block aspect-[4/3] w-full bg-[#1f1f1f]" />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-5 overflow-y-auto bg-[#141019] p-5">
            <h2 className="text-center text-xl font-semibold text-white">Choose your ultimate</h2>
            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              <button
                onClick={() => setCharacter('world')}
                className="rounded-xl border border-violet-400/40 bg-violet-500/10 p-4 text-left transition hover:border-violet-300 hover:bg-violet-500/20"
              >
                <span className="block text-base font-bold text-violet-200">The World</span>
                <span className="mt-2 block text-sm text-white/60">
                  Stop time for 10 seconds. Only you can move, shoot and collect power-ups.
                </span>
              </button>
              <button
                onClick={() => setCharacter('king')}
                className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-left transition hover:border-red-300 hover:bg-red-500/20"
              >
                <span className="block text-base font-bold text-red-200">King Crimson</span>
                <span className="mt-2 block text-sm text-white/60">
                  See 10 seconds ahead and move freely — or press T again to erase that future.
                </span>
              </button>
              <button
                onClick={() => setCharacter('killer')}
                className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-4 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-500/20"
              >
                <span className="block text-base font-bold text-fuchsia-200">Killer Queen</span>
                <span className="mt-2 block text-sm text-white/60">
                  For 10 seconds your shots blast a wide radius that destroys every enemy bullet it touches.
                </span>
              </button>
              <button
                onClick={() => setCharacter('d4c')}
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-500/20"
              >
                <span className="block text-base font-bold text-cyan-200">D4C</span>
                <span className="mt-2 block text-sm text-white/60">
                  For 10 seconds enemy bullets never aim at you — they target another player or a random spot.
                </span>
              </button>
              <button
                onClick={() => setCharacter('cmoon')}
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-500/20"
              >
                <span className="block text-base font-bold text-emerald-200">C-Moon</span>
                <span className="mt-2 block text-sm text-white/60">
                  For 10 seconds enemy bullets accelerate toward you, and you absorb any that touch you.
                </span>
              </button>
              <button
                onClick={() => setCharacter('silver')}
                className="rounded-xl border border-slate-300/40 bg-slate-400/10 p-4 text-left transition hover:border-slate-200 hover:bg-slate-400/20"
              >
                <span className="block text-base font-bold text-slate-100">Silver Chariot</span>
                <span className="mt-2 block text-sm text-white/60">
                  Summon an AI ally every 30 seconds. Each one is a Silver Chariot too, so they
                  keep summoning more of themselves.
                </span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {character && (touch ? (
        <div className="flex w-full max-w-[800px] items-center justify-between px-2">
          <div className="grid grid-cols-3 gap-2">
            <span />
            <PadButton k="up" onPress={press} onRelease={release}><ArrowUp /></PadButton>
            <span />
            <PadButton k="left" onPress={press} onRelease={release}><ArrowLeft /></PadButton>
            <PadButton k="down" onPress={press} onRelease={release}><ArrowDown /></PadButton>
            <PadButton k="right" onPress={press} onRelease={release}><ArrowRight /></PadButton>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PadButton k="f" onPress={press} onRelease={release} className="h-20 w-20 rounded-full text-2xl font-bold">F</PadButton>
            <PadButton k="t" onPress={press} onRelease={release} className="h-12 w-12 rounded-full text-sm font-bold">T</PadButton>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-white/60">
          Press <kbd className="kbd">← ↑ ↓ →</kbd> to move around · press <kbd className="kbd">F</kbd> to fire, hold it to rapid-fire ·{' '}
          <kbd className="kbd">T</kbd> to use your ultimate · <kbd className="kbd">Esc</kbd> to close
        </p>
      ))}
    </motion.div>,
    document.body
  );
};

export default Game;
