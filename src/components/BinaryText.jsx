import { Fragment, useEffect, useMemo, useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

const TICK_MS = 50;
const GLITCH = 0.004; // chance per tick that a random character flips

// Text that decodes from binary, then keeps a band of 0s and 1s sweeping through it.
// Each character keeps its real width (the digit is drawn over it), so nothing reflows.
// band: characters in the sweeping binary band; speed: band speed in characters per second;
// decodeMs: first reveal, left to right.
const BinaryText = ({ text, className = '', delay = 0, as: Tag = 'p', band = 16, speed = 45, decodeMs = 1800 }) => {
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
      const revealed = Math.min(n, Math.floor((t / decodeMs) * n));
      const sweep = t > decodeMs ? ((t - decodeMs) / 1000) * speed : -Infinity;
      const head = sweep % (n + band * 2) - band;
      for (let i = 0; i < n; i += 1) {
        const inBand = i >= head && i < head + band;
        set(chars[i], i >= revealed || inBand || Math.random() < GLITCH);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [inView, reduce, delay, text, band, speed, decodeMs]);

  return (
    <Tag ref={ref} className={className} aria-label={text}>
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
    </Tag>
  );
};

export default BinaryText;
