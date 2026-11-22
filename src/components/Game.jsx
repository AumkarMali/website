import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Users, X } from 'lucide-react';
import { createState, step, FPS, WIDTH, HEIGHT } from '../game/blockDodge';
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
  let musicSource = null;
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
  // The music file is large; if it decodes late, join at the right position.
  load('music').then(() => {
    if (musicStartedAt !== null && buffers.music) startMusic(Math.max(0, ac.currentTime - musicStartedAt));
  });

  return {
    ready,
    resume: () => ac.resume().catch(() => {}),
    sfx(name) {
      const buf = buffers[name];
      if (name === 'fire') {
        if (!buf) return;
        const src = ac.createBufferSource();
        const gain = ac.createGain();
        const t = ac.currentTime;
        const { offset, length, fade } = FIRE_CLIP;
        gain.gain.setValueAtTime(1, t);
        gain.gain.setValueAtTime(1, t + length - fade);
        gain.gain.linearRampToValueAtTime(0, t + length);
        src.buffer = buf;
        src.connect(gain).connect(ac.destination);
        src.start(t, offset, length);
        return;
      }
      if (!buf || active.size >= MAX_CHANNELS) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
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
  const videoRef = useRef(null);
  const queue = useRef([]);
  const held = useRef(new Set());
  const [run, setRun] = useState(0); // bump to restart, like relaunching the program
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
    let cancelled = false;
    let raf;
    const audio = createAudio();
    const off = document.createElement('canvas');
    off.width = WIDTH;
    off.height = HEIGHT;
    const offCtx = off.getContext('2d');
    const screen = canvasRef.current.getContext('2d');
    const state = createState();
    queue.current = [];
    held.current.clear();
    let mp = null; // multiplayer room, joined once the game starts
    const video = videoRef.current;
    let videoOn = false;
    // the time-stop clip lives above the canvas: play it for the whole stop, with its audio
    const setVideo = (on) => {
      if (!video || videoOn === on) return;
      videoOn = on;
      if (on) {
        try { video.currentTime = 0; } catch { /* not seekable yet */ }
        video.style.opacity = '0.75'; // keep the frozen game visible under the effect
        video.play().catch(() => {}); // blocked autoplay: the visual simply stays hidden
      } else {
        video.pause();
        try { video.currentTime = 0; } catch { /* not seekable yet */ }
        video.style.opacity = '0';
      }
    };
    if (video) video.style.opacity = '0';

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
        takeGameOver: () => mp?.takeGameOver() ?? false,
        report: (b) => mp?.report(b),
        reportPickup: (powerupId) => mp?.reportPickup(powerupId),
        startUlt: (st) => mp?.startUlt(st) ?? false,
        isUlter: (st) => st.timeStopBy == null || (mp ? mp.isUlter(st) : true),
        selfId: () => mp?.playerId() ?? null,
        ownsWorld: () => !mp || mp.isHost() || !mp.isSynced(),
        targetY: (st) => (mp ? mp.targetY(st) : st.y),
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
          setVideo(state.timeStop > 0);
          if (shown) {
            screen.drawImage(off, 0, 0); // pygame.display.update()
            mp?.tick(state);
            mp?.draw(screen, { bullet }, state); // other players and their shots, on top of your frame
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
      video?.pause();
      setPlayers(1);
      cancelAnimationFrame(raf);
      audio.close();
    };
  }, [run]);

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
            <button onClick={() => setRun((r) => r + 1)} className="rounded p-1 hover:bg-neutral-300" aria-label="Restart" title="Restart">
              <RotateCcw size={14} />
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-red-500 hover:text-white" aria-label="Close game" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="relative">
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block aspect-[4/3] w-full bg-[#1f1f1f]" />
          <video
            ref={videoRef}
            src="/game/timestop.mp4"
            playsInline
            preload="auto"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200"
          />
        </div>
      </motion.div>

      {touch ? (
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
          <kbd className="kbd">T</kbd> to stop time · <kbd className="kbd">Esc</kbd> to close
        </p>
      )}
    </motion.div>,
    document.body
  );
};

export default Game;
