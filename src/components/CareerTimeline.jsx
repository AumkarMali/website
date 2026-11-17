import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Calendar, MapPin } from 'lucide-react';
import { career } from '../constants';
import { SectionTitle, TiltCard } from './fx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = ([y, m]) => `${MONTHS[m - 1]} ${y}`;

// LinkedIn counts both the start and end month.
const duration = (start, end) => {
  const now = new Date();
  const [ey, em] = end ?? [now.getFullYear(), now.getMonth() + 1];
  const months = (ey - start[0]) * 12 + (em - start[1]) + 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo${m > 1 ? 's' : ''}`].filter(Boolean).join(' ');
};

const dateRange = (item) =>
  item.end && item.end.join() === item.start.join()
    ? fmt(item.start)
    : `${fmt(item.start)} - ${item.end ? fmt(item.end) : 'Present'}`;

const Entry = ({ item, index }) => {
  const left = index % 2 === 0;
  return (
    <div className="relative grid items-center gap-6 md:grid-cols-2 md:gap-20">
      <motion.span
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        style={{ x: '-50%' }}
        className="absolute left-4 top-10 z-10 h-4 w-4 rounded-full bg-orange-500 shadow-[0_0_0_6px_rgba(249,115,22,0.15),0_0_20px_rgba(249,115,22,0.9)] md:left-1/2"
      >
        {!item.end && <span className="absolute inset-0 animate-ping rounded-full bg-orange-400" />}
      </motion.span>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-120px' }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className={`hidden font-mono text-sm tracking-widest text-orange-300/70 md:row-start-1 md:block ${
          left ? 'md:col-start-2 text-left' : 'md:col-start-1 text-right'
        }`}
      >
        {dateRange(item).toUpperCase()}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, x: left ? -80 : 80, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className={`pl-12 md:row-start-1 md:pl-0 ${left ? 'md:col-start-1' : 'md:col-start-2'}`}
      >
        <TiltCard max={6} className="rounded-2xl">
          <div className="career-card group rounded-2xl border border-orange-500/20 bg-gray-900/80 p-6 backdrop-blur-md transition-colors duration-300 hover:border-orange-500/60">
            <div className="flex items-start gap-4">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl font-bold text-white shadow-lg ${
                  item.logo.src ? item.logo.tile ?? 'bg-white p-1.5' : item.logo.className
                }`}
              >
                {item.logo.src ? (
                  <img src={item.logo.src} alt={`${item.company} logo`} className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  item.logo.text
                )}
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-semibold leading-snug text-white">{item.role}</h4>
                  {!item.end && (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                      Present
                    </span>
                  )}
                </div>
                <p className="text-orange-300">
                  {item.company} · <span className="text-gray-400">{item.type}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
                  <Calendar size={14} /> {dateRange(item)} · {duration(item.start, item.end)}
                </p>
                {item.location && (
                  <p className="flex items-center gap-1.5 text-sm text-gray-400">
                    <MapPin size={14} /> {item.location}
                    {item.mode && ` · ${item.mode}`}
                  </p>
                )}
              </div>
            </div>
            {item.summary && <p className="mt-4 leading-relaxed text-gray-300">{item.summary}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.skills.map((skill, i) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
                  className="rounded-full border border-orange-500/30 bg-gray-800/80 px-3 py-1 text-xs text-orange-400"
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          </div>
        </TiltCard>
      </motion.div>
    </div>
  );
};

const CareerTimeline = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });
  const tip = useTransform(progress, [0, 1], ['0%', '100%']);

  return (
    <section className="relative">
      <SectionTitle text="Career Timeline" id="career" />
      <div ref={ref} className="relative mx-auto mt-16 max-w-6xl px-5 pb-24 lg:px-10">
        <div className="absolute bottom-24 left-9 top-0 md:left-1/2">
          <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-neutral-800" />
          <motion.div
            style={{ scaleY: progress, x: '-50%' }}
            className="absolute inset-y-0 w-[3px] origin-top bg-gradient-to-b from-yellow-400 via-orange-500 to-red-600 shadow-[0_0_15px_rgba(249,115,22,0.8)]"
          />
          <motion.div
            style={{ top: tip }}
            className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_20px_6px_rgba(251,146,60,0.9)]"
          />
        </div>
        <div className="space-y-16">
          {career.map((item, index) => (
            <Entry key={`${item.company}-${item.role}`} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CareerTimeline;
