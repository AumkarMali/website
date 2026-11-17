import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

const TICK_MS = 50;
const DECODE_MS = 1800; // first reveal, left to right
const BAND = 16; // characters in the sweeping binary band
const SPEED = 45; // band speed, characters per second
const GLITCH = 0.004; // chance per tick that a random character flips

// Text that decodes from binary, then keeps a band of 0s and 1s sweeping through it.
// Each character keeps its real width (the digit is drawn over it), so nothing reflows.
const BinaryText = ({ text, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const words = useMemo(() => text.split(' '), [text]);

  useEffect(() => {
    if (reduce) return;
    const chars = [...ref.current.querySelectorAll('[data-c]')];
    const n = chars.length;
    const set = (el, on) => {
      if (on) {
        el.dataset.bin = Math.random() < 0.5 ? '0' : '1';
        el.classList.add('bin');
      } else {
        el.classList.remove('bin');
      }
    };
    chars.forEach((el) => set(el, true));
    if (!inView) return;

    const start = performance.now() + delay;
    const id = setInterval(() => {
      const t = performance.now() - start;
      if (t < 0) return;
      const revealed = Math.min(n, Math.floor((t / DECODE_MS) * n));
      const sweep = t > DECODE_MS ? ((t - DECODE_MS) / 1000) * SPEED : -Infinity;
      const head = sweep % (n + BAND * 2) - BAND;
      for (let i = 0; i < n; i += 1) {
        const inBand = i >= head && i < head + BAND;
        set(chars[i], i >= revealed || inBand || Math.random() < GLITCH);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [inView, reduce, delay, text]);

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((word, w) => (
        <Fragment key={w}>
          <span aria-hidden className="whitespace-nowrap">
            {[...word].map((ch, i) => (
              <span key={i} data-c className="binary-char">
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 && ' '}
        </Fragment>
      ))}
    </p>
  );
};

export default BinaryText;
