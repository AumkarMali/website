import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, X } from 'lucide-react';
import { createState, step, FPS, WIDTH, HEIGHT } from '../game/blockDodge';

const SOUNDS = ['countdown', 'bounce', 'fire', 'hit', 'ricochet', 'outro'];
const MAX_CHANNELS = 8; // pygame.mixer default; Sound.play() is silent when all are busy
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyF: 'f' };

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
        if (buffers.music) startMusic(0);
      },
      stop() {
        musicStartedAt = null;
        stopMusic();
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
  const queue = useRef([]);
  const held = useRef(new Set());
  const [run, setRun] = useState(0); // bump to restart, like relaunching the program
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
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
      const key = KEYS[e.code];
      if (!key) return;
      e.preventDefault();
      if (!e.repeat) press(key);
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

    (async () => {
      const [heart, bullet] = await Promise.all([loadImage('/game/heart.png'), loadImage('/game/bullet.png')]);
      await audio.resume();
      await audio.ready;
      if (cancelled) return;
      const io = { ctx: offCtx, images: { heart, bullet }, sfx: (n) => audio.sfx(n), music: audio.music };
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
          if (shown) screen.drawImage(off, 0, 0); // pygame.display.update()
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
          <div className="flex items-center gap-1">
            <button onClick={() => setRun((r) => r + 1)} className="rounded p-1 hover:bg-neutral-300" aria-label="Restart" title="Restart">
              <RotateCcw size={14} />
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-red-500 hover:text-white" aria-label="Close game" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="block aspect-[4/3] w-full bg-[#1f1f1f]" />
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
          <PadButton k="f" onPress={press} onRelease={release} className="h-20 w-20 rounded-full text-2xl font-bold">F</PadButton>
        </div>
      ) : (
        <p className="text-center text-sm text-white/60">
          Press <kbd className="kbd">← ↑ ↓ →</kbd> to move around · press <kbd className="kbd">F</kbd> to fire, hold it to rapid-fire ·{' '}
          <kbd className="kbd">Esc</kbd> to close
        </p>
      )}
    </motion.div>,
    document.body
  );
};

export default Game;
