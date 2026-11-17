import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { expertise } from '../constants';
import { SectionTitle } from './fx';

// One series: one hue (validated on the dark card surface), 2px line, ~10% area wash,
// 8px markers with a 2px surface ring, hairline solid grid, text in text tokens.
const SERIES = '#ea580c';
const SURFACE = '#111827';
const SIZE = 540;
const C = SIZE / 2;
const R = 150;
const RINGS = [20, 40, 60, 80, 100];

const angle = (i, n) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
const point = (i, n, value) => {
  const a = angle(i, n);
  const r = (R * value) / 100;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const Marker = ({ i, n, value, progress, active, onEnter, onLeave }) => {
  const cx = useTransform(progress, (t) => point(i, n, value * t)[0]);
  const cy = useTransform(progress, (t) => point(i, n, value * t)[1]);
  return (
    <g>
      <motion.circle cx={cx} cy={cy} r={active ? 7 : 5} fill={SERIES} stroke={SURFACE} strokeWidth={2} style={{ transition: 'r 0.2s' }} />
      {/* hit target well beyond the painted mark */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={16}
        fill="transparent"
        tabIndex={0}
        role="img"
        aria-label={`${expertise[i].axis}: ${value} out of 100`}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        className="cursor-pointer outline-none"
      />
    </g>
  );
};

const SkillRadar = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const progress = useMotionValue(0);
  const [active, setActive] = useState(null);
  const n = expertise.length;

  useEffect(() => {
    if (!inView) return;
    const controls = animate(progress, 1, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, progress]);

  const polygon = useTransform(progress, (t) =>
    expertise.map((d, i) => point(i, n, d.score * t).join(',')).join(' ')
  );

  const tip = active === null ? null : point(active, n, expertise[active].score);

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
                points={expertise.map((_, i) => point(i, n, v).join(',')).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            ))}
            {expertise.map((_, i) => {
              const [x, y] = point(i, n, 100);
              return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
            })}
            {[50, 100].map((v) => (
              <text key={v} x={C + 4} y={C - (R * v) / 100 + 12} className="fill-gray-500 text-[10px] tabular-nums">
                {v}
              </text>
            ))}

            <motion.polygon points={polygon} fill={SERIES} fillOpacity={0.12} stroke={SERIES} strokeWidth={2} strokeLinejoin="round" />

            {expertise.map((d, i) => {
              const [x, y] = point(i, n, 118);
              const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end';
              return (
                <text
                  key={d.axis}
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className={`text-[13px] transition-colors ${active === i ? 'fill-white' : 'fill-gray-300'}`}
                >
                  {d.short}
                </text>
              );
            })}

            {expertise.map((d, i) => (
              <Marker
                key={d.axis}
                i={i}
                n={n}
                value={d.score}
                progress={progress}
                active={active === i}
                onEnter={() => setActive(i)}
                onLeave={() => setActive(null)}
              />
            ))}
          </svg>

          {tip && (
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
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
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
