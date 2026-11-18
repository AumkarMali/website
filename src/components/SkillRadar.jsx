import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { expertise } from '../constants';
import { SectionTitle } from './fx';

// One series: one hue (validated on the dark card surface), 2px line, ~10% area wash,
// 8px markers with a 2px surface ring, hairline solid grid, text in text tokens.
// Motion: every SWAP_EVERY ms two axes (label + value) trade places. While they move the
// filled shape turns into a blob that ripples by at most WOBBLE points; once they settle it
// morphs back to the straight-edged polygon. The markers always sit on the true score.
const SERIES = '#ea580c';
const SURFACE = '#111827';
const SIZE = 540;
const C = SIZE / 2;
const R = 150;
const RINGS = [20, 40, 60, 80, 100];
const SWAP_EVERY = 2000;
const SWAP_MS = 1100;
const GROW_MS = 1400;
const WOBBLE = 3;
const MORPH_IN = 250; // polygon -> blob as a swap starts
const MORPH_OUT = 450; // blob -> polygon after the swap settles

const slotAngle = (slot, n) => -Math.PI / 2 + (slot * 2 * Math.PI) / n;
const polar = (slot, n, value) => {
  const a = slotAngle(slot, n);
  const r = (R * value) / 100;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const easeOut = (k) => 1 - (1 - k) ** 3;

// Closed Catmull-Rom curve through the points, as cubic Beziers. k scales the handles:
// 0 gives straight edges (the polygon), 1 the smooth blob.
const smoothClosed = (p, k = 1) => {
  const n = p.length;
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const h = k / 6;
    d += ` C${p1[0] + (p2[0] - p0[0]) * h},${p1[1] + (p2[1] - p0[1]) * h} ${p2[0] - (p3[0] - p1[0]) * h},${p2[1] - (p3[1] - p1[1]) * h} ${p2[0]},${p2[1]}`;
  }
  return `${d}Z`;
};

const SkillRadar = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(null);
  const [tip, setTip] = useState(null);
  const n = expertise.length;

  const blobRef = useRef(null);
  const markerRefs = useRef([]);
  const hitRefs = useRef([]);
  const labelRefs = useRef([]);
  // Each axis moves from slot `from` to slot `to`, starting at `start`.
  const slots = useRef(expertise.map((_, i) => ({ from: i, to: i, start: 0 })));
  const activeRef = useRef(null);
  activeRef.current = active;

  useEffect(() => {
    if (!inView) return;
    let raf;
    const t0 = performance.now();
    let lastSwap = t0 + GROW_MS;

    const slotNow = (s, now) => {
      const k = Math.min(1, Math.max(0, (now - s.start) / SWAP_MS));
      let d = s.to - s.from;
      if (d > n / 2) d -= n; // go the short way round
      if (d < -n / 2) d += n;
      return s.from + d * easeInOut(k);
    };

    const swap = (now) => {
      const a = Math.floor(Math.random() * n);
      let b = Math.floor(Math.random() * (n - 1));
      if (b >= a) b += 1;
      const sa = slots.current[a];
      const sb = slots.current[b];
      const [ta, tb] = [sa.to, sb.to];
      Object.assign(sa, { from: ta, to: tb, start: now });
      Object.assign(sb, { from: tb, to: ta, start: now });
      [a, b].forEach((i) => {
        const el = labelRefs.current[i];
        el?.classList.add('radar-swapping');
        setTimeout(() => el?.classList.remove('radar-swapping'), SWAP_MS);
      });
    };

    const frame = (now) => {
      const grow = reduce ? 1 : easeOut(Math.min(1, (now - t0) / GROW_MS));
      if (!reduce && now - lastSwap > SWAP_EVERY && activeRef.current === null) {
        swap(now);
        lastSwap = now;
      }
      const since = now - lastSwap;
      let blobness = 0;
      if (!reduce && since >= 0) {
        if (since < MORPH_IN) blobness = since / MORPH_IN;
        else if (since < SWAP_MS) blobness = 1;
        else if (since < SWAP_MS + MORPH_OUT) blobness = 1 - (since - SWAP_MS) / MORPH_OUT;
        blobness = easeInOut(blobness);
      }
      const blob = [];
      expertise.forEach((d, i) => {
        const slot = slotNow(slots.current[i], now);
        const [mx, my] = polar(slot, n, d.score * grow);
        markerRefs.current[i]?.setAttribute('cx', mx);
        markerRefs.current[i]?.setAttribute('cy', my);
        hitRefs.current[i]?.setAttribute('cx', mx);
        hitRefs.current[i]?.setAttribute('cy', my);

        const ripple = (blobness * WOBBLE * (Math.sin(now / 900 + i * 1.7) + 0.5 * Math.sin(now / 530 + i * 2.9))) / 1.5;
        blob.push({ slot: ((slot % n) + n) % n, pt: polar(slot, n, Math.max(0, (d.score + ripple) * grow)) });

        const [lx, ly] = polar(slot, n, 118);
        const label = labelRefs.current[i];
        if (label) {
          label.setAttribute('x', lx);
          label.setAttribute('y', ly);
          label.setAttribute('text-anchor', Math.abs(lx - C) < 6 ? 'middle' : lx > C ? 'start' : 'end');
        }
      });
      // Draw the shape in angular order so it never folds over itself mid-swap.
      blob.sort((p, q) => p.slot - q.slot);
      blobRef.current?.setAttribute('d', smoothClosed(blob.map((b) => b.pt), blobness));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, n]);

  const enter = (i) => {
    setActive(i);
    const m = markerRefs.current[i];
    if (m) setTip([Number(m.getAttribute('cx')), Number(m.getAttribute('cy'))]);
  };
  const leave = () => {
    setActive(null);
    setTip(null);
  };

  return (
    <section className="relative px-5 lg:px-20">
      <SectionTitle text="Expertise" id="expertise" />
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-gray-600 dark:text-gray-400">
        Depth of experience in each area, scored 0-100 from the roles and projects on my resume.
      </p>

      <div ref={ref} className="mx-auto mt-12 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative mx-auto w-full max-w-[520px] rounded-2xl border border-orange-500/20 bg-gray-900/80 p-4 backdrop-blur-md">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible" role="group" aria-label="Expertise radar chart">
            {RINGS.map((v) => (
              <polygon
                key={v}
                points={expertise.map((_, i) => polar(i, n, v).join(',')).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}
            {expertise.map((_, i) => {
              const [x, y] = polar(i, n, 100);
              return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
            })}
            {[50, 100].map((v) => (
              <text key={v} x={C + 4} y={C - (R * v) / 100 + 12} className="fill-gray-500 text-[10px] tabular-nums">
                {v}
              </text>
            ))}

            <path ref={blobRef} d="" fill={SERIES} fillOpacity={0.14} stroke={SERIES} strokeWidth={2} strokeLinejoin="round" />

            {expertise.map((d, i) => {
              const [x, y] = polar(i, n, 118);
              return (
                <text
                  key={d.axis}
                  ref={(el) => { labelRefs.current[i] = el; }}
                  x={x}
                  y={y}
                  textAnchor={Math.abs(x - C) < 6 ? 'middle' : x > C ? 'start' : 'end'}
                  dominantBaseline="middle"
                  className={`radar-label text-[13px] transition-colors ${active === i ? 'fill-white' : 'fill-gray-300'}`}
                >
                  {d.short}
                </text>
              );
            })}

            {expertise.map((d, i) => (
              <g key={d.axis}>
                <circle
                  ref={(el) => { markerRefs.current[i] = el; }}
                  cx={C}
                  cy={C}
                  r={active === i ? 7 : 5}
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth={2}
                  style={{ transition: 'r 0.2s' }}
                />
                {/* hit target well beyond the painted mark */}
                <circle
                  ref={(el) => { hitRefs.current[i] = el; }}
                  cx={C}
                  cy={C}
                  r={16}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.axis}: ${d.score} out of 100`}
                  onPointerEnter={() => enter(i)}
                  onPointerLeave={leave}
                  onFocus={() => enter(i)}
                  onBlur={leave}
                  className="cursor-pointer outline-none"
                />
              </g>
            ))}
          </svg>

          {tip && active !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-left shadow-xl"
              style={{ left: `${(tip[0] / SIZE) * 100}%`, top: `${(tip[1] / SIZE) * 100}%` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: SERIES }} />
                <span className="text-lg font-semibold text-white">{expertise[active].score}</span>
              </div>
              <div className="whitespace-nowrap text-xs text-gray-400">{expertise[active].axis}</div>
            </div>
          )}
        </div>

        {/* Same numbers as a list, with the evidence behind each score */}
        <ul className="space-y-5">
          {expertise.map((d, i) => (
            <li
              key={d.axis}
              onPointerEnter={() => enter(i)}
              onPointerLeave={leave}
              className={`rounded-xl px-4 py-3 transition-colors ${active === i ? 'bg-black/5 dark:bg-white/5' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-gray-900 dark:text-white">{d.axis}</span>
                <span className="tabular-nums text-gray-700 dark:text-gray-300">{d.score}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'rgba(234,88,12,0.15)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: SERIES }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${d.score}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{d.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default SkillRadar;
