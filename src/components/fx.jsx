import { useRef } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';

export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 shadow-[0_0_12px_rgba(249,115,22,0.8)]"
    />
  );
};

// 3D tilt toward the cursor, with a glare that follows it.
export const TiltCard = ({ children, className = '', max = 10, ...rest }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const spring = { stiffness: 200, damping: 20 };
  const rotateX = useSpring(useTransform(my, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-max, max]), spring);
  const glare = useTransform(
    [mx, my],
    ([x, y]) => `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,140,60,0.22), transparent 55%)`
  );

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  if (reduce) return <div className={`relative ${className}`} {...rest}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={`relative ${className}`}
      {...rest}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{ background: glare }}
      />
    </motion.div>
  );
};

// Pulls its child toward the cursor while hovered.
export const Magnetic = ({ children, strength = 0.35, className = '' }) => {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 250, damping: 15 });
  const y = useSpring(0, { stiffness: 250, damping: 15 });
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ x, y }} className={`inline-block ${className}`}>
      {children}
    </motion.div>
  );
};

// Same neon typed heading as the existing sections, started when scrolled into view.
export const SectionTitle = ({ text, id }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div id={id} ref={ref} className="scroll-mt-20 px-1 pt-28 text-center lg:px-40">
      <h3 className="min-h-[1.6em] text-1xl tracking-wide opacity-80 sm:text-5xl lg:text-3xl">
        {inView && (
          <TypeAnimation
            sequence={[text, 1000]}
            wrapper="span"
            speed={30}
            style={{ fontSize: '2em' }}
            repeat={false}
            className="neon-text"
          />
        )}
      </h3>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-4 h-px w-48 bg-gradient-to-r from-transparent via-orange-500 to-transparent"
      />
    </div>
  );
};
